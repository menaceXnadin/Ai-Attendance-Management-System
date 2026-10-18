"""Session metrics: planned vs held class sessions (DOMAIN_RULES §4, §5, §8).

DEPRECATED calculation switching: the old "planned / actual / hybrid" denominators are gone.
Attendance percentages come ONLY from :mod:`app.services.attendance_metrics` (held sessions,
session-weighted). This service keeps its public methods and response keys for existing
callers, but now reports:

* ``planned``: instructional days / expected, non-cancelled sessions from the instructional
  calendar for the range (and ``*_to_date`` values clipped to today);
* ``actual``: sessions that were actually held (``class_sessions.status = 'held'``) plus the
  cancelled / unrecorded / upcoming session counts;
* ``deviation``: held days vs planned days to date (informational only);
* ``recommended.method`` is always ``"actual"`` (= held sessions) and ``deprecated: true``.

Read-only: never flushes or commits.
"""
from __future__ import annotations

from datetime import date
from typing import Any, Optional

from sqlalchemy import select

from app.core.clock import app_now
from app.models import ClassSession, SessionStatus, Student
from app.services.academic_calculator import AcademicCalculatorService
from app.services.accurate_attendance_calculator import custom_range_term, metric_fields
from app.services.attendance_metrics import compute_student_metrics
from app.services.attendance_policy import get_attendance_policy
from app.services.class_sessions import finalize_point

RECOMMENDED = {
    "method": "actual",
    "reason": "Attendance percentages use held class sessions only (DOMAIN_RULES §8); "
              "planned/hybrid denominators are deprecated.",
    "use_case": "Use for all attendance percentages, eligibility and risk bands",
    "deprecated": True,
}


class SessionMetricsService:
    """Planned vs held sessions for a range; percentages delegate to ``attendance_metrics``."""

    def __init__(self, db):
        self.db = db
        self.academic_calculator = AcademicCalculatorService(db)

    async def _student_cohort(self, student_id: int) -> tuple[Optional[int], Optional[int]]:
        row = (await self.db.execute(select(Student.faculty_id, Student.semester).where(Student.id == student_id))).first()
        return (row.faculty_id, row.semester) if row else (None, None)

    async def _held_metrics(self, start: date, end: date, *, faculty_id=None, semester=None, subject_id=None) -> dict[str, Any]:
        policy = await get_attendance_policy(self.db)
        now = app_now()
        stmt = select(ClassSession.session_date, ClassSession.end_time, ClassSession.status).where(
            ClassSession.session_date >= start, ClassSession.session_date <= end
        )
        if faculty_id is not None:
            stmt = stmt.where(ClassSession.faculty_id == faculty_id)
        if semester is not None:
            stmt = stmt.where(ClassSession.semester == semester)
        if subject_id is not None:
            stmt = stmt.where(ClassSession.subject_id == subject_id)
        held_dates: set[date] = set()
        counts = {"held": 0, "cancelled": 0, "unrecorded": 0, "upcoming": 0}
        for sdate, end_t, status in (await self.db.execute(stmt)).all():
            s = str(status)
            if s == SessionStatus.held:
                counts["held"] += 1
                held_dates.add(sdate)
            elif s == SessionStatus.cancelled:
                counts["cancelled"] += 1
            elif finalize_point(sdate, end_t, policy.finalize_grace_minutes) < now:
                counts["unrecorded"] += 1
            else:
                counts["upcoming"] += 1
        dates = sorted(held_dates)
        return {"conducted_days": len(dates), "conducted_periods": counts["held"], "unique_dates": dates, "sessions": counts}

    async def get_comprehensive_metrics(
        self,
        start_date: date,
        end_date: date,
        student_id: Optional[int] = None,
        subject_id: Optional[int] = None,
        semester: Optional[int] = None,
        academic_year: Optional[int] = None,
        faculty_id: Optional[int] = None,
    ) -> dict[str, Any]:
        """Planned vs held sessions (legacy keys kept). With ``student_id`` the scope is the
        student's cohort and ``student_metrics`` carries the Rule §8 block for the range."""
        today = app_now().date()
        student_metrics = None
        if student_id is not None:
            faculty_id, semester = await self._student_cohort(student_id)
            m = await compute_student_metrics(self.db, student_id, term=custom_range_term(start_date, end_date),
                                              subject_id=subject_id)
            student_metrics = metric_fields(m.overall, term=m.term_context.term, term_state=m.term_state)
            student_metrics["window"] = m.to_dict()["window"]
        planned = await self.academic_calculator.calculate_academic_metrics(
            start_date, end_date, semester=semester, faculty_id=faculty_id
        )
        to_date_end = min(end_date, today)
        if to_date_end >= start_date:
            planned_to_date = await self.academic_calculator.calculate_academic_metrics(
                start_date, to_date_end, semester=semester, faculty_id=faculty_id
            )
        else:
            planned_to_date = {"total_academic_days": 0, "total_periods": 0}
        actual = await self._held_metrics(start_date, end_date, faculty_id=faculty_id, semester=semester, subject_id=subject_id)
        deviation = self._analyze_deviation(planned_to_date, actual)
        result = {
            "planned": {
                "total_academic_days": planned["total_academic_days"],
                "total_periods": planned["total_periods"],
                "academic_days_to_date": planned_to_date["total_academic_days"],
                "periods_to_date": planned_to_date["total_periods"],
                "source": "instructional calendar (terms, timetable, holidays/exams)",
                "description": "Expected class sessions from the timetable",
            },
            "actual": {
                "total_conducted_days": actual["conducted_days"],
                "total_conducted_periods": actual["conducted_periods"],
                "unique_dates": [d.isoformat() for d in actual["unique_dates"]],
                "sessions": actual["sessions"],
                "source": "class_sessions",
                "description": "Class sessions that were actually held (attendance taken)",
            },
            "recommended": dict(RECOMMENDED),
            "deviation": deviation,
            "metadata": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "student_id": student_id,
                "subject_id": subject_id,
                "faculty_id": faculty_id,
                "semester": semester,
                "academic_year": academic_year,
                "calculation_timestamp": app_now().isoformat(),
            },
        }
        if student_metrics is not None:
            result["student_metrics"] = student_metrics
        return result

    @staticmethod
    def _analyze_deviation(planned_to_date: dict[str, Any], actual: dict[str, Any]) -> dict[str, Any]:
        planned_days = planned_to_date.get("total_academic_days", 0)
        actual_days = actual.get("conducted_days", 0)
        count = actual_days - planned_days
        pct = (count / planned_days * 100) if planned_days > 0 else 0
        if abs(count) <= 2:
            severity, impact = "minimal", "negligible"
        elif abs(count) <= 5:
            severity, impact = "moderate", "noticeable"
        else:
            severity, impact = "significant", "substantial"
        causes = []
        sessions = actual.get("sessions", {})
        if count > 0:
            causes.append("Make-up sessions held on days without a planned class")
        elif count < 0:
            if sessions.get("unrecorded"):
                causes.append(f"{sessions['unrecorded']} past session(s) have no attendance recorded yet")
            if sessions.get("cancelled"):
                causes.append(f"{sessions['cancelled']} session(s) were cancelled")
        return {
            "count": count,
            "percentage": round(pct, 2),
            "severity": severity,
            "impact": impact,
            "direction": "more_than_planned" if count > 0 else "less_than_planned" if count < 0 else "matches_plan",
            "likely_causes": causes,
            "recommendation": (
                "Held sessions match the plan." if severity == "minimal"
                else "Resolve unrecorded sessions (record attendance or cancel them) so reports are complete."
            ),
        }

    async def calculate_attendance_with_deviation_awareness(
        self,
        student_id: int,
        start_date: date,
        end_date: date,
        calculation_method: str = "hybrid",
    ) -> dict[str, Any]:
        """Student attendance for a range. ``calculation_method`` is accepted for backward
        compatibility but ignored: the percentage is always the Rule §8 held-session value."""
        m = await compute_student_metrics(self.db, student_id, term=custom_range_term(start_date, end_date))
        o = m.overall
        breakdown = await self.get_comprehensive_metrics(start_date, end_date, student_id=student_id)
        return {
            "present_days": o["attended"],
            "total_days_used": o["considered"],
            "percentage": o["attendance_percentage"],
            "calculation_method": "held_sessions",
            "requested_method": calculation_method,
            "metrics_breakdown": breakdown,
            "deviation_alert": breakdown["deviation"]["severity"] != "minimal",
            "recommendation": breakdown["recommended"],
            # Rule §13.12 block (``percentage`` here may be null; the legacy top-level one stays numeric)
            "metrics": metric_fields(o, term=m.term_context.term, term_state=m.term_state),
            "has_data": o["has_data"],
            "term": m.term_context.term.summary() if m.term_context.term else None,
            "term_state": m.term_state,
        }


async def get_session_metrics(db, start_date: date, end_date: date, student_id: Optional[int] = None, **kwargs) -> dict[str, Any]:
    """Convenience wrapper around :meth:`SessionMetricsService.get_comprehensive_metrics`."""
    return await SessionMetricsService(db).get_comprehensive_metrics(start_date, end_date, student_id=student_id, **kwargs)


__all__ = ["SessionMetricsService", "get_session_metrics"]
