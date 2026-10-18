"""Class sessions: materialization, lifecycle, rosters, unrecorded lists, calendar-event
reconciliation (DOMAIN_RULES §5, amended by §13.1, §13.2, §13.3, §13.4, §13.6, §13.7).

Lifecycle (Rule §5.2 + §13.3)::

    scheduled --(present/late/absent write by teacher|admin|student_face, or register submit)--> held
    scheduled|held --(cancel: owner teacher / admin, reason; or covering calendar event)--> cancelled
    cancelled --(uncancel / event deactivated)--> held if real records or submitted, else scheduled

``excused`` writes never change the session status. *Unrecorded* is derived (Rule §5.2/§13.4,
amended by coordinator decision): ``status = scheduled AND combine_local(session_date, end_time) +
finalize_grace < app_now() AND session_date >= tracking_start_date AND`` the session's cohort
roster is non-empty on that date. Legacy pre-tracking sessions and empty-cohort sessions are
not actionable and never count as unrecorded.

Transactions: every function here flushes but NEVER commits; the route/job that called it
owns the transaction (``await db.commit()``). Functions that mutate a session first take a
row lock (``SELECT ... FOR UPDATE``) on it so recording, cancellation and the finalizer
serialize per session (Rule §13.10).

Weekday mapping and "expected" decisions come only from ``instructional_calendar``; all
"today/now" values come from ``app.core.clock``; ``schedule.is_active`` is never consulted for an
existing session (Rule §13.2).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Any, Iterable, Optional, Sequence

from sqlalchemy import Date, and_, case, cast, func, literal, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.clock import app_now, app_timezone_name, combine_local, local_naive
from app.models import (
    REAL_ATTENDANCE_SOURCES,
    AttendanceAuditLog,
    AttendanceRecord,
    AttendanceStatus,
    AuditAction,
    ClassSchedule,
    ClassSession,
    Faculty,
    SessionKind,
    SessionStatus,
    Student,
    Subject,
    Teacher,
    User,
)
from app.services.attendance_policy import AttendancePolicy, get_attendance_policy
from app.services.domain_errors import DomainError
from app.services.instructional_calendar import (
    KIND_MAKEUP,
    KIND_REGULAR,
    REASON_BETWEEN_TERMS,
    EventInfo,
    ExpectedSession,
    ScheduleInfo,
    compute_expected_sessions,
    event_suppresses,
    expected_sessions_for_range,
    load_events,
    slot_block_reason,
)
from app.services.term_service import load_terms, term_for_date

logger = logging.getLogger(__name__)

HELD_STATUSES = frozenset({"present", "late", "absent"})
_REAL_SOURCES = tuple(str(s) for s in REAL_ATTENDANCE_SOURCES)
EVENT_REVIEW_PREFIX = "Calendar event #"
_MIN_DATE = date(1900, 1, 1)

# ============================================================================ pure helpers


_PROFILE_ROLES = {"admin": "admin", "teacher": "teacher", "student": "student"}


def actor_role(user: Any) -> str:
    """``'admin' | 'teacher' | 'student' | 'system'`` for an actor (``faculty`` role -> ``teacher``).

    Accepts a ``User`` (has ``.role``) or a profile row (``Admin``/``Teacher``/``Student``)."""
    if user is None:
        return "system"
    role = getattr(user, "role", None)
    if role is None:
        return _PROFILE_ROLES.get(type(user).__name__.lower(), "unknown")
    raw = str(getattr(role, "value", role) or "").lower()
    return {"faculty": "teacher", "teacher": "teacher", "admin": "admin", "student": "student"}.get(raw, raw or "unknown")


def actor_user_id(actor: Any) -> Optional[int]:
    """``users.id`` of an actor: a ``User`` (``.id``), a profile row (``.user_id``), or an int."""
    if actor is None:
        return None
    if isinstance(actor, int):
        return actor
    if getattr(actor, "role", None) is not None:
        return getattr(actor, "id", None)
    uid = getattr(actor, "user_id", None)
    return uid if uid is not None else getattr(actor, "id", None)


def session_start_at(session_date: date, start_time: time) -> datetime:
    return combine_local(session_date, start_time)


def session_end_at(session_date: date, end_time: time) -> datetime:
    return combine_local(session_date, end_time)


def finalize_point(session_date: date, end_time: time, grace_minutes: int) -> datetime:
    """``combine_local(session_date, end_time) + finalize_grace`` (Rule §5.2, §7)."""
    return session_end_at(session_date, end_time) + timedelta(minutes=grace_minutes)


def is_past_finalize_point(session_date: date, end_time: time, now: datetime, grace_minutes: int) -> bool:
    """``end + grace <= now`` (Rule §7 eligibility / §13.3 confirm_held)."""
    return finalize_point(session_date, end_time, grace_minutes) <= now


def is_unrecorded(
    status: str,
    session_date: date,
    end_time: time,
    now: datetime,
    grace_minutes: int,
    *,
    tracking_start_date: Optional[date] = None,
    roster_size: Optional[int] = None,
) -> bool:
    """Rule §5.2 (amended): ``status == scheduled`` and ``end + grace < now``; additionally not
    before ``tracking_start_date`` and, when ``roster_size`` is given, a non-empty roster."""
    if tracking_start_date is not None and session_date < tracking_start_date:
        return False
    if roster_size is not None and roster_size <= 0:
        return False
    return str(status) == SessionStatus.scheduled and finalize_point(session_date, end_time, grace_minutes) < now


def is_session_finalizable(
    *,
    status: str,
    finalized_at: Optional[datetime],
    session_date: date,
    end_time: time,
    now: datetime,
    grace_minutes: int,
    in_active_term: bool,
    blocked_by_event: bool = False,
    review_required: bool = False,
    tracking_start_date: Optional[date] = None,
) -> bool:
    """Rule §7 + §13.3: held, unfinalized, not cancelled, date in an active term, not covered by a
    suppressing event, no pending admin review, and ``end + grace <= now``.

    Coordinator decision (§13.3 amended): sessions dated before ``tracking_start_date`` are legacy
    "as recorded" data and are never finalized (no retroactive absences)."""
    return (
        str(status) == SessionStatus.held
        and finalized_at is None
        and (tracking_start_date is None or session_date >= tracking_start_date)
        and in_active_term
        and not blocked_by_event
        and not review_required
        and is_past_finalize_point(session_date, end_time, now, grace_minutes)
    )


def status_after_uncancel(has_real_records: bool, submitted: bool = False) -> str:
    """Rule §5.2 / §13.6: ``held`` if the session has real (present/late/absent) records or was
    submitted, else ``scheduled``."""
    return SessionStatus.held.value if (has_real_records or submitted) else SessionStatus.scheduled.value


def session_is_not_future(session_date: date, start_time: time, now: datetime, opens_before_minutes: int) -> bool:
    """Rule §6.3: writes need ``date <= today`` and, for today, ``now >= start - opens_before``."""
    today = now.date()
    if session_date < today:
        return True
    if session_date > today:
        return False
    return now >= session_start_at(session_date, start_time) - timedelta(minutes=opens_before_minutes)


def within_teacher_window(session_date: date, today: date, window_days: int) -> bool:
    """Rule §6.3: teacher edits allowed until ``session_date + teacher_edit_window_days``."""
    return (today - session_date).days <= window_days


def teacher_owns_session(teacher_id: Optional[int], session_teacher_id: Optional[int], schedule_teacher_id: Optional[int]) -> bool:
    """Rule §6.3: the session's snapshot ``teacher_id`` or its schedule's ``teacher_id``."""
    return teacher_id is not None and teacher_id in (session_teacher_id, schedule_teacher_id)


def session_manage_denial(
    *,
    role: str,
    owns: bool,
    session_date: date,
    today: date,
    window_days: int,
) -> Optional[tuple[str, str]]:
    """Cancel/uncancel permission (Rule §5.2). ``None`` = allowed, else ``(code, message)``.
    Admin: any time. Owner teacher: future sessions, or past sessions inside the edit window."""
    if role == "admin":
        return None
    if role != "teacher":
        return ("forbidden", "Only the session's teacher or an admin can do this")
    if not owns:
        return ("not_session_teacher", "You are not the teacher of this class session")
    if session_date < today and not within_teacher_window(session_date, today, window_days):
        return ("edit_window_closed", f"Sessions older than {window_days} days can only be changed by an admin")
    return None


def enrollment_start_for(enrolled_on: Optional[date], created_at: Optional[datetime]) -> Optional[date]:
    """Python twin of :func:`enrollment_start_sql` (Rule §13.7): ``enrolled_on`` or the
    APP_TIMEZONE date of ``created_at`` (naive values are treated as UTC)."""
    if enrolled_on is not None:
        return enrolled_on
    if created_at is None:
        return None
    if isinstance(created_at, datetime):
        from app.core.clock import to_app_tz

        return to_app_tz(created_at).date()
    return created_at


def is_enrolled_for(
    *,
    student_faculty_id: Optional[int],
    student_semester: Optional[int],
    user_active: Optional[bool],
    enrollment_start: Optional[date],
    cohort_since: Optional[date],
    session_faculty_id: int,
    session_semester: int,
    session_date: date,
) -> bool:
    """Rule §13.7 roster membership: same cohort, active user, and
    ``session_date >= max(enrollment_start, coalesce(cohort_since, enrollment_start))``."""
    if student_faculty_id != session_faculty_id or student_semester != session_semester:
        return False
    if user_active is False:
        return False
    start = enrollment_start or _MIN_DATE
    if cohort_since is not None and cohort_since > start:
        start = cohort_since
    return session_date >= start


def assert_not_before_tracking_start(session_date: date, policy: AttendancePolicy) -> None:
    """Rule §13.1 (+ coordinator decision): no session may be created before
    ``policy.tracking_start_date``. Raises ``DomainError("before_tracking_start", 404)``."""
    start = policy.tracking_start_date
    if start is not None and session_date < start:
        raise DomainError(
            "before_tracking_start",
            f"Attendance tracking starts on {start.isoformat()}; no class sessions exist before that date",
            http_status=404,
            details={"session_date": session_date.isoformat(), "tracking_start_date": start.isoformat()},
        )


def time_slot_label(start_time: time, end_time: time) -> str:
    """``'HH:MM-HH:MM'`` (Rule §6.1 ``time_slot``)."""
    return f"{start_time.strftime('%H:%M')}-{end_time.strftime('%H:%M')}"


def _event_review_reason(ev: EventInfo) -> str:
    return f"{EVENT_REVIEW_PREFIX}{ev.id}: {ev.title or ev.event_type} covers this session but attendance was already recorded; admin decision required"


# ============================================================================ SQL helpers (Rule §13.7)


def enrollment_start_sql():
    """``coalesce(students.enrolled_on, (students.created_at AT TIME ZONE APP_TIMEZONE)::date)``
    (Rule §13.7; the single SQL helper). Students with neither value are treated as enrolled
    since 1900-01-01 (never blocks them)."""
    return func.coalesce(
        Student.enrolled_on,
        cast(func.timezone(app_timezone_name(), Student.created_at), Date),
        literal(_MIN_DATE, Date),
    )


def roster_start_sql():
    """``greatest(enrollment_start, coalesce(cohort_since, enrollment_start))`` (Rule §13.7)."""
    es = enrollment_start_sql()
    return func.greatest(es, func.coalesce(Student.cohort_since, es))


def session_end_sql():
    """``session_date + end_time`` (timestamp without tz = APP_TIMEZONE wall clock)."""
    return ClassSession.session_date + ClassSession.end_time


def roster_conditions(faculty_id: Any, semester: Any, session_date: Any) -> list:
    """WHERE conditions (needs ``JOIN users``) selecting a session cohort's roster (Rule §13.7)."""
    return [
        Student.faculty_id == faculty_id,
        Student.semester == semester,
        func.coalesce(User.is_active, True).is_(True),
        roster_start_sql() <= session_date,
    ]


def cohort_roster_exists_sql():
    """Correlated ``EXISTS``: the session's cohort has an enrolled, active student on its date
    (Rule §13.7 roster rules)."""
    return (
        select(Student.id)
        .join(User, User.id == Student.user_id)
        .where(*roster_conditions(ClassSession.faculty_id, ClassSession.semester, ClassSession.session_date))
        .correlate(ClassSession)
        .exists()
    )


def unrecorded_sql(cutoff_local_naive: datetime, tracking_start_date: Optional[date]):
    """SQL twin of :func:`is_unrecorded` (amended §5.2/§13.4): scheduled, past ``end + grace``
    (``cutoff_local_naive`` = local wall clock of ``now - grace``), on/after
    ``tracking_start_date`` and with a non-empty cohort roster that day."""
    conds = [
        ClassSession.status == SessionStatus.scheduled.value,
        session_end_sql() < cutoff_local_naive,
        cohort_roster_exists_sql(),
    ]
    if tracking_start_date is not None:
        conds.append(ClassSession.session_date >= tracking_start_date)
    return and_(*conds)


async def cohort_roster_starts(db) -> dict[tuple[int, int], date]:
    """``{(faculty_id, semester): earliest roster start}`` over enrolled, active students — one
    grouped query. A cohort has a non-empty roster on ``d`` iff its value is ``<= d``."""
    rows = await db.execute(
        select(Student.faculty_id, Student.semester, func.min(roster_start_sql()))
        .join(User, User.id == Student.user_id)
        .where(Student.faculty_id.isnot(None), func.coalesce(User.is_active, True).is_(True))
        .group_by(Student.faculty_id, Student.semester)
    )
    return {(f, sem): start for f, sem, start in rows.all()}


async def session_roster_ids(db, session: ClassSession) -> set[int]:
    """Student ids enrolled in ``session``'s cohort on its date (Rule §13.7)."""
    rows = await db.execute(
        select(Student.id)
        .join(User, User.id == Student.user_id)
        .where(*roster_conditions(session.faculty_id, session.semester, session.session_date))
    )
    return {r[0] for r in rows.all()}


async def get_teacher_id(db, user: Any) -> Optional[int]:
    """``teachers.id`` for an actor (a ``Teacher`` profile, or a user; None if not a teacher)."""
    if user is not None and type(user).__name__ == "Teacher" and getattr(user, "role", None) is None:
        return user.id
    uid = actor_user_id(user)
    if uid is None:
        return None
    return (await db.execute(select(Teacher.id).where(Teacher.user_id == uid).limit(1))).scalar()


async def schedule_teacher_id(db, session: ClassSession) -> Optional[int]:
    if session.schedule_id is None:
        return None
    return (await db.execute(select(ClassSchedule.teacher_id).where(ClassSchedule.id == session.schedule_id))).scalar()


async def actor_owns_session(db, actor: Any, session: ClassSession) -> bool:
    """Rule §6.3 ownership for a teacher actor."""
    tid = await get_teacher_id(db, actor)
    return teacher_owns_session(tid, session.teacher_id, await schedule_teacher_id(db, session))


async def real_record_counts(db, session_ids: Iterable[int], *, statuses: Optional[Iterable[str]] = None) -> dict[int, int]:
    """Count records written by teacher/admin/student_face per session (optionally by status)."""
    ids = list({int(i) for i in session_ids})
    if not ids:
        return {}
    stmt = (
        select(AttendanceRecord.session_id, func.count(AttendanceRecord.id))
        .where(AttendanceRecord.session_id.in_(ids), AttendanceRecord.source.in_(_REAL_SOURCES))
        .group_by(AttendanceRecord.session_id)
    )
    if statuses is not None:
        stmt = stmt.where(AttendanceRecord.status.in_([AttendanceStatus(s) for s in statuses]))
    return {sid: int(n) for sid, n in (await db.execute(stmt)).all()}


async def lock_session(db, session_id: int) -> ClassSession:
    """``SELECT ... FOR UPDATE`` the session row and refresh the identity-map copy (Rule §13.10)."""
    row = (
        await db.execute(
            select(ClassSession)
            .where(ClassSession.id == session_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalars().first()
    if row is None:
        raise DomainError("session_not_found", f"Class session {session_id} not found", http_status=404,
                          details={"session_id": session_id})
    return row


def add_audit(
    db,
    *,
    action: str,
    session_id: Optional[int] = None,
    attendance_record_id: Optional[int] = None,
    student_id: Optional[int] = None,
    old_status: Optional[str] = None,
    new_status: Optional[str] = None,
    old_source: Optional[str] = None,
    new_source: Optional[str] = None,
    changed_by: Optional[int] = None,
    reason: Optional[str] = None,
    context: Optional[dict] = None,
    changed_at: Optional[datetime] = None,
) -> AttendanceAuditLog:
    """Append an ``attendance_audit_log`` row (Rule §6.2). Added to the session, not flushed."""
    row = AttendanceAuditLog(
        action=str(action),
        session_id=session_id,
        attendance_record_id=attendance_record_id,
        student_id=student_id,
        old_status=old_status,
        new_status=new_status,
        old_source=old_source,
        new_source=new_source,
        changed_by=changed_by,
        reason=reason,
        context=context,
    )
    if changed_at is not None:
        row.changed_at = changed_at
    db.add(row)
    return row


def mark_held(session: ClassSession, now: datetime) -> bool:
    """Move ``scheduled -> held`` and stamp ``attendance_taken_at`` (Rule §5.2). Returns True if the
    status changed. Caller must hold the session row lock."""
    changed = False
    if session.status == SessionStatus.scheduled:
        session.status = SessionStatus.held.value
        changed = True
    if session.attendance_taken_at is None:
        session.attendance_taken_at = now
    return changed


# ============================================================================ materialization (§13.1)


@dataclass
class MaterializeResult:
    created: int = 0
    created_cancelled: int = 0
    expected: int = 0
    skipped_before_tracking: int = 0
    skipped_empty_cohort: int = 0
    created_ids: list[int] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "created": self.created,
            "created_cancelled": self.created_cancelled,
            "expected": self.expected,
            "skipped_before_tracking": self.skipped_before_tracking,
            "skipped_empty_cohort": self.skipped_empty_cohort,
        }


async def materialize_expected(
    db,
    expected: Sequence[ExpectedSession],
    *,
    tracking_start_date: Optional[date] = None,
    now: Optional[datetime] = None,
) -> MaterializeResult:
    """Idempotently insert expected sessions (Rule §13.1).

    ``INSERT ... ON CONFLICT DO NOTHING`` covers both ``uq_class_session_slot`` and the partial
    ``(schedule_id, session_date)`` index, so concurrent materializers and same-day schedule
    time edits never create duplicates. Sessions covered by an active CANCELLED_CLASS event are
    created as ``cancelled`` with ``cancelled_by_event_id`` (Rule §13.6). Never creates sessions
    dated before ``tracking_start_date``. Flushes; does not commit.
    """
    now = now or app_now()
    result = MaterializeResult(expected=len(expected))
    rows: dict[tuple, dict[str, Any]] = {}
    for e in expected:
        if tracking_start_date is not None and e.session_date < tracking_start_date:
            result.skipped_before_tracking += 1
            continue
        key = (e.subject_id, e.faculty_id, e.semester, e.session_date, e.start_time)
        if key in rows:
            continue
        row = {
            "schedule_id": e.schedule_id,
            "kind": SessionKind.regular.value,
            "subject_id": e.subject_id,
            "faculty_id": e.faculty_id,
            "semester": e.semester,
            "term_id": e.term_id,
            "session_date": e.session_date,
            "start_time": e.start_time,
            "end_time": e.end_time,
            "teacher_id": e.teacher_id,
            "status": SessionStatus.scheduled.value,
            "cancelled_at": None,
            "cancellation_reason": None,
            "cancelled_by_event_id": None,
        }
        if e.is_cancelled:
            row.update(
                status=SessionStatus.cancelled.value,
                cancelled_at=now,
                cancellation_reason=e.cancellation_reason,
                cancelled_by_event_id=e.cancelled_by_event_id,
            )
        rows[key] = row
    values = list(rows.values())
    for i in range(0, len(values), 500):
        chunk = values[i:i + 500]
        res = await db.execute(
            pg_insert(ClassSession)
            .values(chunk)
            .on_conflict_do_nothing()
            .returning(ClassSession.id, ClassSession.status, ClassSession.cancelled_by_event_id)
        )
        for sid, status, event_id in res.all():
            result.created += 1
            result.created_ids.append(sid)
            if status == SessionStatus.cancelled:
                result.created_cancelled += 1
                add_audit(db, action=AuditAction.session_cancelled, session_id=sid, new_status=SessionStatus.cancelled.value,
                          reason="Calendar event covers this session", context={"event_id": event_id, "at_materialization": True})
    if result.created_cancelled:
        await db.flush()
    return result


async def materialize_sessions(
    db,
    start: date,
    end: date,
    *,
    policy: Optional[AttendancePolicy] = None,
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    subject_id: Optional[int] = None,
    now: Optional[datetime] = None,
    skip_empty_cohorts: bool = False,
) -> MaterializeResult:
    """Materialize every expected session in ``[start, end]`` (Rule §13.1; batch queries).

    ``skip_empty_cohorts=True`` (the scheduler's bulk run; coordinator decision) skips cohorts
    (faculty + semester) with no enrolled, active student on the session date — one grouped
    roster query per call. Explicit requests (``ensure_sessions_for``) leave it off."""
    policy = policy or await get_attendance_policy(db)
    expected = await expected_sessions_for_range(
        db, start, end, faculty_id=faculty_id, semester=semester, subject_id=subject_id, policy=policy
    )
    skipped = 0
    if skip_empty_cohorts and expected:
        starts = await cohort_roster_starts(db)
        kept = []
        for e in expected:
            first = starts.get((e.faculty_id, e.semester))
            if first is not None and first <= e.session_date:
                kept.append(e)
            else:
                skipped += 1
        expected = kept
    result = await materialize_expected(db, expected, tracking_start_date=policy.tracking_start_date, now=now)
    result.skipped_empty_cohort = skipped
    result.expected += skipped
    return result


async def ensure_sessions_for(
    db,
    *,
    session_date: date,
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    subject_id: Optional[int] = None,
    policy: Optional[AttendancePolicy] = None,
    include_cancelled: bool = True,
) -> list[ClassSession]:
    """Materialize (idempotently) and return the sessions of ``session_date`` (Rule §13.1).

    Used by "today's classes", the teacher register and face check-in. Returns regular and
    make-up sessions matching the filters, ordered by start time. Flushes; does not commit.
    """
    await materialize_sessions(db, session_date, session_date, policy=policy, faculty_id=faculty_id,
                               semester=semester, subject_id=subject_id)
    stmt = select(ClassSession).where(ClassSession.session_date == session_date)
    if faculty_id is not None:
        stmt = stmt.where(ClassSession.faculty_id == faculty_id)
    if semester is not None:
        stmt = stmt.where(ClassSession.semester == semester)
    if subject_id is not None:
        stmt = stmt.where(ClassSession.subject_id == subject_id)
    if not include_cancelled:
        stmt = stmt.where(ClassSession.status != SessionStatus.cancelled.value)
    stmt = stmt.order_by(ClassSession.start_time, ClassSession.subject_id, ClassSession.id)
    return list((await db.execute(stmt)).scalars().all())


async def _find_session_for_schedule(db, schedule: Any, session_date: date) -> Optional[ClassSession]:
    rows = (await db.execute(
        select(ClassSession).where(
            ClassSession.session_date == session_date,
            or_(
                and_(ClassSession.schedule_id == schedule.id, ClassSession.kind == SessionKind.regular.value),
                and_(
                    ClassSession.subject_id == schedule.subject_id,
                    ClassSession.faculty_id == schedule.faculty_id,
                    ClassSession.semester == schedule.semester,
                    ClassSession.start_time == schedule.start_time,
                ),
            ),
        )
    )).scalars().all()
    if not rows:
        return None
    # Prefer the row materialized from this schedule (it survives same-day time edits).
    rows = sorted(rows, key=lambda s: (s.schedule_id != schedule.id, s.id))
    return rows[0]


async def get_or_create_session(
    db,
    *,
    schedule: Any,
    session_date: date,
    allow_unexpected: bool = False,
    policy: Optional[AttendancePolicy] = None,
) -> ClassSession:
    """Rule §5.3: the session of ``schedule`` on ``session_date``, created race-safely.

    Raises ``DomainError("not_expected", 422, details={"reason": ...})`` when the schedule does
    not yield a session that day (Rule §4), unless ``allow_unexpected`` (admin), and
    ``DomainError("before_tracking_start", 404)`` for a date before ``tracking_start_date``
    (Rule §13.1; existing sessions are still returned). Prefer
    :func:`create_makeup_session` for genuinely extra classes. Flushes; does not commit.
    """
    existing = await _find_session_for_schedule(db, schedule, session_date)
    if existing is not None:
        return existing
    policy = policy or await get_attendance_policy(db)
    assert_not_before_tracking_start(session_date, policy)
    terms = await load_terms(db)
    events = await load_events(db, session_date, session_date)
    info = ScheduleInfo.from_model(schedule)
    expected = compute_expected_sessions(session_date, [info], terms, events, policy)
    if not expected:
        term = term_for_date(terms, session_date)
        reason, _ = slot_block_reason(
            session_date, faculty_id=info.faculty_id, subject_id=info.subject_id, start_time=info.start_time,
            end_time=info.end_time, term=term, events=events, policy=policy,
        )
        if info.weekday != session_date.weekday():
            reason = "wrong_weekday"
        elif not info.is_active:
            reason = "schedule_inactive"
        if not allow_unexpected:
            raise DomainError("not_expected", "This class is not scheduled to meet on that date", http_status=422,
                              details={"reason": reason, "schedule_id": info.id, "session_date": session_date.isoformat()})
        term = term_for_date(terms, session_date)
        expected = [ExpectedSession(
            schedule_id=info.id, subject_id=info.subject_id, faculty_id=info.faculty_id, semester=info.semester,
            session_date=session_date, start_time=info.start_time, end_time=info.end_time,
            teacher_id=info.teacher_id, term_id=term.id if term else None,
        )]
    await materialize_expected(db, expected, tracking_start_date=policy.tracking_start_date)
    created = await _find_session_for_schedule(db, schedule, session_date)
    if created is None:  # pragma: no cover - conflict on a slot owned by a different schedule row
        raise DomainError("session_conflict", "Another session already occupies this slot", http_status=409)
    return created


def _slot_dict(s: ClassSession) -> dict[str, Any]:
    return {
        "session_id": s.id,
        "schedule_id": s.schedule_id,
        "kind": s.kind,
        "status": s.status,
        "start_time": s.start_time.strftime("%H:%M"),
        "end_time": s.end_time.strftime("%H:%M"),
    }


async def resolve_session_for(
    db,
    *,
    subject_id: int,
    faculty_id: int,
    semester: int,
    session_date: date,
    start_time: Optional[time] = None,
    schedule_id: Optional[int] = None,
    policy: Optional[AttendancePolicy] = None,
) -> ClassSession:
    """Rule §5.3: find/create the session for a subject+cohort+date. Never guesses: several
    sessions that day without ``start_time``/``schedule_id`` -> ``DomainError("ambiguous_session",
    409, details={"slots": [...]})``; none -> ``session_not_found`` (404). Flushes only."""
    sessions = await ensure_sessions_for(db, session_date=session_date, faculty_id=faculty_id, semester=semester,
                                         subject_id=subject_id, policy=policy)
    candidates = sessions
    if schedule_id is not None:
        candidates = [s for s in candidates if s.schedule_id == schedule_id]
    if start_time is not None:
        candidates = [s for s in candidates if s.start_time.replace(tzinfo=None) == start_time.replace(tzinfo=None)]
    if not candidates:
        raise DomainError("session_not_found", "No class session for that subject and cohort on this date",
                          http_status=404, details={"subject_id": subject_id, "faculty_id": faculty_id, "semester": semester,
                                                    "session_date": session_date.isoformat(),
                                                    "slots": [_slot_dict(s) for s in sessions]})
    if len(candidates) > 1:
        raise DomainError("ambiguous_session", "Several class sessions match; specify the time slot",
                          http_status=409, details={"slots": [_slot_dict(s) for s in candidates]})
    return candidates[0]


# ============================================================================ make-up sessions (§13.2)


async def create_makeup_session(
    db,
    *,
    actor: Any,
    subject_id: int,
    faculty_id: int,
    semester: int,
    session_date: date,
    start_time: time,
    end_time: time,
    teacher_id: Optional[int] = None,
    reason: Optional[str] = None,
    policy: Optional[AttendancePolicy] = None,
    now: Optional[datetime] = None,
) -> ClassSession:
    """Rule §13.2: create a ``kind='makeup'`` session (admin, or a teacher of that subject+cohort).

    Must be on/after ``tracking_start_date`` (``before_tracking_start``), inside an active term
    and not covered by a holiday / class cancellation for the cohort; need not be "expected"
    (weekly off days and exam windows do not block it). Rejects the subject's existing slot at
    the same start time (``slot_taken``, 409, any status) and overlaps with the cohort's other
    non-cancelled sessions (``session_overlap``). Flushes; does not commit.
    """
    now = now or app_now()
    policy = policy or await get_attendance_policy(db)
    reason = (reason or "").strip()
    role = actor_role(actor)
    if not reason:
        raise DomainError("reason_required", "A reason is required for a make-up session", http_status=422)
    if not end_time > start_time:
        raise DomainError("invalid_time_range", "end_time must be after start_time", http_status=422)
    assert_not_before_tracking_start(session_date, policy)
    if role == "teacher":
        own_tid = await get_teacher_id(db, actor)
        teaches = own_tid is not None and (await db.execute(
            select(ClassSchedule.id).where(
                ClassSchedule.teacher_id == own_tid,
                ClassSchedule.subject_id == subject_id,
                ClassSchedule.faculty_id == faculty_id,
                ClassSchedule.semester == semester,
            ).limit(1)
        )).first() is not None
        if not teaches:
            raise DomainError("not_subject_teacher", "You do not teach this subject for this cohort", http_status=403)
        if teacher_id is not None and teacher_id != own_tid:
            raise DomainError("forbidden", "Teachers can only create make-up sessions for themselves", http_status=403)
        teacher_id = own_tid
    elif role != "admin":
        raise DomainError("forbidden", "Only admins and the subject's teacher can create make-up sessions", http_status=403)

    terms = await load_terms(db)
    term = term_for_date(terms, session_date)
    events = await load_events(db, session_date, session_date)
    block, event = slot_block_reason(
        session_date, faculty_id=faculty_id, subject_id=subject_id, start_time=start_time, end_time=end_time,
        term=term, events=events, policy=policy, kind=KIND_MAKEUP,
    )
    if block == REASON_BETWEEN_TERMS:
        raise DomainError("between_terms", "Make-up sessions must fall inside an active term", http_status=422)
    if block is not None:
        raise DomainError("blocked_by_event", f"A calendar event blocks this slot: {event.title if event else block}",
                          http_status=409, details={"reason": block, "event_id": event.id if event else None})

    taken = (await db.execute(
        select(ClassSession.id, ClassSession.status).where(
            ClassSession.subject_id == subject_id,
            ClassSession.faculty_id == faculty_id,
            ClassSession.semester == semester,
            ClassSession.session_date == session_date,
            ClassSession.start_time == start_time,
        ).limit(1)
    )).first()
    if taken is not None:  # uq_class_session_slot (any status, cancelled included)
        raise DomainError("slot_taken", "A session of this subject already starts at that time on that date",
                          http_status=409, details={"session_id": taken[0], "status": taken[1]})
    overlap = (await db.execute(
        select(ClassSession.id, ClassSession.start_time, ClassSession.end_time).where(
            ClassSession.faculty_id == faculty_id,
            ClassSession.semester == semester,
            ClassSession.session_date == session_date,
            ClassSession.status != SessionStatus.cancelled.value,
            ClassSession.start_time < end_time,
            ClassSession.end_time > start_time,
        )
    )).first()
    if overlap is not None:
        raise DomainError("session_overlap", "The cohort already has a class at that time", http_status=409,
                          details={"session_id": overlap[0]})

    session = ClassSession(
        schedule_id=None,
        kind=SessionKind.makeup.value,
        subject_id=subject_id,
        faculty_id=faculty_id,
        semester=semester,
        term_id=term.id if term else None,
        session_date=session_date,
        start_time=start_time,
        end_time=end_time,
        teacher_id=teacher_id,
        status=SessionStatus.scheduled.value,
    )
    db.add(session)
    await db.flush()
    add_audit(db, action="session_created", session_id=session.id, new_status=session.status,
              changed_by=actor_user_id(actor), reason=reason, context={"kind": "makeup"})
    await db.flush()
    return session


# ============================================================================ cancel / uncancel / submit


async def cancel_session(
    db,
    *,
    session: ClassSession,
    actor: Any,
    reason: Optional[str],
    policy: Optional[AttendancePolicy] = None,
    now: Optional[datetime] = None,
) -> ClassSession:
    """Rule §5.2: ``scheduled|held -> cancelled`` (owner teacher within window / admin; reason
    required). Existing records are kept untouched and drop out of metrics while cancelled.
    Audited (``session_cancelled``). Flushes; does not commit."""
    now = now or app_now()
    policy = policy or await get_attendance_policy(db)
    reason = (reason or "").strip()
    if not reason:
        raise DomainError("reason_required", "A reason is required to cancel a class", http_status=422)
    session = await lock_session(db, session.id)
    if session.status == SessionStatus.cancelled:
        raise DomainError("already_cancelled", "This class session is already cancelled", http_status=409,
                          details={"session_id": session.id})
    role = actor_role(actor)
    owns = role == "teacher" and await actor_owns_session(db, actor, session)
    denial = session_manage_denial(role=role, owns=owns, session_date=session.session_date, today=now.date(),
                                   window_days=policy.teacher_edit_window_days)
    if denial:
        raise DomainError(denial[0], denial[1], http_status=403, details={"session_id": session.id})
    old = session.status
    session.status = SessionStatus.cancelled.value
    session.cancelled_at = now
    session.cancelled_by = actor_user_id(actor)
    session.cancellation_reason = reason
    session.cancelled_by_event_id = None
    add_audit(db, action=AuditAction.session_cancelled, session_id=session.id, old_status=old,
              new_status=session.status, changed_by=actor_user_id(actor), reason=reason)
    await db.flush()
    return session


async def _restored_status(db, session: ClassSession) -> str:
    counts = await real_record_counts(db, [session.id], statuses=HELD_STATUSES)
    return status_after_uncancel(counts.get(session.id, 0) > 0, session.submitted_at is not None)


async def uncancel_session(
    db,
    *,
    session: ClassSession,
    actor: Any,
    reason: Optional[str],
    policy: Optional[AttendancePolicy] = None,
    now: Optional[datetime] = None,
) -> ClassSession:
    """Rule §5.2: ``cancelled -> held`` (real records or submitted) or ``scheduled``; admin or owner
    teacher (teacher only inside the edit window for past sessions); reason required; audited
    (``session_uncancelled``). Flushes; does not commit."""
    now = now or app_now()
    policy = policy or await get_attendance_policy(db)
    reason = (reason or "").strip()
    if not reason:
        raise DomainError("reason_required", "A reason is required to restore a cancelled class", http_status=422)
    session = await lock_session(db, session.id)
    if session.status != SessionStatus.cancelled:
        raise DomainError("not_cancelled", "This class session is not cancelled", http_status=409,
                          details={"session_id": session.id})
    role = actor_role(actor)
    owns = role == "teacher" and await actor_owns_session(db, actor, session)
    denial = session_manage_denial(role=role, owns=owns, session_date=session.session_date, today=now.date(),
                                   window_days=policy.teacher_edit_window_days)
    if denial:
        raise DomainError(denial[0], denial[1], http_status=403, details={"session_id": session.id})
    new_status = await _restored_status(db, session)
    context = {"event_id": session.cancelled_by_event_id} if session.cancelled_by_event_id else None
    session.status = new_status
    session.cancelled_at = None
    session.cancelled_by = None
    session.cancellation_reason = None
    session.cancelled_by_event_id = None
    add_audit(db, action=AuditAction.session_uncancelled, session_id=session.id, old_status=SessionStatus.cancelled.value,
              new_status=new_status, changed_by=actor_user_id(actor), reason=reason, context=context)
    await db.flush()
    return session


async def clear_review(db, *, session: ClassSession, actor: Any, reason: Optional[str]) -> ClassSession:
    """Rule §13.6: an admin confirms that a session flagged ``review_required`` (a calendar event
    covers a session that already has real records) should keep its current status. Clears the
    flag; reason required; audited (``review_cleared``). Flushes; does not commit."""
    reason = (reason or "").strip()
    if not reason:
        raise DomainError("reason_required", "A reason is required to clear a review flag", http_status=422)
    if actor_role(actor) != "admin":
        raise DomainError("forbidden", "Only administrators can clear review flags", http_status=403,
                          details={"session_id": session.id})
    session = await lock_session(db, session.id)
    if not session.review_required:
        raise DomainError("not_flagged", "This class session is not flagged for review", http_status=409,
                          details={"session_id": session.id})
    previous = session.review_reason
    session.review_required = False
    session.review_reason = None
    add_audit(db, action=AuditAction.review_cleared, session_id=session.id, old_status=session.status,
              new_status=session.status, changed_by=actor_user_id(actor), reason=reason,
              context={"previous_review_reason": previous})
    await db.flush()
    return session


def mark_submitted(db, *, session: ClassSession, actor: Any, now: Optional[datetime] = None,
                   context: Optional[dict] = None) -> None:
    """Rule §13.3 register submission: ``submitted_at/submitted_by``, ``scheduled -> held``,
    audit ``session_submitted``. Caller must hold the session row lock (the recording service
    does) and flush/commit."""
    now = now or app_now()
    old = session.status
    session.submitted_at = now
    session.submitted_by = actor_user_id(actor)
    mark_held(session, now)
    add_audit(db, action=AuditAction.session_submitted, session_id=session.id, old_status=old,
              new_status=session.status, changed_by=actor_user_id(actor), context=context)


# ============================================================================ unrecorded / review (§13.4)


class UnrecordedPage(list):
    """A page of unrecorded/review sessions (a ``list`` of dicts) carrying ``total`` (true count
    of all matches), ``limit``, ``offset`` and ``has_more``."""

    def __init__(self, items: Iterable[dict[str, Any]] = (), *, total: int = 0, limit: Optional[int] = None,
                 offset: int = 0) -> None:
        super().__init__(items)
        self.total = int(total)
        self.limit = limit
        self.offset = int(offset)

    @property
    def has_more(self) -> bool:
        return self.offset + len(self) < self.total


def _unrecorded_filters(
    *,
    cutoff: datetime,
    policy: AttendancePolicy,
    include_review: bool,
    start: Optional[date],
    end: Optional[date],
    faculty_id: Optional[int],
    semester: Optional[int],
    teacher_id: Optional[int],
) -> tuple[Any, list]:
    unrecorded_cond = unrecorded_sql(cutoff, policy.tracking_start_date)
    cond = unrecorded_cond
    if include_review:
        cond = or_(unrecorded_cond, and_(ClassSession.review_required.is_(True),
                                         ClassSession.status != SessionStatus.cancelled.value))
    where = [cond]
    if start is not None:
        where.append(ClassSession.session_date >= start)
    if end is not None:
        where.append(ClassSession.session_date <= end)
    if faculty_id is not None:
        where.append(ClassSession.faculty_id == faculty_id)
    if semester is not None:
        where.append(ClassSession.semester == semester)
    if teacher_id is not None:
        where.append(or_(ClassSession.teacher_id == teacher_id, ClassSchedule.teacher_id == teacher_id))
    return unrecorded_cond, where


async def list_unrecorded_sessions(
    db,
    *,
    start: Optional[date] = None,
    end: Optional[date] = None,
    teacher_id: Optional[int] = None,
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    include_review: bool = True,
    policy: Optional[AttendancePolicy] = None,
    now: Optional[datetime] = None,
    limit: Optional[int] = 500,
    offset: int = 0,
) -> UnrecordedPage:
    """Rule §5.2/§13.4 (amended): actionable unrecorded sessions (see :func:`unrecorded_sql`:
    scheduled, past ``end + grace``, on/after ``tracking_start_date``, non-empty cohort roster)
    plus, if ``include_review``, non-cancelled sessions with ``review_required``. ``teacher_id``
    limits to a teacher's sessions (snapshot or schedule teacher). Newest first, with age.

    Returns an :class:`UnrecordedPage` (a list) with ``total`` from a separate COUNT query."""
    now = now or app_now()
    policy = policy or await get_attendance_policy(db)
    cutoff = local_naive(now - timedelta(minutes=policy.finalize_grace_minutes))
    unrecorded_cond, where = _unrecorded_filters(
        cutoff=cutoff, policy=policy, include_review=include_review, start=start, end=end,
        faculty_id=faculty_id, semester=semester, teacher_id=teacher_id)
    total = int((await db.execute(
        select(func.count(ClassSession.id)).select_from(ClassSession)
        .outerjoin(ClassSchedule, ClassSchedule.id == ClassSession.schedule_id)
        .where(*where)
    )).scalar() or 0)
    stmt = (
        select(ClassSession, Subject.name, Subject.code, Faculty.name, ClassSchedule.teacher_id,
               case((unrecorded_cond, True), else_=False))
        .join(Subject, Subject.id == ClassSession.subject_id)
        .join(Faculty, Faculty.id == ClassSession.faculty_id)
        .outerjoin(ClassSchedule, ClassSchedule.id == ClassSession.schedule_id)
        .where(*where)
        .order_by(ClassSession.session_date.desc(), ClassSession.start_time, ClassSession.id)
        .offset(max(int(offset), 0))
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    out = []
    today = now.date()
    for s, subj_name, subj_code, fac_name, sched_teacher, unrecorded in (await db.execute(stmt)).all():
        ended = finalize_point(s.session_date, s.end_time, 0)
        out.append({
            "session_id": s.id,
            "id": s.id,
            "session_date": s.session_date.isoformat(),
            "start_time": s.start_time.strftime("%H:%M"),
            "end_time": s.end_time.strftime("%H:%M"),
            "kind": s.kind,
            "status": s.status,
            "subject_id": s.subject_id,
            "subject_name": subj_name,
            "subject_code": subj_code,
            "faculty_id": s.faculty_id,
            "faculty_name": fac_name,
            "semester": s.semester,
            "teacher_id": s.teacher_id if s.teacher_id is not None else sched_teacher,
            "has_teacher": (s.teacher_id or sched_teacher) is not None,
            "unrecorded": bool(unrecorded),
            "review_required": bool(s.review_required),
            "review_reason": s.review_reason,
            "age_days": (today - s.session_date).days,
            "age_hours": round(max((now - ended).total_seconds(), 0) / 3600.0, 1),
        })
    return UnrecordedPage(out, total=total, limit=limit, offset=offset)


async def count_unrecorded_sessions(
    db, *, policy: Optional[AttendancePolicy] = None, now: Optional[datetime] = None,
    teacher_id: Optional[int] = None,
) -> int:
    """Number of actionable unrecorded sessions (amended Rule §5.2), optionally for one teacher."""
    now = now or app_now()
    policy = policy or await get_attendance_policy(db)
    cutoff = local_naive(now - timedelta(minutes=policy.finalize_grace_minutes))
    stmt = select(func.count(ClassSession.id)).select_from(ClassSession).where(
        unrecorded_sql(cutoff, policy.tracking_start_date))
    if teacher_id is not None:
        stmt = stmt.outerjoin(ClassSchedule, ClassSchedule.id == ClassSession.schedule_id).where(
            or_(ClassSession.teacher_id == teacher_id, ClassSchedule.teacher_id == teacher_id))
    return int((await db.execute(stmt)).scalar() or 0)


async def count_schedules_without_teacher(db) -> int:
    """Active timetable rows with no teacher (Rule §13.4 setup warning)."""
    return int((await db.execute(
        select(func.count(ClassSchedule.id)).where(ClassSchedule.is_active.isnot(False), ClassSchedule.teacher_id.is_(None))
    )).scalar() or 0)


# ============================================================================ calendar events (§13.6)


def _as_event_info(event: Any) -> EventInfo:
    return event if isinstance(event, EventInfo) else EventInfo.from_model(event)


def event_drives_sessions(ev: EventInfo, policy: AttendancePolicy) -> bool:
    """Rule §13.6: HOLIDAY, CANCELLED_CLASS, and EXAM when exam suspension applies."""
    if ev.event_type in ("holiday", "cancelled_class"):
        return True
    return ev.event_type == "exam" and policy.exam_days_suspend_classes and not ev.attendance_required


def _covers_session(ev: EventInfo, s: ClassSession, policy: AttendancePolicy) -> bool:
    return event_suppresses(ev, s.session_date, faculty_id=s.faculty_id, subject_id=s.subject_id,
                            start_time=s.start_time, end_time=s.end_time, policy=policy,
                            kind=s.kind or KIND_REGULAR)


async def _restore_for_event(
    db,
    ev: EventInfo,
    actor: Any,
    policy: AttendancePolicy,
    now: datetime,
    *,
    keep_if_covered: bool,
) -> dict[str, int]:
    """Undo this event's effect on sessions it no longer covers (or on all of them)."""
    actor_id = actor_user_id(actor)
    affected = list((await db.execute(
        select(ClassSession).where(or_(
            ClassSession.cancelled_by_event_id == ev.id,
            and_(ClassSession.review_required.is_(True),
                 ClassSession.review_reason.like(f"{EVENT_REVIEW_PREFIX}{ev.id}:%")),
        )).with_for_update().execution_options(populate_existing=True)
    )).scalars().all())
    stats = {"restored": 0, "reassigned": 0, "review_cleared": 0}
    if not affected:
        return stats
    if keep_if_covered and event_drives_sessions(ev, policy) and ev.is_active:
        affected = [s for s in affected if not _covers_session(ev, s, policy)]
        if not affected:
            return stats
    lo = min(s.session_date for s in affected)
    hi = max(s.session_date for s in affected)
    others = [o for o in await load_events(db, lo, hi) if o.id != ev.id and event_drives_sessions(o, policy)]
    held_counts = await real_record_counts(db, [s.id for s in affected], statuses=HELD_STATUSES)
    any_counts = await real_record_counts(db, [s.id for s in affected])
    for s in affected:
        other = next((o for o in others if _covers_session(o, s, policy)), None)
        if s.status == SessionStatus.cancelled and s.cancelled_by_event_id == ev.id:
            if other is not None and not any_counts.get(s.id):
                s.cancelled_by_event_id = other.id
                s.cancellation_reason = f"Calendar event: {other.title}"
                stats["reassigned"] += 1
                continue
            new_status = status_after_uncancel(held_counts.get(s.id, 0) > 0, s.submitted_at is not None)
            s.status = new_status
            s.cancelled_at = None
            s.cancelled_by = None
            s.cancellation_reason = None
            s.cancelled_by_event_id = None
            add_audit(db, action=AuditAction.session_uncancelled, session_id=s.id, old_status=SessionStatus.cancelled.value,
                      new_status=new_status, changed_by=actor_id, reason=f"Calendar event no longer applies: {ev.title}",
                      context={"event_id": ev.id})
            stats["restored"] += 1
        elif s.review_required and (s.review_reason or "").startswith(f"{EVENT_REVIEW_PREFIX}{ev.id}:"):
            if other is not None:
                s.review_reason = _event_review_reason(other)
            else:
                s.review_required = False
                s.review_reason = None
            stats["review_cleared"] += 1
    await db.flush()
    return stats


async def reconcile_sessions_for_event(
    db,
    event: Any,
    actor: Any = None,
    *,
    policy: Optional[AttendancePolicy] = None,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    """Rule §13.6: apply a created/edited/(re)activated calendar event to the sessions it covers,
    in the caller's transaction.

    * First undoes this event's earlier effect on sessions it no longer covers (date/scope
      edits) — or on all of them if the event is inactive or no longer suppresses classes.
    * Covered, non-cancelled sessions with no teacher/admin/student_face records ->
      ``cancelled`` with ``cancelled_by_event_id`` and reason ``"Calendar event: <title>"``
      (audited ``session_cancelled``, ``context.event_id``).
    * Covered sessions that have real records keep their status and get ``review_required`` +
      ``review_reason`` (prefixed ``"Calendar event #<id>:"``) for an admin decision.
    Call it after flushing the event. Flushes; does not commit.
    """
    now = now or app_now()
    policy = policy or await get_attendance_policy(db)
    ev = _as_event_info(event)
    if not ev.is_active or not event_drives_sessions(ev, policy):
        restored = await _restore_for_event(db, ev, actor, policy, now, keep_if_covered=False)
        return {"event_id": ev.id, "cancelled": 0, "review_required": 0, **restored}
    restored = await _restore_for_event(db, ev, actor, policy, now, keep_if_covered=True)

    stmt = select(ClassSession).where(
        ClassSession.session_date >= ev.start_date,
        ClassSession.session_date <= ev.last_date,
        ClassSession.status != SessionStatus.cancelled.value,
    )
    if ev.faculty_id is not None:
        stmt = stmt.where(ClassSession.faculty_id == ev.faculty_id)
    if ev.subject_id is not None:
        stmt = stmt.where(ClassSession.subject_id == ev.subject_id)
    candidates = list((await db.execute(
        stmt.with_for_update().execution_options(populate_existing=True)
    )).scalars().all())
    covered = [s for s in candidates if _covers_session(ev, s, policy)]
    counts = await real_record_counts(db, [s.id for s in covered])
    actor_id = actor_user_id(actor)
    cancelled_ids: list[int] = []
    review_ids: list[int] = []
    for s in covered:
        if counts.get(s.id):
            if not s.review_required:
                s.review_required = True
                s.review_reason = _event_review_reason(ev)
                review_ids.append(s.id)
            continue
        old = s.status
        s.status = SessionStatus.cancelled.value
        s.cancelled_at = now
        s.cancelled_by = actor_id
        s.cancellation_reason = f"Calendar event: {ev.title}"
        s.cancelled_by_event_id = ev.id
        add_audit(db, action=AuditAction.session_cancelled, session_id=s.id, old_status=old,
                  new_status=s.status, changed_by=actor_id, reason=s.cancellation_reason,
                  context={"event_id": ev.id})
        cancelled_ids.append(s.id)
    await db.flush()
    return {
        "event_id": ev.id,
        "cancelled": len(cancelled_ids),
        "review_required": len(review_ids),
        "cancelled_session_ids": cancelled_ids,
        "review_session_ids": review_ids,
        **restored,
    }


async def restore_sessions_for_event(
    db,
    event: Any,
    actor: Any = None,
    *,
    policy: Optional[AttendancePolicy] = None,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    """Rule §13.6: the event was deactivated/soft-deleted — restore every session it cancelled to
    ``held`` (real records or submitted) / ``scheduled`` and clear the review flags it set.
    Sessions still covered by ANOTHER active suppressing event stay cancelled (re-attributed to
    that event). Call BEFORE hard-deleting an event (the FK would otherwise be nulled).
    Audited ``session_uncancelled`` with ``context.event_id``. Flushes; does not commit."""
    now = now or app_now()
    policy = policy or await get_attendance_policy(db)
    ev = _as_event_info(event)
    restored = await _restore_for_event(db, ev, actor, policy, now, keep_if_covered=False)
    return {"event_id": ev.id, **restored}


__all__ = [
    "HELD_STATUSES",
    "actor_role",
    "actor_user_id",
    "session_start_at",
    "session_end_at",
    "finalize_point",
    "is_past_finalize_point",
    "is_unrecorded",
    "is_session_finalizable",
    "status_after_uncancel",
    "session_is_not_future",
    "within_teacher_window",
    "teacher_owns_session",
    "session_manage_denial",
    "enrollment_start_for",
    "is_enrolled_for",
    "assert_not_before_tracking_start",
    "time_slot_label",
    "enrollment_start_sql",
    "roster_start_sql",
    "session_end_sql",
    "roster_conditions",
    "session_roster_ids",
    "get_teacher_id",
    "schedule_teacher_id",
    "actor_owns_session",
    "real_record_counts",
    "lock_session",
    "add_audit",
    "mark_held",
    "MaterializeResult",
    "materialize_expected",
    "materialize_sessions",
    "ensure_sessions_for",
    "get_or_create_session",
    "resolve_session_for",
    "create_makeup_session",
    "cancel_session",
    "uncancel_session",
    "mark_submitted",
    "cohort_roster_exists_sql",
    "unrecorded_sql",
    "cohort_roster_starts",
    "UnrecordedPage",
    "list_unrecorded_sessions",
    "count_unrecorded_sessions",
    "count_schedules_without_teacher",
    "event_drives_sessions",
    "reconcile_sessions_for_event",
    "restore_sessions_for_event",
]
