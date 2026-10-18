"""Instructional days and expected class sessions (DOMAIN_RULES §4, §13.1, §13.2, §13.6).

The ONE place that decides whether a timetable row yields a class session on a date, and the
ONE weekday mapper (``weekday_to_day_of_week``) between Python dates and the DB enum
``day_of_week`` (which stores NAMES such as ``'SUNDAY'``).

A schedule row S yields an expected session on date d iff (Rule §4):
  1. S.is_active and weekday(d) == S.day_of_week;
  2. d is inside an active term's instruction window (term dates minus the exam window when
     ``policy.exam_days_suspend_classes``);
  3. weekday(d) not in ``policy.weekly_off_days``;
  4. no active HOLIDAY event covers d for S (date range, faculty/subject scope; an event with
     explicit start/end times only suppresses overlapping slots, otherwise the whole day);
  5. when ``policy.exam_days_suspend_classes``: no active EXAM event covers it (same matching)
     unless the event has ``attendance_required``.
CLASS marker events are informational; SPECIAL_EVENT never suppresses. An active
CANCELLED_CLASS event covering the slot does not remove the session: it is materialized as
``cancelled`` with ``cancelled_by_event_id`` (Rule §13.6), so cancellations stay visible and
are restored when the event is deactivated.

Pure functions take value objects (``ScheduleInfo``, ``EventInfo``, ``Term``) so they are
unit-testable without a DB; the async wrappers batch-load rows (no N+1, no
``scalar_one_or_none`` on event lookups). Read-only: never flushes or commits.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time, timedelta
from typing import Any, Iterable, Optional, Sequence

from app.core.clock import app_today
from app.services.attendance_policy import AttendancePolicy
from app.services.term_service import Term, term_for_date

# Day status reasons (Rule §4 ``day_status``)
REASON_WEEKLY_OFF = "weekly_off"
REASON_HOLIDAY = "holiday"
REASON_EXAM = "exam"
REASON_BETWEEN_TERMS = "between_terms"
REASON_CANCELLED_CLASS = "cancelled_class"

SUPPRESSING_EVENT_TYPES = ("holiday", "exam", "cancelled_class")

KIND_REGULAR = "regular"
KIND_MAKEUP = "makeup"

# ----------------------------------------------------------------------------- weekday mapper

_PY_WEEKDAY_TO_NAME = ("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY")


def weekday_to_day_of_week(d: date):
    """The single date -> ``DayOfWeek`` mapper (Rule §13.1). ``DayOfWeek.SUNDAY`` is stored as
    ``'SUNDAY'`` in the DB enum ``day_of_week``."""
    from app.models.schedule import DayOfWeek

    return DayOfWeek[_PY_WEEKDAY_TO_NAME[d.weekday()]]


def day_of_week_to_weekday(value: Any) -> int:
    """Inverse mapper: ``DayOfWeek`` member / name / value (any case) -> Python weekday (Mon=0)."""
    name = getattr(value, "name", None) or str(value)
    return _PY_WEEKDAY_TO_NAME.index(name.strip().upper())


# ----------------------------------------------------------------------------- value objects


def _event_type_str(value: Any) -> str:
    raw = getattr(value, "value", value)
    return str(raw).strip().lower()


@dataclass(frozen=True)
class EventInfo:
    """Value object for an ``academic_events`` row (only the fields the rules need)."""

    id: Optional[int]
    event_type: str  # lower-case: holiday | exam | cancelled_class | class | special_event
    start_date: date
    end_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_all_day: bool = False
    faculty_id: Optional[int] = None
    subject_id: Optional[int] = None
    attendance_required: bool = False
    is_active: bool = True
    title: str = ""

    @classmethod
    def from_model(cls, ev: Any) -> "EventInfo":
        return cls(
            id=ev.id,
            event_type=_event_type_str(ev.event_type),
            start_date=ev.start_date,
            end_date=ev.end_date,
            start_time=ev.start_time,
            end_time=ev.end_time,
            is_all_day=bool(ev.is_all_day),
            faculty_id=ev.faculty_id,
            subject_id=ev.subject_id,
            attendance_required=bool(ev.attendance_required),
            is_active=ev.is_active is not False,
            title=ev.title or "",
        )

    @property
    def last_date(self) -> date:
        return self.end_date if self.end_date and self.end_date >= self.start_date else self.start_date

    def covers_date(self, d: date) -> bool:
        """``start_date <= d <= coalesce(end_date, start_date)`` (Rule §4.4)."""
        return self.start_date <= d <= self.last_date

    def in_scope(self, faculty_id: Optional[int], subject_id: Optional[int]) -> bool:
        """``faculty_id IS NULL OR = faculty`` and ``subject_id IS NULL OR = subject`` (Rule §4.4)."""
        return (self.faculty_id is None or self.faculty_id == faculty_id) and (
            self.subject_id is None or self.subject_id == subject_id
        )

    @property
    def has_time_range(self) -> bool:
        """Explicit times limit the event to that range; otherwise it is full-day (HALF_DAY
        without times counts as full-day — conservative, Rule §4.4)."""
        return (
            not self.is_all_day
            and self.start_time is not None
            and self.end_time is not None
            and self.end_time > self.start_time
        )

    @property
    def is_full_day(self) -> bool:
        return not self.has_time_range

    def overlaps_slot(self, start: Optional[time], end: Optional[time]) -> bool:
        if not self.has_time_range or start is None or end is None:
            return True
        return self.start_time < end and start < self.end_time

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "event_type": self.event_type,
            "start_date": self.start_date.isoformat(),
            "end_date": self.last_date.isoformat(),
            "start_time": self.start_time.strftime("%H:%M") if self.has_time_range else None,
            "end_time": self.end_time.strftime("%H:%M") if self.has_time_range else None,
            "faculty_id": self.faculty_id,
            "subject_id": self.subject_id,
            "attendance_required": self.attendance_required,
        }


@dataclass(frozen=True)
class ScheduleInfo:
    """Value object for a ``class_schedules`` row."""

    id: Optional[int]
    subject_id: int
    faculty_id: int
    semester: int
    weekday: int  # Python weekday, Mon=0
    start_time: time
    end_time: time
    teacher_id: Optional[int] = None
    is_active: bool = True

    @classmethod
    def from_model(cls, s: Any) -> "ScheduleInfo":
        return cls(
            id=s.id,
            subject_id=s.subject_id,
            faculty_id=s.faculty_id,
            semester=s.semester,
            weekday=day_of_week_to_weekday(s.day_of_week),
            start_time=s.start_time,
            end_time=s.end_time,
            teacher_id=s.teacher_id,
            is_active=s.is_active is not False,
        )


@dataclass(frozen=True)
class ExpectedSession:
    """A class session that should occur (Rule §4); input to materialization (Rule §13.1)."""

    schedule_id: Optional[int]
    subject_id: int
    faculty_id: int
    semester: int
    session_date: date
    start_time: time
    end_time: time
    teacher_id: Optional[int] = None
    term_id: Optional[int] = None
    cancelled_by_event_id: Optional[int] = None
    cancellation_reason: Optional[str] = None

    @property
    def is_cancelled(self) -> bool:
        return self.cancelled_by_event_id is not None

    def to_dict(self) -> dict[str, Any]:
        return {
            "schedule_id": self.schedule_id,
            "subject_id": self.subject_id,
            "faculty_id": self.faculty_id,
            "semester": self.semester,
            "session_date": self.session_date.isoformat(),
            "start_time": self.start_time.strftime("%H:%M"),
            "end_time": self.end_time.strftime("%H:%M"),
            "teacher_id": self.teacher_id,
            "term_id": self.term_id,
            "cancelled_by_event_id": self.cancelled_by_event_id,
        }


# ----------------------------------------------------------------------------- pure rules


def event_suppresses(
    event: EventInfo,
    d: date,
    *,
    faculty_id: Optional[int],
    subject_id: Optional[int],
    start_time: Optional[time],
    end_time: Optional[time],
    policy: AttendancePolicy,
    kind: str = KIND_REGULAR,
) -> bool:
    """Does ``event`` suppress (holiday/exam) or cancel (cancelled_class) this slot?
    Rule §4.4/§4.5 + §13.6. EXAM events never block make-up sessions (Rule §13.2)."""
    if not event.is_active or not event.covers_date(d) or not event.in_scope(faculty_id, subject_id):
        return False
    if not event.overlaps_slot(start_time, end_time):
        return False
    etype = event.event_type
    if etype == "holiday":
        return True
    if etype == "cancelled_class":
        return True
    if etype == "exam":
        return kind == KIND_REGULAR and policy.exam_days_suspend_classes and not event.attendance_required
    return False


def slot_block_reason(
    d: date,
    *,
    faculty_id: Optional[int],
    subject_id: Optional[int],
    start_time: Optional[time],
    end_time: Optional[time],
    term: Optional[Term],
    events: Iterable[EventInfo],
    policy: AttendancePolicy,
    kind: str = KIND_REGULAR,
) -> tuple[Optional[str], Optional[EventInfo]]:
    """Why a slot on ``d`` would not be held, or ``(None, None)``.

    Precedence: ``between_terms`` -> (regular only) ``exam`` window -> (regular only)
    ``weekly_off`` -> ``holiday`` event -> ``exam`` event -> ``cancelled_class`` event.
    Make-up sessions (Rule §13.2) need only an active term and no holiday/cancellation.
    """
    if term is None or not term.contains(d):
        return REASON_BETWEEN_TERMS, None
    if kind == KIND_REGULAR:
        if policy.exam_days_suspend_classes and term.in_exam_window(d):
            return REASON_EXAM, None
        if d.weekday() in policy.weekly_off_days:
            return REASON_WEEKLY_OFF, None
    matched: dict[str, EventInfo] = {}
    for ev in events:
        if event_suppresses(ev, d, faculty_id=faculty_id, subject_id=subject_id, start_time=start_time,
                            end_time=end_time, policy=policy, kind=kind):
            matched.setdefault(ev.event_type, ev)
    for etype, reason in (("holiday", REASON_HOLIDAY), ("exam", REASON_EXAM), ("cancelled_class", REASON_CANCELLED_CLASS)):
        if etype in matched:
            return reason, matched[etype]
    return None, None


def compute_expected_sessions(
    d: date,
    schedules: Iterable[ScheduleInfo],
    terms: Sequence[Term],
    events: Sequence[EventInfo],
    policy: AttendancePolicy,
) -> list[ExpectedSession]:
    """Expected sessions on ``d`` for the given schedule rows (Rule §4, §13.6)."""
    term = term_for_date(terms, d)
    weekday = d.weekday()
    out: list[ExpectedSession] = []
    for s in schedules:
        if not s.is_active or s.weekday != weekday:
            continue
        reason, event = slot_block_reason(
            d, faculty_id=s.faculty_id, subject_id=s.subject_id, start_time=s.start_time,
            end_time=s.end_time, term=term, events=events, policy=policy, kind=KIND_REGULAR,
        )
        if reason is not None and reason != REASON_CANCELLED_CLASS:
            continue
        out.append(ExpectedSession(
            schedule_id=s.id,
            subject_id=s.subject_id,
            faculty_id=s.faculty_id,
            semester=s.semester,
            session_date=d,
            start_time=s.start_time,
            end_time=s.end_time,
            teacher_id=s.teacher_id,
            term_id=term.id if term else None,
            cancelled_by_event_id=event.id if event is not None else None,
            cancellation_reason=f"Calendar event: {event.title}" if event is not None else None,
        ))
    out.sort(key=lambda e: (e.faculty_id, e.semester, e.start_time, e.subject_id))
    return out


def compute_day_status(
    d: date,
    faculty_id: Optional[int],
    terms: Sequence[Term],
    events: Sequence[EventInfo],
    policy: AttendancePolicy,
) -> dict[str, Any]:
    """Rule §4 ``day_status``: ``{"instructional", "reason", "events"}`` for a cohort's faculty.

    Only day-wide events (no time range, no subject scope) make the whole day
    non-instructional; partial events are listed in ``events`` but leave ``instructional`` true.
    With ``faculty_id=None`` only university-wide events (faculty NULL) apply.
    """
    term = term_for_date(terms, d)
    covering = [ev for ev in events if ev.is_active and ev.covers_date(d) and (ev.faculty_id is None or ev.faculty_id == faculty_id)]
    listed = [ev.to_dict() for ev in sorted(covering, key=lambda e: (e.start_date, e.id or 0))]
    reason: Optional[str] = None
    if term is None:
        reason = REASON_BETWEEN_TERMS
    elif d.weekday() in policy.weekly_off_days:
        reason = REASON_WEEKLY_OFF
    elif policy.exam_days_suspend_classes and term.in_exam_window(d):
        reason = REASON_EXAM
    else:
        day_wide = [ev for ev in covering if ev.subject_id is None and ev.is_full_day]
        if any(ev.event_type == "holiday" for ev in day_wide):
            reason = REASON_HOLIDAY
        elif policy.exam_days_suspend_classes and any(
            ev.event_type == "exam" and not ev.attendance_required for ev in day_wide
        ):
            reason = REASON_EXAM
    return {
        "date": d.isoformat(),
        "instructional": reason is None,
        "reason": reason,
        "term_id": term.id if term else None,
        "events": listed,
    }


def daterange(start: date, end: date):
    """Inclusive date iterator."""
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


# ----------------------------------------------------------------------------- async loaders


async def load_events(db, start: date, end: date, *, types: Optional[Sequence[str]] = SUPPRESSING_EVENT_TYPES) -> list[EventInfo]:
    """Active events overlapping ``[start, end]`` (date ranges honoured). ``types=None`` loads all."""
    from sqlalchemy import func, select

    from app.models import AcademicEvent, EventType

    stmt = select(AcademicEvent).where(
        AcademicEvent.is_active.isnot(False),
        AcademicEvent.start_date <= end,
        func.coalesce(AcademicEvent.end_date, AcademicEvent.start_date) >= start,
    )
    if types is not None:
        members = [m for m in EventType if m.value in types]
        stmt = stmt.where(AcademicEvent.event_type.in_(members))
    rows = (await db.execute(stmt)).scalars().all()
    return [EventInfo.from_model(r) for r in rows]


async def load_schedules(
    db,
    *,
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    subject_id: Optional[int] = None,
    weekdays: Optional[Iterable[int]] = None,
    active_only: bool = True,
) -> list[ScheduleInfo]:
    """Timetable rows as ``ScheduleInfo`` (``academic_year`` is never compared, Rule §3.2)."""
    from sqlalchemy import select

    from app.models.schedule import ClassSchedule, DayOfWeek

    stmt = select(ClassSchedule)
    if active_only:
        stmt = stmt.where(ClassSchedule.is_active.isnot(False))
    if faculty_id is not None:
        stmt = stmt.where(ClassSchedule.faculty_id == faculty_id)
    if semester is not None:
        stmt = stmt.where(ClassSchedule.semester == semester)
    if subject_id is not None:
        stmt = stmt.where(ClassSchedule.subject_id == subject_id)
    if weekdays is not None:
        names = {_PY_WEEKDAY_TO_NAME[w] for w in weekdays}
        stmt = stmt.where(ClassSchedule.day_of_week.in_([DayOfWeek[n] for n in names]))
    rows = (await db.execute(stmt)).scalars().all()
    return [ScheduleInfo.from_model(r) for r in rows]


async def expected_sessions_for_range(
    db,
    start: date,
    end: date,
    *,
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    subject_id: Optional[int] = None,
    policy: Optional[AttendancePolicy] = None,
) -> list[ExpectedSession]:
    """Expected sessions for every date in ``[start, end]`` (batch: 4 queries total)."""
    from app.services.attendance_policy import get_attendance_policy
    from app.services.term_service import load_terms

    if end < start:
        return []
    policy = policy or await get_attendance_policy(db)
    terms = await load_terms(db)
    events = await load_events(db, start, end)
    weekdays = {d.weekday() for d in daterange(start, end)}
    schedules = await load_schedules(db, faculty_id=faculty_id, semester=semester, subject_id=subject_id, weekdays=weekdays)
    out: list[ExpectedSession] = []
    for d in daterange(start, end):
        out.extend(compute_expected_sessions(d, schedules, terms, events, policy))
    return out


async def expected_sessions(
    db,
    d: date,
    *,
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    subject_id: Optional[int] = None,
    policy: Optional[AttendancePolicy] = None,
) -> list[ExpectedSession]:
    """Rule §4: the class sessions that should occur on ``d`` (optionally filtered)."""
    return await expected_sessions_for_range(
        db, d, d, faculty_id=faculty_id, semester=semester, subject_id=subject_id, policy=policy
    )


async def day_statuses(
    db, start: date, end: date, faculty_id: Optional[int] = None, *, policy: Optional[AttendancePolicy] = None
) -> dict[date, dict[str, Any]]:
    """``day_status`` for every date in ``[start, end]`` (batch)."""
    from app.services.attendance_policy import get_attendance_policy
    from app.services.term_service import load_terms

    if end < start:
        return {}
    policy = policy or await get_attendance_policy(db)
    terms = await load_terms(db)
    events = await load_events(db, start, end, types=None)
    return {d: compute_day_status(d, faculty_id, terms, events, policy) for d in daterange(start, end)}


async def day_status(db, d: Optional[date] = None, faculty_id: Optional[int] = None, *, policy: Optional[AttendancePolicy] = None) -> dict[str, Any]:
    """Rule §4: ``{"instructional": bool, "reason": ..., "events": [...]}`` for ``d`` (default today)."""
    d = d or app_today()
    return (await day_statuses(db, d, d, faculty_id, policy=policy))[d]


async def slot_block_reason_for(
    db,
    d: date,
    *,
    faculty_id: int,
    subject_id: int,
    start_time: time,
    end_time: time,
    kind: str = KIND_REGULAR,
    policy: Optional[AttendancePolicy] = None,
) -> tuple[Optional[str], Optional[EventInfo]]:
    """Async wrapper of :func:`slot_block_reason` (used for make-up validation, finalization)."""
    from app.services.attendance_policy import get_attendance_policy
    from app.services.term_service import load_terms

    policy = policy or await get_attendance_policy(db)
    terms = await load_terms(db)
    events = await load_events(db, d, d)
    return slot_block_reason(
        d, faculty_id=faculty_id, subject_id=subject_id, start_time=start_time, end_time=end_time,
        term=term_for_date(terms, d), events=events, policy=policy, kind=kind,
    )


__all__ = [
    "REASON_WEEKLY_OFF",
    "REASON_HOLIDAY",
    "REASON_EXAM",
    "REASON_BETWEEN_TERMS",
    "REASON_CANCELLED_CLASS",
    "KIND_REGULAR",
    "KIND_MAKEUP",
    "weekday_to_day_of_week",
    "day_of_week_to_weekday",
    "EventInfo",
    "ScheduleInfo",
    "ExpectedSession",
    "event_suppresses",
    "slot_block_reason",
    "compute_expected_sessions",
    "compute_day_status",
    "daterange",
    "load_events",
    "load_schedules",
    "expected_sessions_for_range",
    "expected_sessions",
    "day_statuses",
    "day_status",
    "slot_block_reason_for",
]
