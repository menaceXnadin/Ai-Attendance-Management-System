"""Legacy adapters over the attendance metrics service (DOMAIN_RULES §8, §13.5, §13.12).

This module used to be an independent "accurate" calculator: it guessed the semester from
the month, derived "held" days from record ``created_at`` timestamps of any cohort and
turned missing records into absences. All of that is gone. Every percentage, count,
eligibility flag and band now comes from :mod:`app.services.attendance_metrics` and
:mod:`app.services.attendance_policy`; this module only

* maps those results onto legacy response keys (``calculate_accurate_attendance``,
  ``calculate_subject_wise_attendance`` keep their names/shapes for existing callers), and
* offers small *batch* read helpers for date-bucketed dashboards (per-day / per-subject
  tallies). They apply the metrics service's countability rules verbatim (held session,
  present/late/absent, not ``excluded_from_metrics``, on/after the student's enrollment start)
  through ``Counts.add_record`` / ``summarize_counts`` — no rule is re-implemented here.

Read-only: never flushes or commits.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Iterable, Optional, Sequence

from sqlalchemy import func, select

from app.core.clock import app_now, local_naive
from app.models import AttendanceRecord, ClassSession, SessionStatus, Student, Subject
from app.services.attendance_metrics import (
    COUNTABLE_STATUSES,
    Counts,
    compute_student_metrics,
    summarize_counts,
)
from app.services.attendance_policy import AttendancePolicy, get_attendance_policy
from app.services.class_sessions import enrollment_start_sql, unrecorded_sql
from app.services.term_service import Term

# §13.12 fields copied from a ``summarize_counts`` block into legacy responses.
METRIC_FIELDS: tuple[str, ...] = (
    "percentage",
    "has_data",
    "considered",
    "attended",
    "present",
    "late",
    "absent",
    "excused",
    "cancelled_sessions",
    "unrecorded",
    "eligible",
    "eligibility_provisional",
    "band",
    "band_label",
)


def status_value(value: Any) -> str:
    """Enum/str attendance status -> lower-case string."""
    return str(getattr(value, "value", value) or "").lower()


def metric_fields(summary: dict[str, Any], *, term: Any = None, term_state: Optional[str] = None,
                  include_term: bool = True) -> dict[str, Any]:
    """The Rule §13.12 field set from a ``summarize_counts`` block (+ ``term``/``term_state``)."""
    out = {k: summary.get(k) for k in METRIC_FIELDS}
    if include_term:
        if isinstance(term, Term):
            term = term.summary()
        out["term"] = term
        out["term_state"] = term_state
    return out


def risk_level_for_band(band_name: Optional[str], policy: AttendancePolicy) -> str:
    """Legacy ``riskLevel``/``risk_level`` vocabulary derived from the policy band (Rule §2).

    No data -> ``"unknown"`` (never "critical"). Lowest band -> ``critical``; the at-risk band
    (second lowest, whose floor is the minimum percentage) -> ``high``; the top band -> ``low``;
    any band in between -> ``medium``.
    """
    if not band_name:
        return "unknown"
    names = [b.name for b in policy.bands]  # sorted by min_percentage, descending
    if band_name not in names:
        return "unknown"
    idx = names.index(band_name)
    if idx == len(names) - 1:
        return "critical"
    if idx == len(names) - 2:
        return "high"
    if idx == 0:
        return "low"
    return "medium"


def custom_range_term(start: date, end: date, name: Optional[str] = None) -> Term:
    """A synthetic, id-less :class:`Term` so callers with an explicit date range can reuse
    ``compute_student_metrics`` (the window is still clipped to enrollment and today)."""
    return Term(id=None, name=name or f"{start.isoformat()} to {end.isoformat()}", start_date=start, end_date=end)


def legacy_subject_row(subject: dict[str, Any]) -> dict[str, Any]:
    """Per-subject metrics block -> legacy subject-breakdown row (+ §13.12 fields)."""
    return {
        "subject_id": subject.get("subject_id"),
        "subject_name": subject.get("subject_name"),
        "subject_code": subject.get("subject_code"),
        "total_classes": subject.get("total_classes", 0),
        "attended": subject.get("attended", 0),
        "present": subject.get("present", 0),
        "late": subject.get("late", 0),
        "absent": subject.get("absent", 0),
        "attendance_percentage": subject.get("attendance_percentage", 0.0),
        "attendance_rate": subject.get("attendance_rate", 0.0),
        **metric_fields(subject, include_term=False),
    }


# ============================================================================ student delegates


async def calculate_subject_wise_attendance(
    db,
    student_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    term_id: Optional[int] = None,
) -> list[dict[str, Any]]:
    """Per-subject attendance for a student (delegates to ``compute_student_metrics``).

    Default scope = the reporting term (Rule §3); ``term_id`` selects a term; an explicit
    ``start_date``/``end_date`` range is honoured (clipped to enrollment and today).
    Returns ``[]`` for an unknown student (legacy behaviour).
    """
    from app.services.domain_errors import DomainError

    term = None
    if start_date is not None or end_date is not None:
        today = app_now().date()
        term = custom_range_term(start_date or date(1900, 1, 1), end_date or today)
    try:
        metrics = await compute_student_metrics(db, student_id, term=term, term_id=term_id)
    except DomainError as exc:
        if exc.code == "student_not_found":
            return []
        raise
    return [legacy_subject_row(s) for s in metrics.per_subject]


async def calculate_accurate_attendance(
    db,
    student_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    term_id: Optional[int] = None,
) -> dict[str, Any]:
    """Legacy "accurate attendance" dict, now a thin delegate to ``compute_student_metrics``.

    ``unmarked_absences`` is always 0: unrecorded sessions are never absences (Rule §0.2); they
    are reported as ``unrecorded``. ``risk_level`` comes from the policy band ("unknown" when
    there is no data). Raises ``DomainError(student_not_found)`` for an unknown student.
    """
    term = None
    if start_date is not None or end_date is not None:
        term = custom_range_term(start_date or date(1900, 1, 1), end_date or app_now().date())
    metrics = await compute_student_metrics(db, student_id, term=term, term_id=term_id)
    o = metrics.overall
    return {
        "total_classes_held": o["total_classes"],
        "classes_attended": o["attended"],
        "present_count": o["present"],
        "late_count": o["late"],
        "marked_absent_count": o["absent"],
        "excused_count": o["excused"],
        "total_absences": o["absent"],
        "unmarked_absences": 0,
        "attendance_percentage": o["attendance_percentage"],
        "risk_level": risk_level_for_band(o["band"], metrics.policy),
        "calculation_method": "attendance_metrics",
        "subjects": [legacy_subject_row(s) for s in metrics.per_subject],
        **metric_fields(o, term=metrics.term_context.term, term_state=metrics.term_state),
    }


# ============================================================================ batch helpers


def _countable_filters(start: date, end: date) -> list:
    """WHERE clauses shared by the batch helpers (Rule §8 + §13.5 + §13.7)."""
    return [
        AttendanceRecord.excluded_from_metrics.is_(False),
        ClassSession.session_date >= start,
        ClassSession.session_date <= end,
        ClassSession.session_date >= enrollment_start_sql(),
    ]


def _scope(stmt, student_ids: Optional[Sequence[int]], faculty_id: Optional[int], semester: Optional[int]):
    if student_ids is not None:
        stmt = stmt.where(AttendanceRecord.student_id.in_(list(student_ids)))
    if faculty_id is not None:
        stmt = stmt.where(Student.faculty_id == faculty_id)
    if semester is not None:
        stmt = stmt.where(Student.semester == semester)
    return stmt


async def counts_by_date(
    db,
    start: date,
    end: date,
    *,
    student_ids: Optional[Sequence[int]] = None,
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
) -> dict[date, Counts]:
    """Per-day record tallies (countable present/late/absent + excused) in ONE grouped query."""
    out: dict[date, Counts] = defaultdict(Counts)
    if end < start or (student_ids is not None and not student_ids):
        return out
    stmt = (
        select(ClassSession.session_date, AttendanceRecord.status, ClassSession.status, func.count())
        .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .where(*_countable_filters(start, end))
        .group_by(ClassSession.session_date, AttendanceRecord.status, ClassSession.status)
    )
    stmt = _scope(stmt, student_ids, faculty_id, semester)
    for d, rstatus, sstatus, n in (await db.execute(stmt)).all():
        out[d].add_record(status_value(rstatus), sstatus, int(n))
    return out


async def countable_student_day_rows(
    db,
    start: date,
    end: date,
    *,
    student_ids: Optional[Sequence[int]] = None,
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
) -> list[tuple[int, date, str]]:
    """``(student_id, session_date, status)`` for every countable record (Rule §8) in ONE query."""
    if end < start or (student_ids is not None and not student_ids):
        return []
    stmt = (
        select(AttendanceRecord.student_id, ClassSession.session_date, AttendanceRecord.status)
        .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .where(*_countable_filters(start, end), ClassSession.status == SessionStatus.held.value)
    )
    stmt = _scope(stmt, student_ids, faculty_id, semester)
    rows = []
    for sid, d, rstatus in (await db.execute(stmt)).all():
        s = status_value(rstatus)
        if s in COUNTABLE_STATUSES:
            rows.append((sid, d, s))
    return rows


@dataclass
class SubjectTally:
    subject_id: int
    counts: Counts = field(default_factory=Counts)
    students: int = 0
    first_class: Optional[date] = None
    last_class: Optional[date] = None
    held_sessions: int = 0


async def subject_tallies(
    db,
    start: date,
    end: date,
    *,
    policy: Optional[AttendancePolicy] = None,
    now: Optional[datetime] = None,
) -> dict[int, SubjectTally]:
    """Per-subject tallies across all cohorts in ``[start, end]`` (3 queries, no per-subject loop).

    Record counts follow Rule §8 exactly; ``cancelled_sessions``/``unrecorded`` count *sessions*
    (cohort level) rather than per-student slots.
    """
    out: dict[int, SubjectTally] = {}
    if end < start:
        return out
    now = now or app_now()
    policy = policy or await get_attendance_policy(db)

    def tally(subject_id: int) -> SubjectTally:
        if subject_id not in out:
            out[subject_id] = SubjectTally(subject_id)
        return out[subject_id]

    rec_rows = (await db.execute(
        select(ClassSession.subject_id, AttendanceRecord.status, ClassSession.status, func.count())
        .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .where(*_countable_filters(start, end))
        .group_by(ClassSession.subject_id, AttendanceRecord.status, ClassSession.status)
    )).all()
    for subj, rstatus, sstatus, n in rec_rows:
        tally(subj).counts.add_record(status_value(rstatus), sstatus, int(n))

    extent_rows = (await db.execute(
        select(ClassSession.subject_id, func.count(func.distinct(AttendanceRecord.student_id)))
        .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .where(*_countable_filters(start, end), ClassSession.status == SessionStatus.held.value,
               AttendanceRecord.status.in_(sorted(COUNTABLE_STATUSES)))
        .group_by(ClassSession.subject_id)
    )).all()
    for subj, n_students in extent_rows:
        tally(subj).students = int(n_students)

    session_rows = (await db.execute(
        select(ClassSession.subject_id, ClassSession.session_date, ClassSession.status)
        .where(ClassSession.session_date >= start, ClassSession.session_date <= end)
    )).all()
    for subj, sdate, sstatus in session_rows:
        s = str(sstatus)
        t = tally(subj)
        if s == SessionStatus.held:
            t.held_sessions += 1
            t.first_class = sdate if t.first_class is None or sdate < t.first_class else t.first_class
            t.last_class = sdate if t.last_class is None or sdate > t.last_class else t.last_class
        elif s == SessionStatus.cancelled:
            t.counts.cancelled_sessions += 1

    # Unrecorded uses the single shared definition (amended §5.2/§13.4): past end + grace,
    # on/after tracking_start_date, and a non-empty cohort roster that day.
    cutoff = local_naive(now - timedelta(minutes=policy.finalize_grace_minutes))
    unrecorded_rows = (await db.execute(
        select(ClassSession.subject_id, func.count())
        .where(ClassSession.session_date >= start, ClassSession.session_date <= end,
               unrecorded_sql(cutoff, policy.tracking_start_date))
        .group_by(ClassSession.subject_id)
    )).all()
    for subj, n in unrecorded_rows:
        tally(subj).counts.unrecorded += int(n)
    return out


async def subject_labels(db, subject_ids: Iterable[int]) -> dict[int, tuple[str, str]]:
    ids = sorted(set(subject_ids))
    if not ids:
        return {}
    rows = (await db.execute(select(Subject.id, Subject.name, Subject.code).where(Subject.id.in_(ids)))).all()
    return {i: (n, c) for i, n, c in rows}


def summary_of(counts: Counts, policy: AttendancePolicy) -> dict[str, Any]:
    """Alias of ``summarize_counts`` for callers of this adapter module."""
    return summarize_counts(counts, policy)


__all__ = [
    "METRIC_FIELDS",
    "status_value",
    "metric_fields",
    "risk_level_for_band",
    "custom_range_term",
    "legacy_subject_row",
    "calculate_subject_wise_attendance",
    "calculate_accurate_attendance",
    "counts_by_date",
    "countable_student_day_rows",
    "SubjectTally",
    "subject_tallies",
    "subject_labels",
    "summary_of",
]
