"""
Student Attendance API Routes (the logged-in student's own data).

Every percentage comes from ``app.services.attendance_metrics`` (DOMAIN_RULES §8, §13.12):
session-weighted, held sessions only, legacy/excluded records never counted. Legacy numeric
fields (``percentage_present``, ``total_academic_days``, ...) stay numbers (0 without data);
the §13.12 fields (``percentage`` null without data, ``has_data``, ``considered``, ``attended``,
``excused``, ``unrecorded``, ``eligible``, ``eligibility_provisional``, ``band``, ``term``,
``term_state``) are added alongside. Optional ``term_id`` selects another term.
"""

import math
from collections import defaultdict
from datetime import date, datetime, timedelta
from fractions import Fraction
from typing import Any, Dict, Iterable, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user
from app.core.clock import app_now, combine_local
from app.core.database import get_db
from app.models import AttendanceRecord, AttendanceStatus, ClassSchedule, ClassSession, Student, Subject, User
from app.services.attendance_metrics import (
    Counts,
    StudentMetrics,
    attended_statuses,
    compute_streaks,
    compute_student_metrics,
    day_flags_from_records,
    is_countable,
    summarize_counts,
)
from app.services.attendance_policy import AttendancePolicy, display_percentage, get_attendance_policy
from app.services.domain_errors import DomainError
from app.services.instructional_calendar import day_statuses, expected_sessions_for_range

router = APIRouter(prefix="/student-attendance", tags=["student-attendance"])

_WEEKDAY_NAMES = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
GOAL_TARGETS = (75, 80, 85, 90, 95)


# ============================================================================ helpers


async def _current_student(db: AsyncSession, current_user: User) -> Student:
    student = (await db.execute(select(Student).where(Student.user_id == current_user.id))).scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")
    return student


async def _metrics(db: AsyncSession, student: Student, term_id: Optional[int], policy: AttendancePolicy,
                   now: datetime) -> StudentMetrics:
    try:
        return await compute_student_metrics(db, student.id, term_id=term_id, policy=policy, now=now)
    except DomainError as err:
        raise err.to_http_exception()


def _status(value: Any) -> str:
    return str(getattr(value, "value", value) or "").lower()


def _share(part: int, whole: int) -> float:
    """Legacy numeric share (0 when nothing is considered)."""
    pct = display_percentage(part, whole)
    return pct if pct is not None else 0.0


def _metric_fields(m: StudentMetrics) -> Dict[str, Any]:
    """The Rule §13.12 block (overall)."""
    o = m.overall
    term = m.term_context.term
    return {
        "percentage": o["percentage"],
        "has_data": o["has_data"],
        "considered": o["considered"],
        "attended": o["attended"],
        "excused": o["excused"],
        "unrecorded": o["unrecorded"],
        "cancelled_sessions": o["cancelled_sessions"],
        "eligible": o["eligible"],
        "eligibility_provisional": o["eligibility_provisional"],
        "band": o["band"],
        "band_label": o.get("band_label"),
        "minimum_percentage": m.policy.minimum_percentage,
        "term": term.summary() if term else None,
        "term_state": m.term_state,
    }


async def _countable_rows(db: AsyncSession, student_id: int, start: date, end: date) -> List[tuple]:
    """``(session_date, subject_id, status, confidence)`` of the student's countable records in
    ``[start, end]`` (countability decided by ``attendance_metrics.is_countable``)."""
    if end < start:
        return []
    rows = (await db.execute(
        select(ClassSession.session_date, ClassSession.subject_id, AttendanceRecord.status,
               AttendanceRecord.confidence_score, ClassSession.status, AttendanceRecord.excluded_from_metrics)
        .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
        .where(AttendanceRecord.student_id == student_id,
               ClassSession.session_date >= start, ClassSession.session_date <= end)
        .order_by(ClassSession.session_date, ClassSession.start_time)
    )).all()
    out = []
    for sdate, subj, rstatus, conf, sstatus, excluded in rows:
        rs = _status(rstatus)
        if is_countable(rs, sstatus, bool(excluded)):
            out.append((sdate, subj, rs, float(conf) if conf is not None else None))
    return out


def _avg_confidence(rows: Iterable[tuple]) -> float:
    values = [r[3] for r in rows if r[3] is not None]
    return round(sum(values) / len(values), 2) if values else 0.0


async def _term_plan(db: AsyncSession, student: Student, m: StudentMetrics, policy: AttendancePolicy,
                     now: datetime) -> Dict[str, int]:
    """Planned instructional days / expected sessions of the reporting term for the student's
    cohort (from the instructional calendar), and how many are still ahead of ``now``."""
    term = m.term_context.term
    plan = {"instructional_days": 0, "planned_sessions": 0, "planned_to_date": 0, "remaining_sessions": 0}
    if term is None or student.faculty_id is None:
        return plan
    statuses = await day_statuses(db, term.start_date, term.end_date, student.faculty_id, policy=policy)
    plan["instructional_days"] = sum(1 for v in statuses.values() if v["instructional"])
    expected = await expected_sessions_for_range(db, term.start_date, term.end_date, faculty_id=student.faculty_id,
                                                 semester=student.semester, policy=policy)
    start = m.window[0] if m.window else term.start_date
    planned = [e for e in expected if not e.is_cancelled and e.session_date >= start]
    remaining = sum(1 for e in planned if combine_local(e.session_date, e.start_time) > now)
    plan["planned_sessions"] = len(planned)
    plan["remaining_sessions"] = remaining
    plan["planned_to_date"] = len(planned) - remaining
    return plan


def _deviation_severity(deviation: int, planned: int) -> str:
    if deviation <= 0:
        return "minimal"
    ratio = deviation / planned if planned else 1.0
    return "minimal" if ratio < 0.1 else "moderate" if ratio < 0.25 else "significant"


# ============================================================================ summary


@router.get("/summary")
async def get_student_attendance_summary(
    term_id: Optional[int] = Query(None, description="Report on this term instead of the current/most recent one"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Attendance summary for the current student (metrics service, Rule §8/§13.12)."""
    student = await _current_student(db, current_user)
    policy = await get_attendance_policy(db)
    now = app_now()
    m = await _metrics(db, student, term_id, policy, now)
    plan = await _term_plan(db, student, m, policy, now)
    o = m.overall
    term = m.term_context.term
    rows = await _countable_rows(db, student.id, *m.window) if m.window else []
    deviation = o["unrecorded"] + o["cancelled_sessions"]
    semester_start = term.start_date.isoformat() if term else None
    semester_end = term.end_date.isoformat() if term else None
    academic_metrics = {
        "total_academic_days": plan["instructional_days"],
        "total_periods": plan["planned_sessions"],
        "semester_start_date": semester_start,
        "semester_end_date": semester_end,
        "term": term.summary() if term else None,
        "term_state": m.term_state,
    }

    data = m.to_dict()
    data.update(_metric_fields(m))
    data.update({
        "total_academic_days": plan["instructional_days"],
        "total_periods": plan["planned_sessions"],
        "session_metrics": {
            "planned_classes": plan["planned_to_date"],
            "actual_conducted_classes": o["considered"] + o["excused"],
            "calculation_method_used": "sessions",
            "deviation": deviation,
            "deviation_severity": _deviation_severity(deviation, plan["planned_to_date"]),
            "has_deviation": deviation > 0,
        },
        "semester_start_date": semester_start,
        "semester_end_date": semester_end,
        # session-based counts (legacy field names)
        "present": o["present"],
        "absent": o["absent"],
        "late": o["late"],
        "total_used_for_calculation": o["considered"],
        "total_days_with_attendance": o["considered"],
        "days_with_any_attendance": o["considered"],
        "percentage_present": o["percentage_present"],
        "percentage_absent": _share(o["absent"], o["considered"]),
        "percentage_late": _share(o["late"], o["considered"]),
        "present_periods": o["present"],
        "absent_periods": o["absent"],
        "late_periods": o["late"],
        "total_periods_marked": o["considered"] + o["excused"],
        "remaining_sessions": plan["remaining_sessions"],
        "average_confidence": _avg_confidence(rows),
        "academic_metrics": academic_metrics,
    })
    return data


# ============================================================================ records


@router.get("/records")
async def get_student_attendance_records(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    subject_id: Optional[int] = Query(None, description="Filter by subject"),
    status: Optional[str] = Query(None, description="Filter by status (present/absent/late/excused)"),
    limit: int = Query(50, ge=1, le=500, description="Number of records to return"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Detailed attendance records (history, including records not counted in metrics)."""
    student = await _current_student(db, current_user)

    query = select(AttendanceRecord).options(
        selectinload(AttendanceRecord.subject)
    ).where(AttendanceRecord.student_id == student.id)
    try:
        if start_date:
            query = query.where(AttendanceRecord.date >= date.fromisoformat(start_date))
        if end_date:
            query = query.where(AttendanceRecord.date <= date.fromisoformat(end_date))
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")
    if subject_id:
        query = query.where(AttendanceRecord.subject_id == subject_id)
    if status:
        try:
            query = query.where(AttendanceRecord.status == AttendanceStatus(status.strip().lower()))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown status '{status}'")
    query = query.order_by(desc(AttendanceRecord.date), desc(AttendanceRecord.created_at)).offset(offset).limit(limit)
    records = (await db.execute(query)).scalars().all()

    formatted_records = []
    for record in records:
        marked_at = record.time_in or record.created_at
        formatted_records.append({
            "id": record.id,
            "date": record.date.isoformat(),
            "subject_id": record.subject_id,
            "subject_name": record.subject.name if record.subject else "Unknown",
            "status": _status(record.status),
            "marked_at": marked_at.isoformat() if marked_at else None,
            "confidence_score": float(record.confidence_score) if record.confidence_score is not None else None,
            "method": _status(record.method),
            "notes": record.notes,
            "session_id": record.session_id,
            "source": record.source,
            "time_slot": record.time_slot,
            "excluded_from_metrics": bool(record.excluded_from_metrics),
        })

    return {
        "records": formatted_records,
        "total": len(formatted_records),
        "offset": offset,
        "limit": limit
    }


# ============================================================================ subject breakdown


def _trend(statuses: List[str], ok: frozenset) -> str:
    """Recent 10 countable sessions vs the 10 before them."""
    if len(statuses) < 10:
        return "stable"
    recent, older = statuses[-10:], statuses[-20:-10]
    if not older:
        return "stable"
    recent_pct = sum(1 for s in recent if s in ok) / len(recent) * 100
    older_pct = sum(1 for s in older if s in ok) / len(older) * 100
    if recent_pct > older_pct + 10:
        return "up"
    if recent_pct < older_pct - 10:
        return "down"
    return "stable"


@router.get("/subject-breakdown")
async def get_subject_attendance_breakdown(
    term_id: Optional[int] = Query(None),
    envelope: bool = Query(False, description="Return {subjects, total_subjects, ...metric fields} instead of the legacy bare list"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Per-subject attendance for the current student (metrics service per_subject + the
    cohort's timetable subjects without data yet)."""
    student = await _current_student(db, current_user)
    policy = await get_attendance_policy(db)
    now = app_now()
    m = await _metrics(db, student, term_id, policy, now)
    per_subject = {s["subject_id"]: dict(s) for s in m.per_subject}

    if student.faculty_id is not None:
        missing = (await db.execute(
            select(Subject.id, Subject.name, Subject.code)
            .join(ClassSchedule, ClassSchedule.subject_id == Subject.id)
            .where(ClassSchedule.faculty_id == student.faculty_id, ClassSchedule.semester == student.semester,
                   ClassSchedule.is_active.isnot(False))
            .distinct()
        )).all()
        for sid, name, code in missing:
            if sid not in per_subject:
                per_subject[sid] = {"subject_id": sid, "subject_name": name, "subject_code": code,
                                    **summarize_counts(Counts(), policy)}

    rows = await _countable_rows(db, student.id, *m.window) if m.window else []
    by_subject: Dict[int, List[tuple]] = defaultdict(list)
    for r in rows:
        by_subject[r[1]].append(r)
    ok = attended_statuses(policy)

    subject_breakdown = []
    for sid, s in per_subject.items():
        srows = by_subject.get(sid, [])
        streak = compute_streaks(day_flags_from_records([(r[0], r[2]) for r in srows], policy))
        item = dict(s)
        item.update({
            "total_classes": s["total_classes"],
            "attended_classes": s["attended"],
            "present_classes": s["present"],
            "absent_classes": s["absent"],
            "late_classes": s["late"],
            "excused_classes": s["excused"],
            "last_attendance": max((r[0] for r in srows), default=None),
            "streak": streak["current"],
            "longest_streak": streak["longest"],
            "trend": _trend([r[2] for r in srows], ok),
            "average_confidence": _avg_confidence(srows),
        })
        if item["last_attendance"] is not None:
            item["last_attendance"] = item["last_attendance"].isoformat()
        subject_breakdown.append(item)
    subject_breakdown.sort(key=lambda x: ((x.get("subject_name") or "").lower(), x["subject_id"]))

    if not envelope:
        # Legacy contract: a bare list of per-subject rows (StudentAttendanceReport reads it as an array).
        return subject_breakdown
    return {
        "subjects": subject_breakdown,
        "total_subjects": len(subject_breakdown),
        **_metric_fields(m),
    }


# ============================================================================ analytics


def calculate_daily_breakdown(rows: List[tuple], policy: AttendancePolicy) -> Dict[str, Any]:
    """Per weekday: present/absent/late/total counts of countable sessions + attended %."""
    ok = attended_statuses(policy)
    daily_stats: Dict[str, Dict[str, Any]] = {}
    for sdate, _subj, status, _conf in rows:
        day = _WEEKDAY_NAMES[sdate.weekday()]
        stats = daily_stats.setdefault(day, {"present": 0, "absent": 0, "late": 0, "total": 0, "attended": 0})
        if status in ("present", "absent", "late"):
            stats[status] += 1
        stats["total"] += 1
        if status in ok:
            stats["attended"] += 1
    for stats in daily_stats.values():
        stats["percentage"] = _share(stats["attended"], stats["total"])
    return daily_stats


def calculate_weekly_trends(rows: List[tuple], policy: AttendancePolicy) -> List[Dict[str, Any]]:
    ok = attended_statuses(policy)
    weekly: Dict[str, Dict[str, int]] = {}
    for sdate, _subj, status, _conf in rows:
        week = sdate.strftime('%Y-W%U')
        data = weekly.setdefault(week, {"present": 0, "total": 0})
        if status in ok:
            data["present"] += 1
        data["total"] += 1
    return [
        {"week": week, "percentage": _share(d["present"], d["total"]), "present": d["present"], "total": d["total"]}
        for week, d in sorted(weekly.items())
    ]


def calculate_best_day(daily: Dict[str, Any]) -> Optional[str]:
    return max(daily.items(), key=lambda kv: kv[1]["percentage"])[0] if daily else None


def calculate_worst_day(daily: Dict[str, Any]) -> Optional[str]:
    return min(daily.items(), key=lambda kv: kv[1]["percentage"])[0] if daily else None


def calculate_consistency_score(weekly: List[Dict[str, Any]]) -> float:
    """100 - standard deviation of weekly attended % (0 without data)."""
    if not weekly:
        return 0
    if len(weekly) < 2:
        return 100
    values = [w["percentage"] for w in weekly]
    mean = sum(values) / len(values)
    std_dev = (sum((v - mean) ** 2 for v in values) / len(values)) ** 0.5
    return round(max(0, 100 - std_dev), 2)


def generate_improvement_suggestions(rows: List[tuple], daily: Dict[str, Any], consistency: float,
                                     policy: AttendancePolicy) -> List[str]:
    if not rows:
        return ["No recorded classes in this period yet."]
    minimum = policy.minimum_percentage
    suggestions = [
        f"Focus on improving {day} attendance ({stats['percentage']:.1f}%)"
        for day, stats in daily.items() if stats["percentage"] < minimum
    ]
    ok = attended_statuses(policy)
    recent = rows[-10:]
    recent_pct = sum(1 for r in recent if r[2] in ok) / len(recent) * 100
    if recent_pct < minimum:
        suggestions.append(f"Your recent attendance is below {minimum:g}%. Consider setting daily reminders.")
    if consistency < 70:
        suggestions.append("Try to maintain consistent attendance patterns throughout the week.")
    if not suggestions:
        suggestions.append("Great job! Keep maintaining your excellent attendance record.")
    return suggestions


@router.get("/analytics")
async def get_student_attendance_analytics(
    period: str = Query("semester", description="Analysis period (week/month/semester/year)"),
    term_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Attendance analytics for the current student over a period (countable sessions only)."""
    student = await _current_student(db, current_user)
    policy = await get_attendance_policy(db)
    now = app_now()
    m = await _metrics(db, student, term_id, policy, now)

    end_date = now.date()
    if period == "week":
        start_date = end_date - timedelta(days=7)
    elif period == "month":
        start_date = end_date - timedelta(days=30)
    elif period == "year":
        start_date = date(end_date.year, 1, 1)
    else:  # semester (default): the metrics window of the reporting term
        period = "semester"
        if m.window:
            start_date, end_date = m.window
        else:
            term = m.term_context.term
            start_date = term.start_date if term else end_date

    rows = await _countable_rows(db, student.id, start_date, end_date)
    counts = Counts()
    for r in rows:
        counts.add_record(r[2], "held")
    daily = calculate_daily_breakdown(rows, policy)
    weekly = calculate_weekly_trends(rows, policy)
    consistency = calculate_consistency_score(weekly)

    return {
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_records": len(rows),
        "daily_breakdown": daily,
        "weekly_trends": weekly,
        "best_day": calculate_best_day(daily),
        "worst_day": calculate_worst_day(daily),
        "consistency_score": consistency,
        "improvement_suggestions": generate_improvement_suggestions(rows, daily, consistency, policy),
        "period_summary": summarize_counts(counts, policy),
        **_metric_fields(m),
    }


# ============================================================================ goals


def _goal(target: float, attended: int, considered: int, remaining: int, current_pct: float) -> Dict[str, Any]:
    """Sessions still to attend to finish the term at ``target`` %, given ``remaining`` planned
    sessions: smallest x with (attended + x) / (considered + remaining) >= target / 100."""
    total = considered + remaining
    if total == 0:
        needed = 0
        achievable = True
        max_pct = None
    else:
        needed = max(0, math.ceil(Fraction(target) * total / 100 - attended))
        achievable = needed <= remaining
        max_pct = round((attended + remaining) * 100 / total, 2)
    return {
        "target_percentage": target,
        "current_percentage": current_pct,
        "classes_needed": int(needed),
        "remaining_days": remaining,
        "remaining_sessions": remaining,
        "is_achievable": achievable,
        "max_achievable_percentage": max_pct,
        "difficulty": "easy" if needed <= remaining * 0.5 else "medium" if achievable else "hard",
    }


@router.get("/goals")
async def get_attendance_goals(
    term_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Attendance goals for the current student: sessions needed to reach each target by the end
    of the term (remaining = planned sessions of the term still ahead)."""
    student = await _current_student(db, current_user)
    policy = await get_attendance_policy(db)
    now = app_now()
    m = await _metrics(db, student, term_id, policy, now)
    plan = await _term_plan(db, student, m, policy, now)
    o = m.overall
    remaining = plan["remaining_sessions"]
    current_pct = o["percentage_present"]
    targets = sorted({float(t) for t in GOAL_TARGETS} | {float(policy.minimum_percentage)})
    goals = [_goal(t if t % 1 else int(t), o["attended"], o["considered"], remaining, current_pct) for t in targets]

    return {
        "goals": goals,
        "current_status": {
            "percentage": current_pct,
            "present_days": o["attended"],
            "total_days": plan["instructional_days"],
            "remaining_days": remaining,
            "attended": o["attended"],
            "considered": o["considered"],
            "remaining_sessions": remaining,
            "planned_sessions": plan["planned_sessions"],
        },
        **_metric_fields(m),
    }
