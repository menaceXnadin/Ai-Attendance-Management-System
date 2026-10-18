"""Academic days & planned periods (DOMAIN_RULES §3, §3.2, §4).

Terms come from :mod:`app.services.term_service` (``semester_configurations``); there is no
month heuristic and no automatic Fall/Spring period. Instructional days and planned periods
come from :mod:`app.services.instructional_calendar` (term instruction window, weekly off
days, holiday/exam events with faculty/subject scope). CLASS marker events are not required
and ``academic_year`` labels are never used to decide whether a timetable row applies.

Attendance *percentages* are not computed here (Rule §8: only ``attendance_metrics``).

Definitions used by the responses:

* ``class_days_breakdown``: one entry per instructional day in the range (for the requested
  faculty; university-wide events only when no faculty is given) with ``periods_count`` =
  expected, non-cancelled sessions that day for the filters.
* ``total_academic_days``: instructional days with at least one planned period.
* ``instructional_days``: all instructional days (including days without periods).
* ``total_periods``: planned (expected, not event-cancelled) sessions in the range.

Read-only: never flushes or commits.
"""
from __future__ import annotations

from collections import Counter
from datetime import date
from typing import Any, Optional

from sqlalchemy import select

from app.core.clock import app_today
from app.models import SemesterConfiguration
from app.services.attendance_policy import AttendancePolicy, get_attendance_policy
from app.services.instructional_calendar import day_statuses, expected_sessions_for_range
from app.services.term_service import (
    Term,
    get_current_term,
    get_term_context,
    get_term_for_date,
)


class SemesterService:
    """Backward-compatible facade over ``term_service`` (Rule §3: the current term is decided by
    dates, never by the stored ``is_current`` flag). Returns ORM rows for existing callers."""

    def __init__(self, db):
        self.db = db

    async def _row(self, term: Optional[Term]) -> Optional[SemesterConfiguration]:
        if term is None or term.id is None:
            return None
        return await self.db.get(SemesterConfiguration, term.id)

    async def get_current_semester(self) -> Optional[SemesterConfiguration]:
        """The active term containing ``app_today()`` (``None`` between terms)."""
        return await self._row(await get_current_term(self.db))

    async def get_semester_by_id(self, semester_id: int) -> Optional[SemesterConfiguration]:
        return await self.db.get(SemesterConfiguration, semester_id)

    async def get_semester_by_date(self, target_date: date) -> Optional[SemesterConfiguration]:
        """The active term containing ``target_date``."""
        return await self._row(await get_term_for_date(self.db, target_date))

    async def get_all_semesters(self, active_only: bool = True) -> list[SemesterConfiguration]:
        query = select(SemesterConfiguration)
        if active_only:
            query = query.where(SemesterConfiguration.is_active.is_(True))
        query = query.order_by(SemesterConfiguration.start_date.desc(), SemesterConfiguration.id.desc())
        return list((await self.db.execute(query)).scalars().all())


class AcademicCalculatorService:
    """Instructional days and planned periods for a date range (Rule §4)."""

    def __init__(self, db):
        self.db = db
        self._policy: Optional[AttendancePolicy] = None

    async def policy(self) -> AttendancePolicy:
        if self._policy is None:
            self._policy = await get_attendance_policy(self.db)
        return self._policy

    async def _instructional_days(self, start_date: date, end_date: date, faculty_id: Optional[int] = None) -> list[date]:
        statuses = await day_statuses(self.db, start_date, end_date, faculty_id, policy=await self.policy())
        return [d for d, info in sorted(statuses.items()) if info["instructional"]]

    async def _planned_sessions(self, start_date: date, end_date: date, *, semester: Optional[int] = None,
                                faculty_id: Optional[int] = None):
        sessions = await expected_sessions_for_range(
            self.db, start_date, end_date, faculty_id=faculty_id, semester=semester, policy=await self.policy()
        )
        return [s for s in sessions if not s.is_cancelled], [s for s in sessions if s.is_cancelled]

    async def calculate_academic_metrics(
        self,
        start_date: date,
        end_date: date,
        semester: Optional[int] = None,
        academic_year: Optional[int] = None,  # informational label only (Rule §3.2); never filters
        faculty_id: Optional[int] = None,
    ) -> dict[str, Any]:
        days = await self._instructional_days(start_date, end_date, faculty_id)
        planned, cancelled = await self._planned_sessions(start_date, end_date, semester=semester, faculty_id=faculty_id)
        per_day = Counter(s.session_date for s in planned)
        breakdown = [
            {"date": d.isoformat(), "day_of_week": d.strftime("%A").lower(), "periods_count": per_day.get(d, 0)}
            for d in days
        ]
        return {
            "total_academic_days": sum(1 for d in days if per_day.get(d, 0) > 0),
            "total_periods": len(planned),
            "instructional_days": len(days),
            "cancelled_periods": len(cancelled),
            "class_days_breakdown": breakdown,
        }

    async def _get_class_days(self, start_date: date, end_date: date, faculty_id: Optional[int] = None) -> list[date]:
        """Instructional days in the range (CLASS marker events are not required, Rule §4.6)."""
        return await self._instructional_days(start_date, end_date, faculty_id)

    async def _get_periods_for_day(self, class_date: date, semester: Optional[int] = None,
                                   academic_year: Optional[int] = None, faculty_id: Optional[int] = None) -> int:
        planned, _ = await self._planned_sessions(class_date, class_date, semester=semester, faculty_id=faculty_id)
        return len(planned)

    async def get_detailed_schedule_breakdown(
        self,
        start_date: date,
        end_date: date,
        semester: Optional[int] = None,
        academic_year: Optional[int] = None,
        faculty_id: Optional[int] = None,
    ) -> dict[str, Any]:
        from app.models import Faculty, Subject
        from app.models.schedule import ClassSchedule

        days = await self._instructional_days(start_date, end_date, faculty_id)
        planned, _ = await self._planned_sessions(start_date, end_date, semester=semester, faculty_id=faculty_id)
        subject_ids = {s.subject_id for s in planned}
        faculty_ids = {s.faculty_id for s in planned}
        schedule_ids = {s.schedule_id for s in planned if s.schedule_id is not None}
        subjects = dict((await self.db.execute(select(Subject.id, Subject.name).where(Subject.id.in_(subject_ids)))).all()) if subject_ids else {}
        faculties = dict((await self.db.execute(select(Faculty.id, Faculty.name).where(Faculty.id.in_(faculty_ids)))).all()) if faculty_ids else {}
        rooms = dict((await self.db.execute(select(ClassSchedule.id, ClassSchedule.classroom).where(ClassSchedule.id.in_(schedule_ids)))).all()) if schedule_ids else {}
        by_day: dict[date, list] = {}
        for s in planned:
            by_day.setdefault(s.session_date, []).append(s)
        daily = []
        for d in days:
            items = sorted(by_day.get(d, []), key=lambda s: (s.start_time, s.subject_id))
            daily.append({
                "date": d.isoformat(),
                "day_of_week": d.strftime("%A"),
                "periods_count": len(items),
                "subjects": [
                    {
                        "subject_id": s.subject_id,
                        "subject_name": subjects.get(s.subject_id, "Unknown"),
                        "start_time": s.start_time.strftime("%H:%M"),
                        "end_time": s.end_time.strftime("%H:%M"),
                        "classroom": rooms.get(s.schedule_id),
                        "faculty": faculties.get(s.faculty_id, "Unknown"),
                        "faculty_id": s.faculty_id,
                        "semester": s.semester,
                    }
                    for s in items
                ],
            })
        return {
            "total_academic_days": sum(1 for day in daily if day["periods_count"] > 0),
            "total_periods": sum(day["periods_count"] for day in daily),
            "instructional_days": len(daily),
            "date_range": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "daily_breakdown": daily,
        }

    async def validate(self, start_date: date, end_date: date, *, faculty_id: Optional[int] = None,
                       semester: Optional[int] = None) -> dict[str, Any]:
        """Instructional days without any planned period (setup check), batch computed."""
        metrics = await self.calculate_academic_metrics(start_date, end_date, semester=semester, faculty_id=faculty_id)
        issues = [
            {"date": day["date"], "day_of_week": date.fromisoformat(day["date"]).strftime("%A"),
             "issue": "No scheduled subjects found", "periods_count": 0}
            for day in metrics["class_days_breakdown"] if day["periods_count"] == 0
        ]
        return {
            "total_class_days": metrics["instructional_days"],
            "days_with_issues": issues,
            "summary": {
                "days_without_schedules": len(issues),
                "days_with_empty_schedules": len(issues),
                "total_issues": len(issues),
            },
            "data_integrity": "good" if not issues else "needs_attention",
        }


# ============================================================================ term-level helpers


def _semester_info(term: Optional[Term], *, name: Optional[str] = None, semester_number: Optional[int] = None) -> dict[str, Any]:
    today = app_today()
    if term is None:
        return {"id": None, "name": name or "No academic term configured", "semester_number": semester_number,
                "academic_year": None, "is_current": False, "start_date": None, "end_date": None}
    return {
        "id": term.id,
        "name": name or term.name,
        "semester_number": semester_number,
        "academic_year": term.academic_year,
        "is_current": term.is_current(today),
        "start_date": term.start_date.isoformat(),
        "end_date": term.end_date.isoformat(),
    }


async def term_academic_metrics(
    db,
    *,
    semester: Optional[int] = None,
    faculty_id: Optional[int] = None,
    term_id: Optional[int] = None,
    name: Optional[str] = None,
) -> dict[str, Any]:
    """Planned days/periods for the reporting term (Rule §3: current term, else the most recent
    past term; ``term_id`` overrides). Always returns the legacy keys; when no term exists the
    counts are 0, ``term`` is ``None`` and the legacy date strings fall back to today."""
    ctx = await get_term_context(db, term_id=term_id)
    term = ctx.term
    if term is None:
        metrics = {"total_academic_days": 0, "total_periods": 0, "instructional_days": 0,
                   "cancelled_periods": 0, "class_days_breakdown": []}
        today = app_today().isoformat()
        start_s = end_s = today
    else:
        metrics = await AcademicCalculatorService(db).calculate_academic_metrics(
            term.start_date, term.end_date, semester=semester, faculty_id=faculty_id
        )
        start_s, end_s = term.start_date.isoformat(), term.end_date.isoformat()
    return {
        **metrics,
        "semester_info": _semester_info(term, name=name if term else None, semester_number=semester),
        "semester_start_date": start_s,
        "semester_end_date": end_s,
        "term": term.summary() if term else None,
        "term_state": ctx.state,
    }


async def get_semester_academic_metrics(
    db,
    semester_start: date,
    semester_end: date,
    semester: Optional[int] = None,
    academic_year: Optional[int] = None,
    faculty_id: Optional[int] = None,
) -> dict[str, Any]:
    """Planned days/periods for an explicit date range."""
    return await AcademicCalculatorService(db).calculate_academic_metrics(
        semester_start, semester_end, semester=semester, academic_year=academic_year, faculty_id=faculty_id
    )


async def get_current_semester_metrics(db, *, faculty_id: Optional[int] = None, semester: Optional[int] = None,
                                       term_id: Optional[int] = None) -> dict[str, Any]:
    """Planned days/periods for the reporting term (all cohorts unless filtered)."""
    return await term_academic_metrics(db, semester=semester, faculty_id=faculty_id, term_id=term_id)


async def get_student_specific_semester_metrics(db, student_semester: int, faculty_id: Optional[int] = None,
                                                term_id: Optional[int] = None) -> dict[str, Any]:
    """Planned days/periods of the reporting term for one cohort (semester [+ faculty])."""
    ctx_name = None
    data = await term_academic_metrics(db, semester=student_semester, faculty_id=faculty_id, term_id=term_id)
    if data["term"] is not None:
        ctx_name = f"Semester {student_semester} - {data['term']['name']}"
        data["semester_info"]["name"] = ctx_name
    return data


__all__ = [
    "SemesterService",
    "AcademicCalculatorService",
    "term_academic_metrics",
    "get_semester_academic_metrics",
    "get_current_semester_metrics",
    "get_student_specific_semester_metrics",
]
