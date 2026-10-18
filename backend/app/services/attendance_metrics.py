"""Attendance metrics — the ONLY percentage implementation (DOMAIN_RULES §8, amended by
§13.4, §13.5, §13.7, §13.12).

Definitions (window W = [max(term.start, enrollment_start), min(term.end, as_of)]):

* countable record: has a session in W with ``session.status = 'held'``, record status in
  present/late/absent and ``excluded_from_metrics = false``. Excused, cancelled-session,
  scheduled-session and legacy (``session_id IS NULL``) records never count.
* attended = present (+ late when ``policy.late_counts_as_attended``); considered = countable.
* per-subject % = attended/considered; overall = Σattended/Σconsidered (session-weighted).
  considered = 0 -> ``percentage = None`` (legacy numeric fields stay 0, Rule §13.12).
* eligibility on the exact fraction (no rounding); band from policy bands (half-open) on the
  exact fraction; rounding to 2 decimals is display-only.
* unrecorded = cohort sessions in W (from ``max(enrollment_start, cohort_since)``) still
  ``scheduled`` after ``end + grace``, dated on/after ``tracking_start_date``, counted only for a
  student who is on that session's roster (active, enrolled) — amended §5.2/§13.4;
  ``eligibility_provisional = unrecorded > 0``.
* streak = trailing run of class days (days with >= 1 countable record) on which every
  countable record was attended; other days are neutral.

Output (``summarize_counts``) carries BOTH the legacy numeric fields (``percentage_present``,
``attendance_rate``, ``attendance_percentage``, ``total_classes = considered + excused``) and
the new fields (``percentage``, ``has_data``, ``considered``, ``attended``, ``excused``,
``unrecorded``, ``eligible``, ``eligibility_provisional``, ``band``).

Read-only (never flushes/commits). Batch queries; no per-student/per-subject query loops.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Any, Iterable, Optional, Sequence

from sqlalchemy import and_, func, or_, select

from app.core.clock import app_now
from app.models import (
    AttendanceRecord,
    ClassSession,
    SessionStatus,
    Student,
    Subject,
    User,
)
from app.services.attendance_policy import (
    AttendancePolicy,
    band_for_fraction,
    display_percentage,
    eligible,
    get_attendance_policy,
    percentage,
)
from app.services.class_sessions import (
    enrollment_start_for,
    enrollment_start_sql,
    finalize_point,
)
from app.services.domain_errors import DomainError
from app.services.instructional_calendar import compute_day_status, daterange, load_events
from app.services.term_service import Term, TermContext, get_term_context, load_terms

COUNTABLE_STATUSES = frozenset({"present", "late", "absent"})

# ============================================================================ pure core


def attended_statuses(policy: AttendancePolicy) -> frozenset:
    return frozenset({"present", "late"}) if policy.late_counts_as_attended else frozenset({"present"})


def is_countable(record_status: str, session_status: str, excluded: bool = False) -> bool:
    """Rule §8 + §13.5: held session, present/late/absent, not excluded."""
    return (not excluded) and str(session_status) == SessionStatus.held and record_status in COUNTABLE_STATUSES


@dataclass
class Counts:
    """Raw tallies for one student/subject (or an aggregate)."""

    present: int = 0
    late: int = 0
    absent: int = 0
    excused: int = 0
    cancelled_sessions: int = 0
    unrecorded: int = 0

    def add(self, other: "Counts") -> "Counts":
        for f in ("present", "late", "absent", "excused", "cancelled_sessions", "unrecorded"):
            setattr(self, f, getattr(self, f) + getattr(other, f))
        return self

    def add_record(self, status: str, session_status: str, n: int = 1) -> None:
        """Tally ``n`` (non-excluded) records: countable ones by status (Rule §8), excused ones
        unless their session is cancelled."""
        if str(session_status) == SessionStatus.held and status in COUNTABLE_STATUSES:
            setattr(self, status, getattr(self, status) + n)
        elif status == "excused" and str(session_status) != SessionStatus.cancelled:
            self.excused += n


def summarize_counts(c: Counts, policy: AttendancePolicy) -> dict[str, Any]:
    """Rule §8 + §13.12 output block for one subject / overall (pure)."""
    considered = c.present + c.late + c.absent
    attended = c.present + (c.late if policy.late_counts_as_attended else 0)
    pct = display_percentage(attended, considered)
    band = band_for_fraction(attended, considered, policy.bands)
    return {
        # new fields (Rule §13.12)
        "percentage": pct,
        "has_data": considered > 0,
        "attended": attended,
        "considered": considered,
        "present": c.present,
        "late": c.late,
        "absent": c.absent,
        "excused": c.excused,
        "cancelled_sessions": c.cancelled_sessions,
        "unrecorded": c.unrecorded,
        "eligible": eligible(attended, considered, policy.minimum_percentage),
        "eligibility_provisional": c.unrecorded > 0,
        "band": band.name if band else None,
        "band_label": band.label if band else None,
        # legacy numeric fields (never null)
        "percentage_present": pct if pct is not None else 0.0,
        "attendance_rate": pct if pct is not None else 0.0,
        "attendance_percentage": pct if pct is not None else 0.0,
        "total_classes": considered + c.excused,
    }


def overall_eligibility(subject_summaries: Iterable[dict[str, Any]]) -> Optional[bool]:
    """Rule §8: overall eligibility (informational) = all subjects eligible. Subjects without data
    are ignored; ``None`` if no subject has data."""
    values = [s.get("eligible") for s in subject_summaries if s.get("eligible") is not None]
    if not values:
        return None
    return all(values)


def apply_overall_eligibility(summary: dict[str, Any], subject_summaries: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Coordinator decision (§8): an overall block's ``eligible`` = ALL subjects eligible
    (subjects without data ignored; ``None`` when no subject has countable data). Never the
    session-weighted aggregate. ``all_subjects_eligible`` is kept as an alias."""
    value = overall_eligibility(subject_summaries)
    summary["eligible"] = value
    summary["all_subjects_eligible"] = value
    return summary


def compute_streaks(day_flags: Iterable[tuple[date, bool]]) -> dict[str, int]:
    """Rule §8 streaks over class days only: ``{"current", "longest"}``. ``day_flags`` holds
    ``(day, all_countable_attended)`` for days with >= 1 countable record (any order)."""
    current = longest = run = 0
    for _, ok in sorted(day_flags, key=lambda x: x[0]):
        run = run + 1 if ok else 0
        longest = max(longest, run)
    current = run
    return {"current": current, "longest": longest}


def day_flags_from_records(rows: Iterable[tuple[date, str]], policy: AttendancePolicy) -> list[tuple[date, bool]]:
    """``(day, countable_status)`` pairs -> per-day "all attended" flags (Rule §8 streak)."""
    ok_set = attended_statuses(policy)
    per_day: dict[date, bool] = {}
    for d, status in rows:
        per_day[d] = per_day.get(d, True) and status in ok_set
    return sorted(per_day.items())


def classify_day(
    d: date,
    *,
    today: date,
    day_info: dict[str, Any],
    countable_statuses: Sequence[str],
    excused_count: int,
    session_statuses: Sequence[str],
    policy: AttendancePolicy,
    pending_sessions: int = 0,
) -> str:
    """Rule §8 daily calendar status (pure).

    ``session_statuses`` lists only the day's *evaluated* sessions; ``pending_sessions`` counts
    the neutral ones: sessions that have not reached ``end + finalize_grace`` and have no
    countable/excused record (coordinator decision: such a session is never "unrecorded").

    Precedence: countable records -> present/absent/partial; excused only -> ``excused``;
    future date -> non-instructional reason or ``future``; non-instructional day -> its reason
    (holiday/weekly_off/exam/between_terms); only pending sessions -> ``future``; all evaluated
    sessions cancelled -> ``cancelled``; any evaluated live session without countable data ->
    ``unrecorded``; else ``no_class``.
    """
    if countable_statuses:
        ok = attended_statuses(policy)
        flags = [s in ok for s in countable_statuses]
        if all(flags):
            return "present"
        if all(s == "absent" for s in countable_statuses):
            return "absent"
        return "partial"
    if excused_count:
        return "excused"
    reason = None if day_info.get("instructional", True) else day_info.get("reason")
    if d > today:
        return reason or "future"
    if reason:
        return reason
    if not session_statuses and pending_sessions:
        return "future"
    if session_statuses and all(s == SessionStatus.cancelled for s in session_statuses):
        return "cancelled"
    if any(s != SessionStatus.cancelled for s in session_statuses):
        return "unrecorded"
    return "no_class"


def metrics_window(term: Optional[Term], enrollment_start: Optional[date], as_of: date) -> Optional[tuple[date, date]]:
    """Rule §8: ``[max(term.start, enrollment_start), min(term.end, as_of)]`` or ``None`` if empty."""
    if term is None:
        return None
    start = max(term.start_date, enrollment_start) if enrollment_start else term.start_date
    end = min(term.end_date, as_of)
    return (start, end) if start <= end else None


def _status_str(value: Any) -> str:
    return str(getattr(value, "value", value) or "").lower()


# ============================================================================ result object


@dataclass
class StudentMetrics:
    student_id: int
    term_context: TermContext
    window: Optional[tuple[date, date]]
    overall: dict[str, Any]
    per_subject: list[dict[str, Any]]
    streak: dict[str, int]
    policy: AttendancePolicy
    student: dict[str, Any] = field(default_factory=dict)

    @property
    def term_state(self) -> str:
        return self.term_context.state

    def to_dict(self) -> dict[str, Any]:
        """Rule §13.12 shape: top-level legacy numeric fields + ``overall`` / ``per_subject`` blocks."""
        term = self.term_context.term
        data: dict[str, Any] = {
            "student_id": self.student_id,
            "student": self.student,
            "term": term.summary() if term else None,
            "term_state": self.term_state,
            "window": {"start": self.window[0].isoformat(), "end": self.window[1].isoformat()} if self.window else None,
            "overall": self.overall,
            "per_subject": self.per_subject,
            "counts": {k: self.overall[k] for k in ("present", "late", "absent", "excused", "cancelled_sessions", "unrecorded")},
            "eligibility": {
                "eligible": self.overall["eligible"],
                "provisional": self.overall["eligibility_provisional"],
                "minimum_percentage": self.policy.minimum_percentage,
                "all_subjects_eligible": self.overall.get("all_subjects_eligible"),
            },
            "band": self.overall["band"],
            "streak": self.streak,
            "policy": {
                "minimum_percentage": self.policy.minimum_percentage,
                "late_counts_as_attended": self.policy.late_counts_as_attended,
            },
        }
        # flatten the overall block for legacy readers (percentage_present, total_classes, ...)
        for k, v in self.overall.items():
            data.setdefault(k, v)
        return data


# ============================================================================ DB helpers


async def _load_student(db, student_id: int) -> Any:
    row = (await db.execute(
        select(Student.id, Student.faculty_id, Student.semester, Student.enrolled_on, Student.cohort_since,
               Student.created_at, Student.student_id, User.full_name, User.is_active)
        .join(User, User.id == Student.user_id, isouter=True)
        .where(Student.id == student_id)
    )).first()
    if row is None:
        raise DomainError("student_not_found", f"Student {student_id} not found", http_status=404,
                          details={"student_id": student_id})
    return row


def _roster_start(enrollment_start: Optional[date], cohort_since: Optional[date]) -> Optional[date]:
    if cohort_since is not None and (enrollment_start is None or cohort_since > enrollment_start):
        return cohort_since
    return enrollment_start


async def _cohort_session_rows(db, faculty_id, semester, start: date, end: date, subject_id: Optional[int] = None):
    """(subject_id, session_date, end_time, status) of a cohort's sessions in [start, end]."""
    if faculty_id is None or semester is None or end < start:
        return []
    stmt = select(ClassSession.subject_id, ClassSession.session_date, ClassSession.end_time, ClassSession.status).where(
        ClassSession.faculty_id == faculty_id,
        ClassSession.semester == semester,
        ClassSession.session_date >= start,
        ClassSession.session_date <= end,
    )
    if subject_id is not None:
        stmt = stmt.where(ClassSession.subject_id == subject_id)
    return (await db.execute(stmt)).all()


def _session_flags(status: str, session_date: date, end_time: time, now: datetime, grace: int,
                   tracking_start: Optional[date] = None) -> tuple[bool, bool]:
    """(is_cancelled, is_unrecorded) for a session row. Sessions before ``tracking_start`` are
    legacy data and never unrecorded (amended §5.2/§13.4)."""
    s = str(status)
    unrecorded = (s == SessionStatus.scheduled and finalize_point(session_date, end_time, grace) < now
                  and (tracking_start is None or session_date >= tracking_start))
    return s == SessionStatus.cancelled, unrecorded


async def _subject_names(db, subject_ids: Iterable[int]) -> dict[int, tuple[str, str]]:
    ids = list(set(subject_ids))
    if not ids:
        return {}
    rows = (await db.execute(select(Subject.id, Subject.name, Subject.code).where(Subject.id.in_(ids)))).all()
    return {i: (n, c) for i, n, c in rows}


# ============================================================================ student metrics


async def compute_student_metrics(
    db,
    student_id: int,
    *,
    term: Optional[Term] = None,
    term_id: Optional[int] = None,
    as_of: Optional[date] = None,
    subject_id: Optional[int] = None,
    policy: Optional[AttendancePolicy] = None,
    now: Optional[datetime] = None,
) -> StudentMetrics:
    """Rule §8 metrics for one student (3-4 queries). ``term``/``term_id`` override the reporting
    term (current term, else the most recent past term, Rule §3)."""
    now = now or app_now()
    as_of = as_of or now.date()
    policy = policy or await get_attendance_policy(db)
    ctx = await get_term_context(db, as_of=as_of, term_id=term_id)
    if term is not None:
        ctx = TermContext(term=term, state=ctx.state, current_term=ctx.current_term)
    st = await _load_student(db, student_id)
    enrollment_start = enrollment_start_for(st.enrolled_on, st.created_at)
    window = metrics_window(ctx.term, enrollment_start, as_of)
    student_info = {"id": st.id, "student_id": st.student_id, "name": st.full_name,
                    "faculty_id": st.faculty_id, "semester": st.semester,
                    "enrollment_start": enrollment_start.isoformat() if enrollment_start else None}

    per_subject_counts: dict[int, Counts] = defaultdict(Counts)
    day_rows: list[tuple[date, str]] = []
    if window is not None:
        stmt = (
            select(AttendanceRecord.status, ClassSession.status, ClassSession.subject_id, ClassSession.session_date)
            .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
            .where(
                AttendanceRecord.student_id == student_id,
                AttendanceRecord.excluded_from_metrics.is_(False),
                ClassSession.session_date >= window[0],
                ClassSession.session_date <= window[1],
            )
        )
        if subject_id is not None:
            stmt = stmt.where(ClassSession.subject_id == subject_id)
        for rstatus, sstatus, subj, sdate in (await db.execute(stmt)).all():
            rs = _status_str(rstatus)
            per_subject_counts[subj].add_record(rs, sstatus)
            if is_countable(rs, sstatus):
                day_rows.append((sdate, rs))

        cohort_start = max(window[0], _roster_start(enrollment_start, st.cohort_since) or window[0])
        for subj, sdate, end_t, sstatus in await _cohort_session_rows(db, st.faculty_id, st.semester, cohort_start, window[1], subject_id):
            cancelled, unrecorded = _session_flags(sstatus, sdate, end_t, now, policy.finalize_grace_minutes,
                                                   policy.tracking_start_date)
            unrecorded = unrecorded and st.is_active is not False  # inactive students are on no roster
            bucket = per_subject_counts[subj]  # every subject the cohort has sessions for gets a row
            if cancelled:
                bucket.cancelled_sessions += 1
            elif unrecorded:
                bucket.unrecorded += 1

    names = await _subject_names(db, per_subject_counts.keys())
    per_subject: list[dict[str, Any]] = []
    total = Counts()
    for subj, counts in per_subject_counts.items():
        total.add(counts)
        name, code = names.get(subj, (None, None))
        per_subject.append({"subject_id": subj, "subject_name": name, "subject_code": code, **summarize_counts(counts, policy)})
    per_subject.sort(key=lambda s: ((s["subject_name"] or "").lower(), s["subject_id"]))
    overall = apply_overall_eligibility(summarize_counts(total, policy), per_subject)
    streak = compute_streaks(day_flags_from_records(day_rows, policy))
    return StudentMetrics(student_id=student_id, term_context=ctx, window=window, overall=overall,
                          per_subject=per_subject, streak=streak, policy=policy, student=student_info)


# ============================================================================ batch: many students


async def _batch_subject_counts(
    db,
    *,
    student_ids: Optional[Sequence[int]],
    faculty_id: Optional[int],
    semester: Optional[int],
    subject_id: Optional[int],
    term: Optional[Term],
    term_id: Optional[int],
    as_of: date,
    policy: AttendancePolicy,
    now: datetime,
) -> tuple[TermContext, list, dict[int, dict[int, Counts]]]:
    """Per-student, per-subject Rule §8 tallies for many students in 4 queries.

    Same countable definition as :func:`compute_student_metrics` (held session, not excluded,
    term window clipped to ``max(term.start, enrollment_start)`` .. ``min(term.end, as_of)``);
    cancelled/unrecorded cohort sessions are attributed from ``max(enrollment_start, cohort_since)``.
    """
    ctx = await get_term_context(db, as_of=as_of, term_id=term_id)
    if term is not None:
        ctx = TermContext(term=term, state=ctx.state, current_term=ctx.current_term)
    stmt = (select(Student.id, Student.faculty_id, Student.semester, Student.enrolled_on, Student.cohort_since,
                   Student.created_at, User.is_active)
            .join(User, User.id == Student.user_id, isouter=True))
    if student_ids is not None:
        stmt = stmt.where(Student.id.in_(list(student_ids)))
    if faculty_id is not None:
        stmt = stmt.where(Student.faculty_id == faculty_id)
    if semester is not None:
        stmt = stmt.where(Student.semester == semester)
    students = (await db.execute(stmt)).all()
    by_subject: dict[int, dict[int, Counts]] = {s.id: defaultdict(Counts) for s in students}
    if ctx.term is None or not students:
        return ctx, students, by_subject
    term_start, term_end = ctx.term.start_date, min(ctx.term.end_date, as_of)
    if term_end < term_start:
        return ctx, students, by_subject

    rec_stmt = (
        select(AttendanceRecord.student_id, ClassSession.subject_id, AttendanceRecord.status, ClassSession.status,
               func.count())
        .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .where(
            AttendanceRecord.student_id.in_(list(by_subject)),
            AttendanceRecord.excluded_from_metrics.is_(False),
            ClassSession.session_date >= term_start,
            ClassSession.session_date <= term_end,
            ClassSession.session_date >= enrollment_start_sql(),
        )
        .group_by(AttendanceRecord.student_id, ClassSession.subject_id, AttendanceRecord.status, ClassSession.status)
    )
    if subject_id is not None:
        rec_stmt = rec_stmt.where(ClassSession.subject_id == subject_id)
    for sid, subj, rstatus, sstatus, n in (await db.execute(rec_stmt)).all():
        by_subject[sid][subj].add_record(_status_str(rstatus), sstatus, int(n))

    cohorts = {(s.faculty_id, s.semester) for s in students if s.faculty_id is not None}
    if cohorts:
        conds = [and_(ClassSession.faculty_id == f, ClassSession.semester == sem) for f, sem in cohorts]
        sstmt = select(ClassSession.faculty_id, ClassSession.semester, ClassSession.subject_id, ClassSession.session_date,
                       ClassSession.end_time, ClassSession.status).where(
            or_(*conds), ClassSession.session_date >= term_start, ClassSession.session_date <= term_end)
        if subject_id is not None:
            sstmt = sstmt.where(ClassSession.subject_id == subject_id)
        by_cohort: dict[tuple, list[tuple[int, date, bool, bool]]] = defaultdict(list)
        for f, sem, subj, sdate, end_t, sstatus in (await db.execute(sstmt)).all():
            cancelled, unrecorded = _session_flags(sstatus, sdate, end_t, now, policy.finalize_grace_minutes,
                                                   policy.tracking_start_date)
            by_cohort[(f, sem)].append((subj, sdate, cancelled, unrecorded))
        for s in students:
            rs = _roster_start(enrollment_start_for(s.enrolled_on, s.created_at), s.cohort_since)
            for subj, sdate, cancelled, unrecorded in by_cohort.get((s.faculty_id, s.semester), ()):
                if rs is not None and sdate < rs:
                    continue
                bucket = by_subject[s.id][subj]  # every subject with a cohort session gets a row
                if cancelled:
                    bucket.cancelled_sessions += 1
                elif unrecorded and s.is_active is not False:
                    bucket.unrecorded += 1
    return ctx, students, by_subject


async def compute_students_overall(
    db,
    student_ids: Optional[Sequence[int]] = None,
    *,
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    term: Optional[Term] = None,
    term_id: Optional[int] = None,
    as_of: Optional[date] = None,
    policy: Optional[AttendancePolicy] = None,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    """Overall Rule §8 summary for many students (dashboards, leaderboards, class averages),
    4 queries regardless of the number of students. Select by ``student_ids`` and/or cohort.

    Returns ``{"term", "term_state", "students": {student_id: summary}, "aggregate": summary}``.
    Each student's ``eligible`` = all of that student's subjects eligible (coordinator decision,
    §8). ``aggregate`` counts are session-weighted across the selected students;
    ``aggregate.eligible`` = every selected student with data is eligible.
    """
    now = now or app_now()
    as_of = as_of or now.date()
    policy = policy or await get_attendance_policy(db)
    ctx, students, by_subject = await _batch_subject_counts(
        db, student_ids=student_ids, faculty_id=faculty_id, semester=semester, subject_id=None, term=term,
        term_id=term_id, as_of=as_of, policy=policy, now=now)
    out: dict[str, Any] = {"term": ctx.term.summary() if ctx.term else None, "term_state": ctx.state, "students": {}}
    agg = Counts()
    for s in students:
        total = Counts()
        subject_summaries = []
        for c in by_subject[s.id].values():
            total.add(c)
            subject_summaries.append(summarize_counts(c, policy))
        agg.add(total)
        out["students"][s.id] = apply_overall_eligibility(summarize_counts(total, policy), subject_summaries)
    out["aggregate"] = apply_overall_eligibility(summarize_counts(agg, policy), out["students"].values())
    return out


async def compute_students_by_subject(
    db,
    student_ids: Optional[Sequence[int]] = None,
    *,
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    subject_id: Optional[int] = None,
    term: Optional[Term] = None,
    term_id: Optional[int] = None,
    as_of: Optional[date] = None,
    policy: Optional[AttendancePolicy] = None,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    """Batch per-subject Rule §8 summaries for many students (5 queries total).

    Returns ``{"term", "term_state", "students": {student_id: [ {subject_id, subject_name,
    subject_code, **summary} ]}}`` (each list sorted by subject name). Same definitions as
    :func:`compute_student_metrics` ``per_subject``.
    """
    now = now or app_now()
    as_of = as_of or now.date()
    policy = policy or await get_attendance_policy(db)
    ctx, students, by_subject = await _batch_subject_counts(
        db, student_ids=student_ids, faculty_id=faculty_id, semester=semester, subject_id=subject_id, term=term,
        term_id=term_id, as_of=as_of, policy=policy, now=now)
    names = await _subject_names(db, {subj for subjects in by_subject.values() for subj in subjects})
    out: dict[str, Any] = {"term": ctx.term.summary() if ctx.term else None, "term_state": ctx.state, "students": {}}
    for s in students:
        rows = []
        for subj, c in by_subject[s.id].items():
            name, code = names.get(subj, (None, None))
            rows.append({"subject_id": subj, "subject_name": name, "subject_code": code, **summarize_counts(c, policy)})
        rows.sort(key=lambda r: ((r["subject_name"] or "").lower(), r["subject_id"]))
        out["students"][s.id] = rows
    return out


# ============================================================================ cohort x subject


async def compute_cohort_subject_metrics(
    db,
    subject_id: int,
    faculty_id: int,
    semester: int,
    *,
    term: Optional[Term] = None,
    term_id: Optional[int] = None,
    as_of: Optional[date] = None,
    policy: Optional[AttendancePolicy] = None,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    """Rule §8 per-student metrics for one subject of one cohort (teacher analytics), 4 queries.

    Returns ``{"subject_id", "faculty_id", "semester", "term", "term_state", "students": [...],
    "aggregate": summary, "sessions": {"held", "unrecorded", "cancelled", "upcoming"}}``.
    """
    now = now or app_now()
    as_of = as_of or now.date()
    policy = policy or await get_attendance_policy(db)
    ctx = await get_term_context(db, as_of=as_of, term_id=term_id)
    if term is not None:
        ctx = TermContext(term=term, state=ctx.state, current_term=ctx.current_term)
    result: dict[str, Any] = {
        "subject_id": subject_id, "faculty_id": faculty_id, "semester": semester,
        "term": ctx.term.summary() if ctx.term else None, "term_state": ctx.state,
        "students": [], "aggregate": summarize_counts(Counts(), policy),
        "sessions": {"held": 0, "unrecorded": 0, "cancelled": 0, "upcoming": 0},
    }
    roster = (await db.execute(
        select(Student.id, Student.student_id, User.full_name, Student.enrolled_on, Student.cohort_since, Student.created_at)
        .join(User, User.id == Student.user_id)
        .where(Student.faculty_id == faculty_id, Student.semester == semester, func.coalesce(User.is_active, True).is_(True))
        .order_by(User.full_name, Student.id)
    )).all()
    if ctx.term is None:
        result["students"] = [{"student_id": r.id, "student_number": r.student_id, "name": r.full_name,
                               **summarize_counts(Counts(), policy)} for r in roster]
        return result
    start, end = ctx.term.start_date, min(ctx.term.end_date, as_of)
    counts: dict[int, Counts] = {r.id: Counts() for r in roster}
    if end >= start and roster:
        rec_rows = (await db.execute(
            select(AttendanceRecord.student_id, AttendanceRecord.status, ClassSession.status, func.count())
            .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
            .join(Student, Student.id == AttendanceRecord.student_id)
            .where(
                AttendanceRecord.student_id.in_(list(counts)),
                AttendanceRecord.excluded_from_metrics.is_(False),
                ClassSession.subject_id == subject_id,
                ClassSession.session_date >= start,
                ClassSession.session_date <= end,
                ClassSession.session_date >= enrollment_start_sql(),
            )
            .group_by(AttendanceRecord.student_id, AttendanceRecord.status, ClassSession.status)
        )).all()
        for sid, rstatus, sstatus, n in rec_rows:
            counts[sid].add_record(_status_str(rstatus), sstatus, int(n))
    sessions = await _cohort_session_rows(db, faculty_id, semester, start, end, subject_id)
    starts = [_roster_start(enrollment_start_for(r.enrolled_on, r.created_at), r.cohort_since) for r in roster]
    roster_first = min((x or date.min) for x in starts) if starts else None
    flagged: list[tuple[date, bool, bool]] = []
    for _, sdate, end_t, sstatus in sessions:
        cancelled, unrecorded = _session_flags(sstatus, sdate, end_t, now, policy.finalize_grace_minutes,
                                               policy.tracking_start_date)
        if unrecorded and (roster_first is None or sdate < roster_first):
            continue  # empty roster that day: not actionable, not counted (amended §5.2/§13.4)
        if str(sstatus) == SessionStatus.held:
            result["sessions"]["held"] += 1
        elif cancelled:
            result["sessions"]["cancelled"] += 1
        elif unrecorded:
            result["sessions"]["unrecorded"] += 1
        else:
            result["sessions"]["upcoming"] += 1
        if cancelled or unrecorded:
            flagged.append((sdate, cancelled, unrecorded))
    agg = Counts()
    for r in roster:
        rs = _roster_start(enrollment_start_for(r.enrolled_on, r.created_at), r.cohort_since)
        c = counts[r.id]
        for sdate, cancelled, unrecorded in flagged:
            if rs is not None and sdate < rs:
                continue
            if cancelled:
                c.cancelled_sessions += 1
            elif unrecorded:
                c.unrecorded += 1
        agg.add(c)
        result["students"].append({"student_id": r.id, "student_number": r.student_id, "name": r.full_name,
                                   **summarize_counts(c, policy)})
    # aggregate.eligible = every student with data is eligible (not the pooled fraction)
    result["aggregate"] = apply_overall_eligibility(summarize_counts(agg, policy), result["students"])
    return result


# ============================================================================ calendar days


async def compute_student_day_statuses(
    db,
    student_id: int,
    start: date,
    end: date,
    *,
    policy: Optional[AttendancePolicy] = None,
    now: Optional[datetime] = None,
) -> list[dict[str, Any]]:
    """Rule §8 daily calendar statuses for ``[start, end]`` (4 queries, any range length).

    Each item: ``{date, status, reason, events, sessions: [{session_id, subject_id, start_time,
    end_time, session_status, record_status, excluded_from_metrics, counts_in_metrics, pending}]}``.
    Status values: present, absent, partial, excused, cancelled, unrecorded, no_class, future,
    holiday, weekly_off, exam, between_terms.

    A record drives the day only if it counts exactly as in :func:`compute_student_metrics`
    (Rule §8 + §13.5): held session, not ``excluded_from_metrics``, the day inside an active term,
    on/after the student's enrollment start and not after today. Records outside that window and
    excluded records are shown but neutral (never "absent", never "unrecorded"). Sessions not yet
    past ``end + finalize_grace`` without data are neutral too (coordinator decision).
    """
    if end < start:
        return []
    now = now or app_now()
    today = now.date()
    policy = policy or await get_attendance_policy(db)
    st = await _load_student(db, student_id)
    enrollment_start = enrollment_start_for(st.enrolled_on, st.created_at)
    roster_start = _roster_start(enrollment_start, st.cohort_since)

    terms = await load_terms(db)
    events = await load_events(db, start, end, types=None)
    sessions: dict[int, Any] = {}
    if st.faculty_id is not None:
        for s in (await db.execute(
            select(ClassSession.id, ClassSession.subject_id, ClassSession.session_date, ClassSession.start_time,
                   ClassSession.end_time, ClassSession.status)
            .where(ClassSession.faculty_id == st.faculty_id, ClassSession.semester == st.semester,
                   ClassSession.session_date >= start, ClassSession.session_date <= end)
        )).all():
            sessions[s.id] = s
    records: dict[int, tuple[str, bool]] = {}
    by_day: dict[date, list[dict[str, Any]]] = defaultdict(list)
    rec_rows = (await db.execute(
        select(AttendanceRecord.status, AttendanceRecord.excluded_from_metrics, ClassSession.id, ClassSession.subject_id,
               ClassSession.session_date, ClassSession.start_time, ClassSession.end_time, ClassSession.status)
        .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
        .where(AttendanceRecord.student_id == student_id, ClassSession.session_date >= start,
               ClassSession.session_date <= end)
    )).all()
    for rstatus, excluded, sid, subj, sdate, st_t, en_t, sstatus in rec_rows:
        records[sid] = (_status_str(rstatus), bool(excluded))
        if sid not in sessions:  # e.g. a record from the student's previous cohort
            by_day[sdate].append({"session_id": sid, "subject_id": subj, "start_time": st_t, "end_time": en_t,
                                  "session_status": str(sstatus)})
    for s in sessions.values():
        if roster_start is not None and s.session_date < roster_start and s.id not in records:
            continue
        by_day[s.session_date].append({"session_id": s.id, "subject_id": s.subject_id, "start_time": s.start_time,
                                       "end_time": s.end_time, "session_status": str(s.status)})

    out: list[dict[str, Any]] = []
    for d in daterange(start, end):
        info = compute_day_status(d, st.faculty_id, terms, events, policy)
        day_sessions = sorted(by_day.get(d, []), key=lambda x: (x["start_time"], x["session_id"]))
        countable: list[str] = []
        evaluated: list[str] = []
        excused = 0
        pending = 0
        in_window = (info["term_id"] is not None and d <= today
                     and (enrollment_start is None or d >= enrollment_start))
        for item in day_sessions:
            rec = records.get(item["session_id"])
            item["record_status"] = rec[0] if rec else None
            item["excluded_from_metrics"] = rec[1] if rec else False
            ended = finalize_point(d, item["end_time"], policy.finalize_grace_minutes) <= now
            item["pending"] = not ended
            counts = bool(in_window and rec and is_countable(rec[0], item["session_status"], rec[1]))
            item["counts_in_metrics"] = counts
            if counts:
                countable.append(rec[0])
            elif in_window and rec and rec[0] == "excused" and not rec[1] and item["session_status"] != SessionStatus.cancelled:
                excused += 1
            elif not in_window or (rec is not None and rec[1]) or (
                    policy.tracking_start_date is not None and d < policy.tracking_start_date):
                pass  # outside the metrics window, an excluded record, or legacy pre-tracking: neutral
            elif not ended:
                pending += 1  # not yet past end + grace and nothing recorded: neutral
            else:
                evaluated.append(item["session_status"])
            item["start_time"] = item["start_time"].strftime("%H:%M")
            item["end_time"] = item["end_time"].strftime("%H:%M")
        status = classify_day(d, today=today, day_info=info, countable_statuses=countable, excused_count=excused,
                              session_statuses=evaluated, policy=policy, pending_sessions=pending)
        out.append({"date": d.isoformat(), "status": status, "reason": info["reason"], "events": info["events"],
                    "sessions": day_sessions})
    return out


__all__ = [
    "COUNTABLE_STATUSES",
    "attended_statuses",
    "is_countable",
    "Counts",
    "summarize_counts",
    "overall_eligibility",
    "apply_overall_eligibility",
    "compute_streaks",
    "day_flags_from_records",
    "classify_day",
    "metrics_window",
    "percentage",
    "eligible",
    "StudentMetrics",
    "compute_student_metrics",
    "compute_students_overall",
    "compute_students_by_subject",
    "compute_cohort_subject_metrics",
    "compute_student_day_statuses",
]
