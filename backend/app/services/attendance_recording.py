"""Recording attendance — the ONLY writer of ``attendance_records`` for teachers, admins and
student face check-in (DOMAIN_RULES §6, amended by §13.3, §13.5, §13.8, §13.9, §13.10).
The auto-absent finalizer (``auto_absent_service``) is the only other writer.

Flow for every write (Rule §13.10)::

    (face match happens in the route, outside the lock)
    SELECT ... FOR UPDATE the class_sessions row -> load its records + roster -> validate ALL
    entries -> plain INSERT/UPDATE (no ON CONFLICT DO UPDATE) -> audit rows -> held/submitted
    transition -> flush

Transactions: services FLUSH, the route OWNS THE COMMIT (``await db.commit()``; on
``DomainError`` or any exception the route rolls back). Nothing is written when validation
fails — the error is raised before the first INSERT/UPDATE.

Errors: :class:`app.services.domain_errors.DomainError` with ``code``/``http_status``/
``message``/``details``; per-entry problems are collected into
``DomainError("validation_failed", 422, details={"errors": [{student_id, code, message}]})``.
Legacy endpoints translate with ``err.to_legacy_response()`` (HTTP 200, ``success: false``).

Who may write what (Rule §6.3 + §13.8):

* student (face): own record only, today's non-cancelled session of their cohort, inside the
  check-in window ``[start - opens_before, min(end, start + closes_after))``; status is computed
  (present if ``now <= start + late_after`` else late); never overwrites (``already_recorded``).
* teacher: sessions they own, not future, not cancelled, enrolled students, within
  ``teacher_edit_window_days``; present/late/absent (``excused`` is admin-only).
* admin: any session, not future, not cancelled.
* Reasons are required ONLY for: changing a ``student_face`` record's status; ``excused``;
  an admin overriding a ``teacher`` record; any edit after the teacher window (admin only).
  A batch-level ``reason`` fills entries that need one. Same-status writes are no-ops.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Optional, Sequence

from sqlalchemy import select

from app.core.clock import app_now
from app.models import (
    AttendanceMethod,
    AttendanceRecord,
    AttendanceSource,
    AttendanceStatus,
    AuditAction,
    ClassSession,
    SessionKind,
    SessionStatus,
    User,
)
from app.services.attendance_policy import AttendancePolicy, get_attendance_policy
from app.services.class_sessions import (
    HELD_STATUSES,
    actor_owns_session,
    actor_role,
    actor_user_id,
    add_audit,
    enrollment_start_for,
    ensure_sessions_for,
    is_enrolled_for,
    is_past_finalize_point,
    lock_session,
    mark_held,
    mark_submitted,
    session_end_at,
    session_is_not_future,
    session_roster_ids,
    session_start_at,
    time_slot_label,
    within_teacher_window,
)
from app.services.domain_errors import DomainError
from app.services.term_service import load_terms, term_for_date

logger = logging.getLogger(__name__)

VALID_WRITE_STATUSES = ("present", "late", "absent", "excused")
#: Exclusions that describe *provenance* problems of the old row (Rule §13.5); a fresh real
#: write by a teacher/admin supersedes them, so the write clears the flag.
PROVENANCE_EXCLUSIONS = frozenset({"legacy_unheld_session", "recorded_before_class"})
AUTO_ABSENT_LOCATION = "AUTO_ABSENT_SYSTEM"

ACTION_CREATE = "create"
ACTION_UPDATE = "update"
ACTION_UNCHANGED = "unchanged"


# ============================================================================ value objects


@dataclass(frozen=True)
class Entry:
    """One requested write: ``status`` in present|late|absent|excused; optional per-entry reason."""

    student_id: int
    status: Optional[str] = None
    reason: Optional[str] = None


@dataclass(frozen=True)
class EntryPlan:
    """Outcome of validating one entry (pure)."""

    student_id: int
    status: Optional[str]
    action: Optional[str]  # create | update | unchanged | None (error)
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    reason: Optional[str] = None
    status_changes: bool = False

    @property
    def ok(self) -> bool:
        return self.error_code is None


@dataclass
class RecordResult:
    """Result of a write (counts + final per-student status)."""

    session_id: int
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    statuses: dict[int, str] = field(default_factory=dict)
    record_ids: dict[int, int] = field(default_factory=dict)
    session_status: str = ""
    submitted: bool = False
    held_transition: bool = False
    source: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "success": True,
            "session_id": self.session_id,
            "created": self.created,
            "updated": self.updated,
            "unchanged": self.unchanged,
            "statuses": {str(k): v for k, v in self.statuses.items()},
            "record_ids": {str(k): v for k, v in self.record_ids.items()},
            "session_status": self.session_status,
            "submitted": self.submitted,
            "held_transition": self.held_transition,
            "source": self.source,
        }


# ============================================================================ pure rules


def checkin_window(start_at: datetime, end_at: datetime, policy: AttendancePolicy) -> tuple[datetime, datetime, datetime]:
    """Rule §13.9: ``(opens_at, closes_at, late_after_at)`` with
    ``closes_at = min(end, start + checkin_closes_after_minutes)`` (exclusive)."""
    opens_at = start_at - timedelta(minutes=policy.checkin_opens_minutes_before)
    closes_at = min(end_at, start_at + timedelta(minutes=policy.checkin_closes_after_minutes))
    late_after_at = start_at + timedelta(minutes=policy.late_after_minutes)
    return opens_at, closes_at, late_after_at


def compute_checkin_status(
    now: datetime, start_at: datetime, end_at: datetime, policy: AttendancePolicy
) -> tuple[Optional[str], Optional[str]]:
    """Rule §13.9 self check-in decision.

    Returns ``("present"|"late", None)`` inside ``[opens_at, closes_at)``; otherwise
    ``(None, "window_not_open")`` before it or ``(None, "window_closed")`` after it.
    ``present`` iff ``now <= start + late_after_minutes``.
    """
    opens_at, closes_at, late_after_at = checkin_window(start_at, end_at, policy)
    if now < opens_at:
        return None, "window_not_open"
    if now >= closes_at:
        return None, "window_closed"
    return ("present" if now <= late_after_at else "late"), None


def reason_required(
    actor_role: str,
    existing_source: Optional[str],
    new_status: str,
    within_window: bool,
    *,
    status_changes: bool = True,
) -> bool:
    """Rule §13.8 — a reason is required ONLY when:
    (a) the status of a ``student_face`` record changes; (b) the new status is ``excused``;
    (c) an admin overrides (changes) a ``teacher``-sourced record; (d) the edit is after the
    teacher edit window. ``existing_source`` is ``None`` for a new record."""
    if new_status == "excused":
        return True
    if not within_window:
        return True
    if status_changes and existing_source == AttendanceSource.student_face:
        return True
    if status_changes and actor_role == "admin" and existing_source == AttendanceSource.teacher:
        return True
    return False


def source_for_role(role: str) -> Optional[str]:
    """Record ``source`` written by an actor role (teacher/admin; students use self check-in)."""
    return {"admin": AttendanceSource.admin.value, "teacher": AttendanceSource.teacher.value}.get(role)


def method_for_source(source: str) -> str:
    """Legacy ``method`` consistent with ``source`` (Rule §6.1)."""
    if source == AttendanceSource.student_face:
        return AttendanceMethod.face.value
    if source == AttendanceSource.system_auto:
        return AttendanceMethod.other.value
    return AttendanceMethod.manual.value


def normalize_status(value: Any) -> Optional[str]:
    if value is None:
        return None
    raw = getattr(value, "value", value)
    return str(raw).strip().lower() or None


def plan_entry(
    *,
    student_id: int,
    actor_role: str,
    status: Optional[str],
    enrolled: bool,
    existing_status: Optional[str],
    existing_source: Optional[str],
    existing_exclusion_reason: Optional[str],
    within_window: bool,
    reason: Optional[str],
) -> EntryPlan:
    """Validate one teacher/admin entry (Rule §6.3, §13.8). Pure.

    ``existing_exclusion_reason`` is the record's ``exclusion_reason`` only when it is currently
    excluded from metrics. A same-status write is ``unchanged`` unless the record is excluded for
    a provenance reason (then it is re-attested as an ``update`` that clears the exclusion).
    """
    status = normalize_status(status)
    reason = (reason or "").strip() or None

    def err(code: str, message: str) -> EntryPlan:
        return EntryPlan(student_id, status, None, code, message, reason)

    if status not in VALID_WRITE_STATUSES:
        return err("invalid_status", "Status must be one of present, late, absent, excused")
    if not enrolled:
        return err("not_enrolled", "Student is not enrolled in this class session")
    if status == "excused" and actor_role != "admin":
        return err("excused_admin_only", "Only an admin can record an excused absence")
    if existing_status is None:
        action, changes = ACTION_CREATE, True
        needs = reason_required(actor_role, None, status, within_window)
    else:
        changes = existing_status != status
        if not changes and existing_exclusion_reason not in PROVENANCE_EXCLUSIONS:
            return EntryPlan(student_id, status, ACTION_UNCHANGED, reason=reason)
        action = ACTION_UPDATE
        needs = reason_required(actor_role, existing_source, status, within_window, status_changes=changes)
    if needs and not reason:
        return err("reason_required", "A reason is required for this change")
    return EntryPlan(student_id, status, action, reason=reason, status_changes=changes)


def requires_confirm_held(
    *,
    session_status: str,
    submit: bool,
    writes_held_status: bool,
    past_finalize_point: bool,
    confirm_held: bool,
) -> bool:
    """Rule §13.3 (amended by coordinator decision): any write that would move a ``scheduled``
    session to ``held`` after ``end + finalize_grace`` (an unrecorded past class) needs
    ``confirm_held=True`` — a single present/late/absent write AND a register submission
    (``submit=True``), because the finalizer will then mark everyone else absent. Writes and
    submissions before ``end + grace`` (during / just after class) need no confirmation."""
    return (
        str(session_status) == SessionStatus.scheduled
        and past_finalize_point
        and (submit or writes_held_status)
        and not confirm_held
    )


# ============================================================================ helpers


def _record_status(rec: Optional[AttendanceRecord]) -> Optional[str]:
    return normalize_status(rec.status) if rec is not None else None


async def _session_records(db, session_id: int) -> dict[int, AttendanceRecord]:
    rows = (await db.execute(
        select(AttendanceRecord).where(AttendanceRecord.session_id == session_id)
        .execution_options(populate_existing=True)
    )).scalars().all()
    return {r.student_id: r for r in rows}


def _apply_update(rec: AttendanceRecord, *, status: str, source: str, actor_id: Optional[int], reason: Optional[str]) -> None:
    rec.status = AttendanceStatus(status)
    rec.source = source
    rec.method = AttendanceMethod(method_for_source(source))
    rec.marked_by = actor_id
    if source != AttendanceSource.system_auto and rec.location == AUTO_ABSENT_LOCATION:
        rec.location = None  # never leave auto-absent provenance on a human decision (Rule §6.3)
    if source != AttendanceSource.student_face:
        rec.confidence_score = None
    rec.notes = reason or f"Recorded by {source}"


# ============================================================================ teacher / admin writes


async def record_attendance(
    db,
    *,
    actor: Any,
    session: ClassSession,
    entries: Sequence[Entry],
    source: Optional[str] = None,
    reason: Optional[str] = None,
    submit: bool = False,
    confirm_held: bool = False,
    mark_remaining_absent: bool = False,
    now: Optional[datetime] = None,
    policy: Optional[AttendancePolicy] = None,
    context: Optional[dict] = None,
) -> RecordResult:
    """Rule §6.4 (+ §13.3, §13.8, §13.10): validate ALL entries, then write them and their audit
    rows; mark the session held / submitted.

    * ``source`` defaults to the actor's role (``teacher``/``admin``); a mismatch is rejected.
    * ``submit=True`` = register submission (teacher bulk-mark, admin mark-bulk): sets
      ``submitted_at/by`` and ``held``.
    * ``mark_remaining_absent=True`` (implies ``submit``) writes ``absent`` (actor's source) for
      roster students with no record (Rule §13.4 "Held" resolution).
    * Any write or submission that would make a ``scheduled`` session held after
      ``end + finalize_grace`` raises ``confirm_held`` (409, ``details.students_without_record``)
      unless ``confirm_held=True`` (§13.3 as amended by the coordinator).
    Flushes; the caller commits.
    """
    now = now or app_now()
    policy = policy or await get_attendance_policy(db)
    role = actor_role(actor)
    expected_source = source_for_role(role)
    if expected_source is None:
        raise DomainError("forbidden", "Only teachers and admins can record attendance this way", http_status=403)
    if source is not None and str(source) != expected_source:
        raise DomainError("invalid_source", f"A {role} cannot write records with source '{source}'", http_status=403)
    source = expected_source
    if mark_remaining_absent:
        submit = True
    actor_id = actor_user_id(actor)

    session = await lock_session(db, session.id)
    if session.status == SessionStatus.cancelled:
        raise DomainError("session_cancelled", "This class session is cancelled; restore it before recording attendance",
                          http_status=409, details={"session_id": session.id})
    if not session_is_not_future(session.session_date, session.start_time, now, policy.checkin_opens_minutes_before):
        raise DomainError("session_not_started", "Attendance cannot be recorded before the class starts",
                          http_status=409, details={"session_id": session.id})
    in_window = within_teacher_window(session.session_date, now.date(), policy.teacher_edit_window_days)
    if role == "teacher":
        if not await actor_owns_session(db, actor, session):
            raise DomainError("not_session_teacher", "You are not the teacher of this class session",
                              http_status=403, details={"session_id": session.id})
        if not in_window:
            raise DomainError("edit_window_closed",
                              f"Attendance older than {policy.teacher_edit_window_days} days can only be changed by an admin",
                              http_status=403, details={"session_id": session.id})

    roster = await session_roster_ids(db, session)
    existing = await _session_records(db, session.id)

    errors: list[dict[str, Any]] = []
    plans: list[EntryPlan] = []
    seen: set[int] = set()

    def plan_for(student_id: int, status: Any, entry_reason: Optional[str]) -> EntryPlan:
        rec = existing.get(student_id)
        return plan_entry(
            student_id=student_id,
            actor_role=role,
            status=status,
            enrolled=student_id in roster,
            existing_status=_record_status(rec),
            existing_source=rec.source if rec is not None else None,
            existing_exclusion_reason=(rec.exclusion_reason if rec is not None and rec.excluded_from_metrics else None),
            within_window=in_window,
            reason=entry_reason or reason,
        )

    for e in entries:
        try:
            sid = int(e.student_id)
        except (TypeError, ValueError):
            errors.append({"student_id": e.student_id, "code": "invalid_student", "message": "Invalid student id"})
            continue
        if sid in seen:
            errors.append({"student_id": sid, "code": "duplicate_entry", "message": "Student listed more than once"})
            continue
        seen.add(sid)
        p = plan_for(sid, e.status, e.reason)
        if p.ok:
            plans.append(p)
        else:
            errors.append({"student_id": sid, "code": p.error_code, "message": p.error_message})

    if mark_remaining_absent:
        for sid in sorted(roster - seen):
            rec = existing.get(sid)
            if rec is not None and not (rec.excluded_from_metrics and rec.exclusion_reason == "legacy_unheld_session"):
                continue
            p = plan_for(sid, "absent", None)
            if p.ok:
                plans.append(p)
            else:
                errors.append({"student_id": sid, "code": p.error_code, "message": p.error_message})

    if errors:
        raise DomainError("validation_failed", errors[0]["message"] if len(errors) == 1 else f"{len(errors)} entries are invalid",
                          http_status=422, details={"errors": errors, "session_id": session.id})

    writes = [p for p in plans if p.action in (ACTION_CREATE, ACTION_UPDATE)]
    writes_held_status = any(p.status in HELD_STATUSES for p in writes)
    if requires_confirm_held(
        session_status=session.status,
        submit=submit,
        writes_held_status=writes_held_status,
        past_finalize_point=is_past_finalize_point(session.session_date, session.end_time, now, policy.finalize_grace_minutes),
        confirm_held=confirm_held,
    ):
        with_record = set(existing) | {p.student_id for p in writes if p.action == ACTION_CREATE}
        missing = len(roster - with_record)
        raise DomainError(
            "confirm_held",
            f"Recording this marks the class as held; {missing} student(s) without a record will be marked absent automatically",
            http_status=409,
            details={"students_without_record": missing, "session_id": session.id},
        )

    result = RecordResult(session_id=session.id, source=source)
    slot = time_slot_label(session.start_time, session.end_time)
    pending_audit: list[tuple[AttendanceRecord, EntryPlan, Optional[str], Optional[str], Optional[str]]] = []
    for p in plans:
        rec = existing.get(p.student_id)
        if p.action == ACTION_UNCHANGED:
            result.unchanged += 1
            result.statuses[p.student_id] = p.status
            if rec is not None:
                result.record_ids[p.student_id] = rec.id
            continue
        if p.action == ACTION_CREATE:
            rec = AttendanceRecord(
                student_id=p.student_id,
                subject_id=session.subject_id,
                session_id=session.id,
                date=session.session_date,
                time_slot=slot,
                status=AttendanceStatus(p.status),
                method=AttendanceMethod(method_for_source(source)),
                source=source,
                marked_by=actor_id,
                notes=p.reason or f"Recorded by {source}",
                excluded_from_metrics=False,
            )
            db.add(rec)
            result.created += 1
            pending_audit.append((rec, p, None, None, None))
        else:
            old_status, old_source = _record_status(rec), rec.source
            cleared = rec.exclusion_reason if (rec.excluded_from_metrics and rec.exclusion_reason in PROVENANCE_EXCLUSIONS) else None
            _apply_update(rec, status=p.status, source=source, actor_id=actor_id, reason=p.reason)
            if cleared:
                rec.excluded_from_metrics = False
                rec.exclusion_reason = None
            result.updated += 1
            pending_audit.append((rec, p, old_status, old_source, cleared))
        result.statuses[p.student_id] = p.status

    await db.flush()  # assigns ids for new records
    for rec, p, old_status, old_source, cleared in pending_audit:
        ctx = {"session_id": session.id, "method": method_for_source(source), "submit": submit}
        if cleared:
            ctx["cleared_exclusion"] = cleared
        if context:
            ctx.update(context)
        add_audit(
            db,
            action=AuditAction.create if old_status is None and p.action == ACTION_CREATE else AuditAction.update,
            session_id=session.id,
            attendance_record_id=rec.id,
            student_id=p.student_id,
            old_status=old_status,
            new_status=p.status,
            old_source=old_source,
            new_source=source,
            changed_by=actor_id,
            reason=p.reason,
            context=ctx,
        )
        result.record_ids[p.student_id] = rec.id

    if writes_held_status:
        result.held_transition = mark_held(session, now)
    if submit:
        was_scheduled = session.status == SessionStatus.scheduled
        mark_submitted(db, session=session, actor=actor, now=now, context={"entries": len(plans), **(context or {})})
        result.held_transition = result.held_transition or was_scheduled
        result.submitted = True
    await db.flush()
    result.session_status = session.status
    return result


# ============================================================================ student face check-in


def _checkin_rejection(code: str, message: str, http_status: int, **details: Any) -> DomainError:
    return DomainError(code, message, http_status=http_status, details=details)


async def find_checkin_session(
    db,
    *,
    student: Any,
    subject_id: Optional[int] = None,
    schedule_id: Optional[int] = None,
    session_id: Optional[int] = None,
    now: Optional[datetime] = None,
    policy: Optional[AttendancePolicy] = None,
) -> ClassSession:
    """Rule §13.9: pick today's session of the student's cohort (optionally for a subject /
    schedule / session id) whose check-in window contains ``now``; materializes today's sessions
    on demand (Rule §13.1). ``session_id`` takes precedence over ``schedule_id``; a
    ``schedule_id`` equal to one of today's make-up session ids (in the student's cohort) is
    accepted as that session. Rejections: ``between_terms``, ``no_session_today``,
    ``session_cancelled``, ``window_closed`` (``details.window_state`` = ``not_open``/``closed``)."""
    now = now or app_now()
    policy = policy or await get_attendance_policy(db)
    today = now.date()
    if term_for_date(await load_terms(db), today) is None:
        raise _checkin_rejection("between_terms", "There is no active term today; check-in is closed", 409)
    sessions = await ensure_sessions_for(db, session_date=today, faculty_id=student.faculty_id,
                                         semester=student.semester, subject_id=subject_id, policy=policy)
    if session_id is not None:
        # An explicit session id wins; schedule_id is ignored (make-ups have no schedule).
        sessions = [s for s in sessions if s.id == session_id]
    elif schedule_id is not None:
        by_schedule = [s for s in sessions if s.schedule_id == schedule_id]
        if not by_schedule:
            # Clients may send a make-up session's id in the schedule_id slot.
            by_schedule = [s for s in sessions if s.id == schedule_id and s.kind == SessionKind.makeup]
        sessions = by_schedule
    if not sessions:
        raise _checkin_rejection("no_session_today", "You have no class session for this subject today", 404)
    live = [s for s in sessions if s.status != SessionStatus.cancelled]
    if not live:
        raise _checkin_rejection("session_cancelled", "This class has been cancelled", 409,
                                 session_id=sessions[0].id)
    in_window = []
    upcoming = []
    for s in live:
        start_at, end_at = session_start_at(s.session_date, s.start_time), session_end_at(s.session_date, s.end_time)
        status, code = compute_checkin_status(now, start_at, end_at, policy)
        if status is not None:
            in_window.append(s)
        elif code == "window_not_open":
            upcoming.append((checkin_window(start_at, end_at, policy)[0], s))
    if in_window:
        return sorted(in_window, key=lambda s: (s.start_time, s.id))[0]
    if upcoming:
        opens_at, s = sorted(upcoming, key=lambda x: x[0])[0]
        raise _checkin_rejection("window_closed", f"Check-in opens at {opens_at.strftime('%H:%M')}", 409,
                                 window_state="not_open", opens_at=opens_at.isoformat(), session_id=s.id)
    raise _checkin_rejection("window_closed", "The check-in window for this class has closed", 409, window_state="closed",
                             session_id=live[-1].id)


async def student_self_checkin(
    db,
    *,
    student: Any,
    session: ClassSession,
    confidence: Optional[float] = None,
    method: str = "face",
    now: Optional[datetime] = None,
    policy: Optional[AttendancePolicy] = None,
) -> RecordResult:
    """Rule §6.4 + §13.9/§13.10: the student's own check-in for ``session`` (face match already
    done by the caller, outside the lock). Status is computed by the server. Never overwrites:
    an existing record -> ``already_recorded`` (409, ``details.current_status``). Other
    rejections: ``no_session_today``, ``session_cancelled``, ``not_enrolled``, ``window_closed``.
    Marks the session held. Flushes; the caller commits."""
    now = now or app_now()
    policy = policy or await get_attendance_policy(db)
    session = await lock_session(db, session.id)
    if session.session_date != now.date():
        raise _checkin_rejection("no_session_today", "Check-in is only possible for today's classes", 409, session_id=session.id)
    if session.status == SessionStatus.cancelled:
        raise _checkin_rejection("session_cancelled", "This class has been cancelled", 409, session_id=session.id)
    user_active = (await db.execute(select(User.is_active).where(User.id == student.user_id))).scalar()
    if not is_enrolled_for(
        student_faculty_id=student.faculty_id,
        student_semester=student.semester,
        user_active=user_active,
        enrollment_start=enrollment_start_for(getattr(student, "enrolled_on", None), getattr(student, "created_at", None)),
        cohort_since=getattr(student, "cohort_since", None),
        session_faculty_id=session.faculty_id,
        session_semester=session.semester,
        session_date=session.session_date,
    ):
        raise _checkin_rejection("not_enrolled", "You are not enrolled in this class", 403, session_id=session.id)
    start_at, end_at = session_start_at(session.session_date, session.start_time), session_end_at(session.session_date, session.end_time)
    status, code = compute_checkin_status(now, start_at, end_at, policy)
    if status is None:
        opens_at, closes_at, _ = checkin_window(start_at, end_at, policy)
        raise _checkin_rejection(
            "window_closed",
            f"Check-in opens at {opens_at.strftime('%H:%M')}" if code == "window_not_open" else "The check-in window for this class has closed",
            409, window_state="not_open" if code == "window_not_open" else "closed",
            opens_at=opens_at.isoformat(), closes_at=closes_at.isoformat(), session_id=session.id,
        )
    existing = (await db.execute(
        select(AttendanceRecord).where(AttendanceRecord.session_id == session.id, AttendanceRecord.student_id == student.id)
    )).scalars().first()
    if existing is not None:
        current = _record_status(existing)
        raise _checkin_rejection("already_recorded", f"Attendance already recorded as {current}", 409,
                                 current_status=current, session_id=session.id, record_id=existing.id)

    source = AttendanceSource.student_face.value
    rec = AttendanceRecord(
        student_id=student.id,
        subject_id=session.subject_id,
        session_id=session.id,
        date=session.session_date,
        time_slot=time_slot_label(session.start_time, session.end_time),
        time_in=now,
        status=AttendanceStatus(status),
        method=AttendanceMethod.face if method == "face" else AttendanceMethod(method_for_source(source)),
        source=source,
        confidence_score=confidence,
        marked_by=student.user_id,
        notes="Self check-in via face recognition",
        excluded_from_metrics=False,
    )
    db.add(rec)
    await db.flush()
    add_audit(db, action=AuditAction.create, session_id=session.id, attendance_record_id=rec.id, student_id=student.id,
              new_status=status, new_source=source, changed_by=student.user_id,
              context={"session_id": session.id, "method": "face", "confidence": float(confidence) if confidence is not None else None})
    held = mark_held(session, now)
    await db.flush()
    return RecordResult(session_id=session.id, created=1, statuses={student.id: status}, record_ids={student.id: rec.id},
                        session_status=session.status, held_transition=held, source=source)


# ============================================================================ metrics exclusion (§13.5)


async def set_metrics_exclusion(
    db,
    *,
    actor: Any,
    record_id: int,
    excluded: bool,
    reason: Optional[str],
    exclusion_reason: Optional[str] = None,
) -> AttendanceRecord:
    """Rule §13.5: admin toggles ``excluded_from_metrics`` with a reason (audited
    ``metrics_exclusion``). ``exclusion_reason`` defaults to ``"admin"`` when excluding.
    Flushes; the caller commits."""
    if actor_role(actor) != "admin":
        raise DomainError("forbidden", "Only an admin can change metrics exclusion", http_status=403)
    reason = (reason or "").strip()
    if not reason:
        raise DomainError("reason_required", "A reason is required", http_status=422)
    rec = (await db.execute(
        select(AttendanceRecord).where(AttendanceRecord.id == record_id).with_for_update()
        .execution_options(populate_existing=True)
    )).scalars().first()
    if rec is None:
        raise DomainError("record_not_found", "Attendance record not found", http_status=404, details={"record_id": record_id})
    old = {"excluded_from_metrics": bool(rec.excluded_from_metrics), "exclusion_reason": rec.exclusion_reason}
    rec.excluded_from_metrics = bool(excluded)
    rec.exclusion_reason = ((exclusion_reason or "admin")[:64]) if excluded else None
    status = _record_status(rec)
    add_audit(db, action=AuditAction.metrics_exclusion, session_id=rec.session_id, attendance_record_id=rec.id,
              student_id=rec.student_id, old_status=status, new_status=status, old_source=rec.source,
              new_source=rec.source, changed_by=actor_user_id(actor), reason=reason,
              context={"old": old, "new": {"excluded_from_metrics": rec.excluded_from_metrics,
                                           "exclusion_reason": rec.exclusion_reason}})
    await db.flush()
    return rec


__all__ = [
    "VALID_WRITE_STATUSES",
    "PROVENANCE_EXCLUSIONS",
    "Entry",
    "EntryPlan",
    "RecordResult",
    "checkin_window",
    "compute_checkin_status",
    "reason_required",
    "source_for_role",
    "method_for_source",
    "normalize_status",
    "plan_entry",
    "requires_confirm_held",
    "record_attendance",
    "find_checkin_session",
    "student_self_checkin",
    "set_metrics_exclusion",
]
