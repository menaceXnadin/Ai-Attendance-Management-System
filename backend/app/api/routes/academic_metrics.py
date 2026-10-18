"""Academic metrics API (DOMAIN_RULES §3 terms, §4 instructional calendar, §8/§13.12 metrics).

Planned academic days/periods come from the instructional calendar (term window, weekly off
days, holiday/exam events, timetable); CLASS marker events are not required and
``academic_year`` labels never filter. ``/current-semester`` reports the term resolved by
``term_service`` (current term, else the most recent past term; ``term_id`` overrides) — no
hard-coded "Fall 2025" — and, for a student (the caller, or ``student_id`` within scope),
the Rule §8 attendance metrics for that term.
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, has_role, resolve_student_scope
from app.core.database import get_db
from app.models import Student, User
from app.services.academic_calculator import (
    AcademicCalculatorService,
    get_semester_academic_metrics,
    term_academic_metrics,
)
from app.services.accurate_attendance_calculator import legacy_subject_row, metric_fields
from app.services.attendance_metrics import compute_student_metrics
from app.services.domain_errors import DomainError

router = APIRouter(prefix="/academic-metrics", tags=["Academic Metrics"])


def _check_range(start_date: date, end_date: date) -> None:
    if start_date >= end_date:
        raise HTTPException(status_code=400, detail="Start date must be before end date")
    if (end_date - start_date).days > 800:
        raise HTTPException(status_code=400, detail="Date range too large (max 800 days)")


@router.get("/calculate")
async def calculate_academic_metrics(
    start_date: date = Query(..., description="Range start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Range end date (YYYY-MM-DD)"),
    semester: Optional[int] = Query(None, description="Semester number (1-8)", ge=1, le=8),
    academic_year: Optional[int] = Query(None, description="Informational label only (never filters)", ge=2000),
    faculty_id: Optional[int] = Query(None, description="Faculty (cohort) filter"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Planned academic days and periods for a date range (instructional calendar)."""
    _check_range(start_date, end_date)
    metrics = await AcademicCalculatorService(db).calculate_academic_metrics(
        start_date=start_date, end_date=end_date, semester=semester, academic_year=academic_year, faculty_id=faculty_id
    )
    return {
        "success": True,
        "data": metrics,
        "filters": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "semester": semester,
            "academic_year": academic_year,
            "faculty_id": faculty_id,
        },
    }


@router.get("/current-semester")
async def get_current_semester_academic_metrics(
    term_id: Optional[int] = Query(None, description="Term id; default = current term, else most recent past term"),
    student_id: Optional[int] = Query(None, description="Student (students.id); students always get their own"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Planned days/periods for the reporting term (+ the student's Rule §8 metrics)."""
    if has_role(current_user, "student") or student_id is not None:
        student_id = await resolve_student_scope(current_user, student_id, db)
    faculty_id = semester = None
    if student_id is not None:
        row = (await db.execute(select(Student.faculty_id, Student.semester).where(Student.id == student_id))).first()
        if row is None:
            raise HTTPException(status_code=404, detail="Student not found")
        faculty_id, semester = row.faculty_id, row.semester
    try:
        data = await term_academic_metrics(db, semester=semester, faculty_id=faculty_id, term_id=term_id)
        student_block = None
        if student_id is not None:
            m = await compute_student_metrics(db, student_id, term_id=term_id)
            student_block = {
                "student_id": student_id,
                **m.overall,
                "per_subject": [legacy_subject_row(s) for s in m.per_subject],
                "streak": m.streak,
                "window": m.to_dict()["window"],
            }
            data.update(metric_fields(m.overall, term=m.term_context.term, term_state=m.term_state))
            data["attendance"] = student_block
    except DomainError as exc:
        raise exc.to_http_exception()
    info = data["semester_info"]
    return {
        "success": True,
        "data": data,
        "semester_info": {
            "id": info["id"],
            "name": info["name"],
            "start_date": info["start_date"],
            "end_date": info["end_date"],
            "academic_year": info["academic_year"],
            "is_current": info["is_current"],
        },
        "term": data["term"],
        "term_state": data["term_state"],
    }


@router.get("/detailed-breakdown")
async def get_detailed_schedule_breakdown(
    start_date: date = Query(..., description="Range start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Range end date (YYYY-MM-DD)"),
    semester: Optional[int] = Query(None, description="Semester number (1-8)", ge=1, le=8),
    academic_year: Optional[int] = Query(None, description="Informational label only (never filters)", ge=2000),
    faculty_id: Optional[int] = Query(None, description="Faculty (cohort) filter"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Instructional days with their planned sessions (batch computed)."""
    _check_range(start_date, end_date)
    breakdown = await AcademicCalculatorService(db).get_detailed_schedule_breakdown(
        start_date=start_date, end_date=end_date, semester=semester, academic_year=academic_year, faculty_id=faculty_id
    )
    return {"success": True, "data": breakdown}


@router.get("/summary")
async def get_academic_summary(
    start_date: date = Query(..., description="Range start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Range end date (YYYY-MM-DD)"),
    semester: Optional[int] = Query(None, ge=1, le=8),
    faculty_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """``{total_academic_days, total_periods}`` for a date range."""
    _check_range(start_date, end_date)
    metrics = await get_semester_academic_metrics(db, start_date, end_date, semester=semester, faculty_id=faculty_id)
    return {
        "total_academic_days": metrics["total_academic_days"],
        "total_periods": metrics["total_periods"],
        "instructional_days": metrics["instructional_days"],
    }


@router.get("/validate-data")
async def validate_academic_data(
    start_date: date = Query(..., description="Range start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Range end date (YYYY-MM-DD)"),
    semester: Optional[int] = Query(None, ge=1, le=8),
    faculty_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Instructional days that have no planned periods (timetable setup check)."""
    _check_range(start_date, end_date)
    validation = await AcademicCalculatorService(db).validate(start_date, end_date, faculty_id=faculty_id, semester=semester)
    return {"success": True, "validation": validation}
