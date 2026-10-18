"""Student attendance calendar API (DOMAIN_RULES §8 daily statuses; §13.12 metric fields).

* Day statuses come from ``attendance_metrics.compute_student_day_statuses``: ``present``,
  ``absent``, ``partial``, ``excused``, ``cancelled``, ``unrecorded``, ``no_class``,
  ``future``, ``holiday``, ``weekly_off``, ``exam``, ``between_terms``.
* Month statistics and the subject breakdown come from ``compute_student_metrics`` over the
  month (clipped to enrollment and today); ``term_statistics`` / streaks cover the reporting
  term. All counts are per class session (session-weighted), never per day.
* ``/{student_id}/summary`` defaults to the reporting term (no fixed 180-day window).
Events are read through the instructional calendar (active events only, date ranges honoured).
"""
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, resolve_student_scope
from app.core.database import get_db
from app.models import AttendanceRecord, Student, Subject, User
from app.services.accurate_attendance_calculator import (
    custom_range_term,
    legacy_subject_row,
    metric_fields,
    status_value,
)
from app.services.attendance_metrics import (
    compute_student_day_statuses,
    compute_student_metrics,
    is_countable,
)
from app.services.attendance_policy import get_attendance_policy
from app.services.domain_errors import DomainError

router = APIRouter(prefix="/student-calendar", tags=["student-calendar"])


def _day_kind_counts(days: list[dict[str, Any]], window) -> dict[str, int]:
    """Class-day counts from the service's day statuses, restricted to the metrics window
    (so days before enrollment never count, matching ``compute_student_metrics``)."""
    out = {"days_present": 0, "days_absent": 0, "days_partial": 0, "days_with_classes": 0}
    if not window:
        return out
    lo, hi = window[0].isoformat(), window[1].isoformat()
    for d in days:
        if lo <= d["date"] <= hi and d["status"] in ("present", "absent", "partial"):
            out[f"days_{d['status']}"] += 1
            out["days_with_classes"] += 1
    return out


def _statistics_block(overall: dict[str, Any], day_counts: dict[str, int]) -> dict[str, Any]:
    """Legacy ``statistics`` keys (session counts) + day counts + §13.12 fields."""
    return {
        "total_classes": overall["total_classes"],
        "present": overall["present"],
        "absent": overall["absent"],
        "late": overall["late"],
        "partial": day_counts["days_partial"],
        "attendance_rate": overall["attendance_rate"],
        **day_counts,
        **metric_fields(overall, include_term=False),
    }


async def _student_or_404(db: AsyncSession, student_id: int) -> Student:
    student = (await db.execute(select(Student).where(Student.id == student_id))).scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student with ID {student_id} not found")
    return student


@router.get("/me")
async def get_my_attendance_calendar(
    year: int = Query(..., description="Year for calendar view"),
    month: int = Query(..., description="Month for calendar view (1-12)"),
    term_id: Optional[int] = Query(None, description="Term for streaks/term statistics; default = reporting term"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Attendance calendar for the logged-in student."""
    student = (await db.execute(select(Student).where(Student.user_id == current_user.id))).scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found for current user")
    return await get_student_attendance_calendar(student.id, year, month, term_id, current_user, db)


@router.get("/{student_id}")
async def get_student_attendance_calendar(
    student_id: int,
    year: int = Query(..., description="Year for calendar view"),
    month: int = Query(..., description="Month for calendar view (1-12)"),
    term_id: Optional[int] = Query(None, description="Term for streaks/term statistics; default = reporting term"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Monthly calendar: daily statuses, month statistics, subject breakdown, term streaks."""
    # Students: only themselves; teachers: students of cohorts they teach; admins: anyone.
    await resolve_student_scope(current_user, student_id, db)
    student = await _student_or_404(db, student_id)
    if not student.faculty_id or not student.semester:
        raise HTTPException(status_code=400, detail="Student is not enrolled in a faculty or semester.")
    try:
        start_date = date(year, month, 1)
        end_date = (date(year + (month == 12), month % 12 + 1, 1)) - timedelta(days=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid year or month")

    try:
        policy = await get_attendance_policy(db)
        days = await compute_student_day_statuses(db, student_id, start_date, end_date, policy=policy)
        month_metrics = await compute_student_metrics(
            db, student_id, term=custom_range_term(start_date, end_date, start_date.strftime("%B %Y")), policy=policy
        )
        term_metrics = await compute_student_metrics(db, student_id, term_id=term_id, policy=policy)
    except DomainError as exc:
        raise exc.to_http_exception()

    # Record history for the month (incl. legacy/excluded rows, flagged), one query.
    rec_rows = (await db.execute(
        select(AttendanceRecord, Subject.name)
        .join(Subject, Subject.id == AttendanceRecord.subject_id, isouter=True)
        .where(AttendanceRecord.student_id == student_id, AttendanceRecord.date >= start_date,
               AttendanceRecord.date <= end_date)
        .order_by(AttendanceRecord.date, AttendanceRecord.id)
    )).all()
    session_status = {s["session_id"]: s["session_status"] for d in days for s in d["sessions"]}
    records_by_day: dict[str, list] = defaultdict(list)
    for rec, subject_name in rec_rows:
        st = status_value(rec.status)
        countable = rec.session_id is not None and is_countable(
            st, session_status.get(rec.session_id, ""), bool(rec.excluded_from_metrics)
        )
        records_by_day[rec.date.isoformat()].append({
            "id": rec.id,
            "status": st,
            "subject_id": rec.subject_id,
            "subject_name": subject_name or "Unknown Subject",
            "session_id": rec.session_id,
            "source": rec.source,
            "excluded_from_metrics": bool(rec.excluded_from_metrics),
            "exclusion_reason": rec.exclusion_reason,
            "countable": countable,
            "time_in": rec.time_in,
            "time_out": rec.time_out,
            "location": rec.location,
            "notes": rec.notes,
        })

    ok = {"present", "late"} if policy.late_counts_as_attended else {"present"}
    calendar_days = []
    for d in days:
        countable = [s["record_status"] for s in d["sessions"]
                     if s["record_status"] and is_countable(s["record_status"], s["session_status"], s["excluded_from_metrics"])]
        excused = sum(1 for s in d["sessions"] if s["record_status"] == "excused" and not s["excluded_from_metrics"]
                      and s["session_status"] != "cancelled")
        dd = date.fromisoformat(d["date"])
        calendar_days.append({
            "date": d["date"],
            "day": dd.day,
            "weekday": dd.strftime("%A"),
            "status": d["status"],
            "reason": d["reason"],
            "total_classes": len(countable) + excused,
            "present": sum(1 for s in countable if s == "present"),
            "absent": sum(1 for s in countable if s == "absent"),
            "late": sum(1 for s in countable if s == "late"),
            "attended": sum(1 for s in countable if s in ok),
            "excused": excused,
            "sessions": d["sessions"],
            "events": d["events"],
            "records": records_by_day.get(d["date"], []),
        })

    statistics = _statistics_block(month_metrics.overall, _day_kind_counts(days, month_metrics.window))
    statistics["current_streak"] = term_metrics.streak["current"]
    statistics["longest_streak"] = term_metrics.streak["longest"]
    term = term_metrics.term_context.term
    return {
        "student_id": student_id,
        "student_name": month_metrics.student.get("name") or "Unknown",
        "student_number": student.student_id,
        "year": year,
        "month": month,
        "month_name": start_date.strftime("%B"),
        "calendar_days": calendar_days,
        "statistics": statistics,
        "subject_breakdown": [legacy_subject_row(s) for s in month_metrics.per_subject],
        "term_statistics": {**term_metrics.overall, "streak": term_metrics.streak},
        "term_subject_breakdown": [legacy_subject_row(s) for s in term_metrics.per_subject],
        "term": term.summary() if term else None,
        "term_state": term_metrics.term_state,
        "policy": {"minimum_percentage": policy.minimum_percentage,
                   "late_counts_as_attended": policy.late_counts_as_attended},
    }


@router.get("/{student_id}/summary")
async def get_student_attendance_summary(
    student_id: int,
    start_date: Optional[date] = Query(None, description="Start date (default: reporting term start)"),
    end_date: Optional[date] = Query(None, description="End date (default: reporting term end / today)"),
    term_id: Optional[int] = Query(None, description="Term id; default = reporting term"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Overall attendance summary for a term (default) or an explicit date range."""
    # Students: only themselves; teachers: students of cohorts they teach; admins: anyone.
    await resolve_student_scope(current_user, student_id, db)
    await _student_or_404(db, student_id)
    try:
        policy = await get_attendance_policy(db)
        term = None
        if start_date is not None or end_date is not None:
            from app.core.clock import app_today

            rng_end = end_date or app_today()
            rng_start = start_date or date(1900, 1, 1)  # clipped to the enrollment start by the window
            if rng_start > rng_end:
                raise HTTPException(status_code=400, detail="start_date must be on or before end_date")
            term = custom_range_term(rng_start, rng_end)
        metrics = await compute_student_metrics(db, student_id, term=term, term_id=term_id, policy=policy)
        window = metrics.window
        days = await compute_student_day_statuses(db, student_id, window[0], window[1], policy=policy) if window else []
    except DomainError as exc:
        raise exc.to_http_exception()

    t = metrics.term_context.term
    if window:
        period_start, period_end = window
    elif t is not None:
        period_start, period_end = t.start_date, t.end_date
    else:
        period_start = period_end = None
    return {
        "student_id": student_id,
        "student_name": metrics.student.get("name") or "Unknown",
        "period": {
            "start_date": period_start.isoformat() if period_start else None,
            "end_date": period_end.isoformat() if period_end else None,
            "days": ((period_end - period_start).days + 1) if period_start else 0,
        },
        "statistics": _statistics_block(metrics.overall, _day_kind_counts(days, window)),
        "subject_breakdown": [legacy_subject_row(s) for s in metrics.per_subject],
        "streak": metrics.streak,
        **metric_fields(metrics.overall, term=t, term_state=metrics.term_state),
    }
