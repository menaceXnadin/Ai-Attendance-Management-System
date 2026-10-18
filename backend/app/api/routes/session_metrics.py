"""Session metrics API: planned vs held class sessions (DOMAIN_RULES §4, §5, §8, §13.12).

The planned/actual/hybrid denominator switching is deprecated: every attendance percentage
returned here is the Rule §8 held-session value from ``attendance_metrics`` (for the given
date range, clipped to enrollment and today). ``calculation_method`` is accepted and ignored.
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, resolve_student_scope
from app.core.database import get_db
from app.models import Student, User
from app.services.accurate_attendance_calculator import custom_range_term, metric_fields
from app.services.attendance_metrics import compute_student_metrics
from app.services.domain_errors import DomainError
from app.services.session_metrics_service import SessionMetricsService

router = APIRouter(prefix="/session-metrics", tags=["session-metrics"])


def _check_range(start_date: date, end_date: date) -> None:
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be on or before end_date")
    if (end_date - start_date).days > 800:
        raise HTTPException(status_code=400, detail="Date range too large (max 800 days)")


async def _own_student(db: AsyncSession, current_user: User) -> Student:
    student = (await db.execute(select(Student).where(Student.user_id == current_user.id))).scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found for current user")
    return student


@router.get("/comprehensive")
async def get_comprehensive_session_metrics(
    start_date: date = Query(..., description="Period start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Period end date (YYYY-MM-DD)"),
    student_id: Optional[int] = Query(None, description="Filter by student ID"),
    subject_id: Optional[int] = Query(None, description="Filter by subject ID"),
    semester: Optional[int] = Query(None, description="Filter by semester (1-8)"),
    academic_year: Optional[int] = Query(None, description="Informational label only"),
    faculty_id: Optional[int] = Query(None, description="Filter by faculty"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Planned sessions (instructional calendar) vs held sessions (class_sessions)."""
    _check_range(start_date, end_date)
    # A supplied student_id must be in scope (students: self; teachers: their cohorts).
    if student_id is not None:
        student_id = await resolve_student_scope(current_user, student_id, db)
    try:
        return await SessionMetricsService(db).get_comprehensive_metrics(
            start_date=start_date, end_date=end_date, student_id=student_id, subject_id=subject_id,
            semester=semester, academic_year=academic_year, faculty_id=faculty_id,
        )
    except DomainError as exc:
        raise exc.to_http_exception()


@router.get("/attendance-with-deviation")
async def calculate_attendance_with_deviation(
    start_date: date = Query(..., description="Period start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Period end date (YYYY-MM-DD)"),
    calculation_method: str = Query("hybrid", description="Deprecated (ignored)", pattern="^(planned|actual|hybrid)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The logged-in student's attendance for a range (Rule §8) with planned/held context."""
    _check_range(start_date, end_date)
    student = await _own_student(db, current_user)
    try:
        return await SessionMetricsService(db).calculate_attendance_with_deviation_awareness(
            student_id=student.id, start_date=start_date, end_date=end_date, calculation_method=calculation_method
        )
    except DomainError as exc:
        raise exc.to_http_exception()


@router.get("/deviation-summary")
async def get_deviation_summary(
    start_date: date = Query(..., description="Period start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Period end date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Planned (to date) vs held class days, with unrecorded/cancelled session counts."""
    _check_range(start_date, end_date)
    metrics = await SessionMetricsService(db).get_comprehensive_metrics(start_date=start_date, end_date=end_date)
    deviation = metrics["deviation"]
    if deviation["severity"] == "minimal":
        status, message = "healthy", "Session counts are in sync"
    elif deviation["count"] > 0:
        status, message = "info", f"{deviation['count']} more class days held than planned"
    else:
        status, message = "warning", f"{abs(deviation['count'])} fewer class days held than planned - resolve unrecorded sessions"
    return {
        "planned_total": metrics["planned"]["academic_days_to_date"],
        "planned_total_full_range": metrics["planned"]["total_academic_days"],
        "actual_total": metrics["actual"]["total_conducted_days"],
        "deviation": deviation["count"],
        "deviation_percentage": deviation["percentage"],
        "severity": deviation["severity"],
        "status": status,
        "message": message,
        "likely_causes": deviation["likely_causes"],
        "sessions": metrics["actual"]["sessions"],
    }


@router.get("/student-specific")
async def get_student_specific_metrics(
    start_date: date = Query(..., description="Period start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Period end date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Session metrics for the logged-in student (Rule §8 percentage for the range)."""
    _check_range(start_date, end_date)
    student = await _own_student(db, current_user)
    try:
        m = await compute_student_metrics(db, student.id, term=custom_range_term(start_date, end_date))
        metrics = await SessionMetricsService(db).get_comprehensive_metrics(
            start_date=start_date, end_date=end_date, student_id=student.id
        )
    except DomainError as exc:
        raise exc.to_http_exception()
    o = m.overall
    planned = metrics["planned"]["periods_to_date"]
    with_records = o["considered"] + o["excused"]
    return {
        "student_info": {"id": student.id, "name": m.student.get("name") or "Unknown", "semester": student.semester},
        "planned_classes": planned,
        "actual_classes_student_has_records": with_records,
        "attended_classes": o["attended"],
        "attendance_percentage": o["attendance_percentage"],
        "deviation_from_plan": with_records - planned,
        "missed_opportunities": o["absent"],
        "metrics_detail": metrics,
        **metric_fields(o, term=m.term_context.term, term_state=m.term_state),
    }
