"""Attendance analytics (DOMAIN_RULES §8 metrics, §2 policy bands, §13.12 fields).

Every percentage/rate here is attended/considered over *countable* records (held session,
present/late/absent, not excluded, on/after enrollment) via ``attendance_metrics`` and the
batch adapters in ``accurate_attendance_calculator``. Risk levels come from the policy bands;
"no data" is reported as ``unknown`` (never "critical"). Legacy numeric fields stay numbers
(0 when there is no data); the nullable ``percentage``/``has_data`` fields say whether data exists.
"""
from collections import defaultdict
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, resolve_student_scope
from app.core.clock import app_now, app_today
from app.core.database import get_db
from app.models import Mark, Student, Subject, User
from app.services.accurate_attendance_calculator import (
    counts_by_date,
    countable_student_day_rows,
    legacy_subject_row,
    metric_fields,
    risk_level_for_band,
    subject_labels,
    subject_tallies,
)
from app.services.attendance_metrics import Counts, compute_student_metrics, compute_students_overall, summarize_counts
from app.services.attendance_policy import get_attendance_policy
from app.services.domain_errors import DomainError
from app.services.term_service import get_term_context

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _fmt(pct) -> str:
    return f"{pct:.1f}%" if pct is not None else "n/a"


def _sum_counts(per_day: dict, days=None) -> Counts:
    total = Counts()
    for d, c in per_day.items():
        if days is None or d in days:
            total.add(c)
    return total


@router.get("/class-averages")
async def get_class_averages(
    class_id: Optional[int] = None,
    term_id: Optional[int] = Query(None, description="Term id; default = reporting term"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """School-wide attendance average (session-weighted over the reporting term) and marks."""
    try:
        overall = await compute_students_overall(db, term_id=term_id)
    except DomainError as exc:
        raise exc.to_http_exception()
    agg = overall["aggregate"]
    marks = (await db.execute(
        select(func.avg(Mark.marks_obtained * 100.0 / Mark.total_marks)).where(Mark.total_marks > 0)
    )).scalar()
    return {
        "averageAttendance": agg["attendance_rate"],
        "averageMarks": round(float(marks), 2) if marks is not None else 0.0,
        "classId": class_id,
        "calculatedAt": app_now().isoformat(),
        **metric_fields(agg, term=overall["term"], term_state=overall["term_state"]),
    }


@router.get("/student-insights/{student_id}")
async def get_student_insights(
    student_id: int,
    term_id: Optional[int] = Query(None, description="Term id; default = reporting term"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Insights for one student: Rule §8 term metrics, policy-band risk, short-term trend."""
    # Students: only themselves; teachers: students of cohorts they teach; admins: anyone.
    await resolve_student_scope(current_user, student_id, db)
    row = (await db.execute(
        select(Student, User.full_name, User.email).join(User, User.id == Student.user_id, isouter=True)
        .where(Student.id == student_id)
    )).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Student not found")
    student, full_name, email = row
    try:
        policy = await get_attendance_policy(db)
        m = await compute_student_metrics(db, student_id, term_id=term_id, policy=policy)
    except DomainError as exc:
        raise exc.to_http_exception()
    o = m.overall
    pct = o["percentage"]
    risk_level = risk_level_for_band(o["band"], policy)

    # Trend: last 7 class days vs the 7 before, over countable records in the metrics window.
    recent_average = previous_average = change = None
    if m.window is not None:
        per_day = await counts_by_date(db, m.window[0], m.window[1], student_ids=[student_id])
        class_days = sorted(d for d, c in per_day.items() if c.present + c.late + c.absent)
        recent = summarize_counts(_sum_counts(per_day, set(class_days[-7:])), policy)["percentage"]
        previous = summarize_counts(_sum_counts(per_day, set(class_days[-14:-7])), policy)["percentage"]
        recent_average, previous_average = recent, previous
        if recent is not None and previous is not None:
            change = recent - previous
    improving = change is not None and change >= 3
    declining = change is not None and change <= -3

    minimum = policy.minimum_percentage
    recommendations = []
    if pct is None:
        recommendations.append("No held classes have been recorded for this student in the selected term yet.")
    else:
        top = policy.bands[0] if policy.bands else None
        if o["eligible"] is False:
            recommendations.append(
                f"Attendance is {_fmt(pct)}, below the {minimum:g}% requirement. Immediate improvement needed."
            )
            recommendations.append("Consider meeting with your academic advisor to discuss strategies for better attendance.")
        elif top is not None and o["band"] == top.name:
            recommendations.append("Excellent attendance! Keep up the great work.")
        else:
            recommendations.append(f"Attendance is {_fmt(pct)}. Work on improving consistency.")
        low_subjects = [s["subject_name"] or f"Subject {s['subject_id']}" for s in m.per_subject if s["eligible"] is False]
        if low_subjects:
            recommendations.append(f"Below {minimum:g}% in: {', '.join(low_subjects)}.")
        if o["absent"] > 5:
            recommendations.append(
                f"You have {o['absent']} recorded absences. Focus on attending upcoming classes and follow up on missed work."
            )
        if o["late"] > 3:
            recommendations.append("There are several late arrivals. Aim to arrive before class starts.")
    if o["unrecorded"]:
        recommendations.append(
            f"{o['unrecorded']} past class session(s) have no attendance recorded yet; figures are provisional."
        )
    if improving:
        recommendations.append("Recent attendance shows improvement. Maintain this positive trend.")
    if declining:
        recommendations.append("Attendance has dipped compared to the previous class days. Identify and address the obstacles.")

    return {
        "student": {
            "id": student.id,
            "student_id": student.student_id,
            "name": full_name or "Unknown",
            "email": email or "Unknown",
            "semester": student.semester or 1,
            "faculty": student.faculty or "Unknown",
            "faculty_id": student.faculty_id or 0,
        },
        "attendance": {
            "totalClasses": o["total_classes"],
            "attendedClasses": o["attended"],
            "absentClasses": o["absent"],
            "lateClasses": o["late"],
            "excusedClasses": o["excused"],
            "percentage": o["attendance_percentage"],  # legacy numeric (0 when no data)
            **{k: v for k, v in metric_fields(o, include_term=False).items() if k != "percentage"},
        },
        "riskLevel": risk_level,
        "trends": {
            "improving": improving,
            "declining": declining,
            "stable": not improving and not declining,
            "recentAverage": recent_average,
            "previousAverage": previous_average,
            "change": round(change, 2) if change is not None else None,
        },
        "recommendations": recommendations,
        "subjects": [legacy_subject_row(s) for s in m.per_subject],
        "streak": m.streak,
        "minimum_percentage": minimum,
        **metric_fields(o, term=m.term_context.term, term_state=m.term_state),
    }


@router.get("/attendance-trends")
async def get_attendance_trends(
    student_id: Optional[int] = None,
    days: int = Query(30, ge=1, le=366),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Daily attendance rate over the last ``days`` days (countable records only)."""
    # A supplied student_id must be in the caller's scope (students: self only;
    # teachers: their cohorts). Without student_id, students get their own trend.
    student_id = await resolve_student_scope(current_user, student_id, db)
    policy = await get_attendance_policy(db)
    today = app_today()
    start = today - timedelta(days=days - 1)
    per_day = await counts_by_date(db, start, today, student_ids=[student_id] if student_id else None)
    chart = []
    for d in sorted(per_day):
        s = summarize_counts(per_day[d], policy)
        if not s["considered"]:
            continue
        chart.append({
            "date": d.isoformat(),
            "attendance_rate": s["attendance_rate"],
            "total_classes": s["considered"],
            "attended_classes": s["attended"],
            "percentage": s["percentage"],
            "excused": s["excused"],
        })
    return chart


@router.get("/weekly-breakdown")
async def get_weekly_breakdown(
    days: int = Query(7, ge=1, le=366),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Day-by-day attendance for the last ``days`` days (countable records only)."""
    policy = await get_attendance_policy(db)
    today = app_today()
    start_date = today - timedelta(days=days - 1)
    per_day = await counts_by_date(db, start_date, today)
    breakdown = []
    total_records = 0
    for i in range(days):
        d = start_date + timedelta(days=i)
        s = summarize_counts(per_day.get(d, Counts()), policy)
        total_records += s["considered"]
        breakdown.append({
            "date": d.isoformat(),
            "day": d.strftime("%a"),
            "present": s["present"],
            "absent": s["absent"],
            "late": s["late"],
            "excused": s["excused"],
            "total": s["considered"],
            "attended": s["attended"],
            "percentage": s["attendance_rate"],  # legacy numeric
            "has_data": s["has_data"],
        })
    return {
        "breakdown": breakdown,
        "summary": {
            "total_records": total_records,
            "period_days": days,
            "start_date": start_date.isoformat(),
            "end_date": today.isoformat(),
        },
    }


@router.get("/top-performers")
async def get_top_performers(
    limit: int = 10,
    min_classes: int = 5,
    term_id: Optional[int] = Query(None, description="Term id; default = reporting term"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Students with the highest attendance (Rule §8, batch computed)."""
    try:
        policy = await get_attendance_policy(db)
        overall = await compute_students_overall(db, term_id=term_id, policy=policy)
    except DomainError as exc:
        raise exc.to_http_exception()
    students = {
        r.id: r for r in (await db.execute(
            select(Student.id, Student.student_id, Student.faculty, Student.semester, User.full_name, User.email)
            .join(User, User.id == Student.user_id)
        )).all()
    }
    # Trend: last 7 days vs the previous 7 (countable records), one query for everyone.
    today = app_today()
    recent_cut = today - timedelta(days=6)
    trend_counts: dict[int, dict[str, Counts]] = defaultdict(lambda: {"recent": Counts(), "previous": Counts()})
    for sid, d, status in await countable_student_day_rows(db, today - timedelta(days=13), today):
        bucket = trend_counts[sid]["recent" if d >= recent_cut else "previous"]
        setattr(bucket, status, getattr(bucket, status) + 1)

    performers = []
    total = Counts()
    for sid, s in overall["students"].items():
        info = students.get(sid)
        if info is None or s["considered"] < min_classes:
            continue
        total.present += s["present"]
        total.late += s["late"]
        total.absent += s["absent"]
        recent = summarize_counts(trend_counts[sid]["recent"], policy)["percentage"] if sid in trend_counts else None
        previous = summarize_counts(trend_counts[sid]["previous"], policy)["percentage"] if sid in trend_counts else None
        trend = "stable"
        if recent is not None and previous is not None:
            trend = "up" if recent > previous else "down" if recent < previous else "stable"
        performers.append({
            "student_id": info.student_id,
            "id": sid,
            "name": info.full_name,
            "email": info.email,
            "attendance_rate": s["attendance_rate"],
            "total_classes": s["total_classes"],
            "present_count": s["present"],
            "late_count": s["late"],
            "absent_count": s["absent"],
            "trend": trend,
            "recent_rate": recent if recent is not None else 0.0,
            "faculty": info.faculty,
            "semester": info.semester,
            "risk_level": risk_level_for_band(s["band"], policy),
            **metric_fields(s, include_term=False),
        })
    performers.sort(key=lambda x: (-(x["percentage"] or 0), -x["considered"], x["name"] or ""))
    agg = summarize_counts(total, policy)
    return {
        "top_performers": performers[:limit],
        "total_students": len(performers),
        "average_attendance": agg["attendance_rate"],
        "term": overall["term"],
        "term_state": overall["term_state"],
    }


@router.get("/subject-wise")
async def get_subject_wise_analytics(
    term_id: Optional[int] = Query(None, description="Term id; default = reporting term"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Attendance per subject over the reporting term (3 batch queries, no per-subject loop)."""
    try:
        policy = await get_attendance_policy(db)
        ctx = await get_term_context(db, term_id=term_id)
    except DomainError as exc:
        raise exc.to_http_exception()
    analytics = []
    if ctx.term is not None:
        end = min(ctx.term.end_date, app_today())
        tallies = await subject_tallies(db, ctx.term.start_date, end, policy=policy)
        labels = await subject_labels(db, tallies.keys())
        for subj, t in tallies.items():
            s = summarize_counts(t.counts, policy)
            if not (s["considered"] or s["excused"] or t.held_sessions):
                continue
            name, code = labels.get(subj, (None, None))
            analytics.append({
                "subject_id": subj,
                "subject_name": name,
                "subject_code": code,
                "total_classes": s["total_classes"],
                "present": s["present"],
                "absent": s["absent"],
                "late": s["late"],
                "attendance_rate": s["attendance_rate"],
                "unique_students": t.students,
                "held_sessions": t.held_sessions,
                "first_class": t.first_class.isoformat() if t.first_class else None,
                "last_class": t.last_class.isoformat() if t.last_class else None,
                **metric_fields(s, include_term=False),
            })
    analytics.sort(key=lambda x: (-(x["percentage"] or 0), x["subject_name"] or ""))
    with_data = [a for a in analytics if a["has_data"]]
    total = Counts()
    for a in with_data:
        total.present += a["present"]
        total.late += a["late"]
        total.absent += a["absent"]
    return {
        "subjects": analytics,
        "total_subjects": len(analytics),
        "average_rate": summarize_counts(total, policy)["attendance_rate"],
        "term": ctx.term.summary() if ctx.term else None,
        "term_state": ctx.state,
    }


@router.get("/insights")
async def get_intelligent_insights(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rule-based insights over countable attendance (thresholds from the policy)."""
    policy = await get_attendance_policy(db)
    minimum = policy.minimum_percentage
    top = policy.bands[0].min_percentage if policy.bands else 90.0
    insights = []
    today = app_today()
    ctx = await get_term_context(db)
    if ctx.state != "active":
        insights.append({
            "type": "info", "priority": "medium", "title": "Between Terms" if ctx.state == "between_terms" else "No Terms Configured",
            "description": "No academic term is active today; classes and auto-absent are paused.",
            "action": "Semester Setup", "icon": "calendar",
        })

    per_day = await counts_by_date(db, today - timedelta(days=29), today)
    today_s = summarize_counts(per_day.get(today, Counts()), policy)
    if not today_s["has_data"]:
        insights.append({
            "type": "info", "priority": "medium", "title": "No Attendance Today",
            "description": f"No attendance has been recorded for held classes on {today.strftime('%B %d, %Y')}.",
            "action": "View Calendar", "icon": "calendar",
        })
    elif today_s["eligible"] is False:
        insights.append({
            "type": "warning", "priority": "high", "title": "Low Attendance Alert",
            "description": f"Today's attendance is {_fmt(today_s['percentage'])}, below the {minimum:g}% requirement. "
                           f"{today_s['absent']} absences recorded.",
            "action": "View Details", "icon": "alert-triangle",
        })
    elif today_s["percentage"] >= top:
        insights.append({
            "type": "success", "priority": "low", "title": "Excellent Attendance",
            "description": f"Today's attendance is {_fmt(today_s['percentage'])} with {today_s['attended']} attended class slots.",
            "action": "View Report", "icon": "check-circle",
        })

    absences: dict[int, int] = defaultdict(int)
    for sid, d, status in await countable_student_day_rows(db, today - timedelta(days=6), today):
        if status == "absent":
            absences[sid] += 1
    high_absence = [sid for sid, n in absences.items() if n >= 3]
    if high_absence:
        insights.append({
            "type": "warning", "priority": "high", "title": "Students Need Attention",
            "description": f"{len(high_absence)} students have been absent 3+ times in the last week. Consider reaching out.",
            "action": "View Students", "icon": "user-x",
        })

    month = summarize_counts(_sum_counts(per_day), policy)
    if month["has_data"]:
        insights.append({
            "type": "info", "priority": "medium", "title": "30-Day Performance",
            "description": f"Overall attendance for the last 30 days is {_fmt(month['percentage'])} across "
                           f"{month['considered']} recorded class slots.",
            "action": "View Trends", "icon": "trending-up" if month["eligible"] else "trending-down",
        })
    return {"insights": insights, "generated_at": app_now().isoformat(), "total_insights": len(insights)}


@router.get("/dashboard-summary")
async def get_dashboard_summary(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Today / last 7 days / last 30 days summary over countable records."""
    policy = await get_attendance_policy(db)
    today = app_today()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    per_day = await counts_by_date(db, month_ago, today)

    def block(start, extra):
        s = summarize_counts(_sum_counts(per_day, {d for d in per_day if start <= d <= today}), policy)
        return {
            **extra,
            "total_records": s["considered"],
            "considered": s["considered"],
            "present": s["present"],
            "late": s["late"],
            "absent": s["absent"],
            "excused": s["excused"],
            "attended": s["attended"],
            "rate": s["attendance_rate"],
            "percentage": s["percentage"],
            "has_data": s["has_data"],
            # Rule §13.12 additions: the server decides band and eligibility.
            "band": s["band"],
            "band_label": s["band_label"],
            "eligible": s["eligible"],
            "eligibility_provisional": s["eligibility_provisional"],
        }

    total_students = (await db.execute(select(func.count(Student.id)))).scalar() or 0
    total_subjects = (await db.execute(select(func.count(Subject.id)))).scalar() or 0
    month_block = block(month_ago, {"start_date": month_ago.isoformat(), "end_date": today.isoformat()})
    return {
        "today": block(today, {"date": today.isoformat()}),
        "this_week": block(week_ago, {"start_date": week_ago.isoformat(), "end_date": today.isoformat()}),
        "this_month": month_block,
        "system": {
            "total_students": total_students,
            "total_subjects": total_subjects,
            "total_attendance_records": month_block["total_records"],
        },
        "minimum_percentage": policy.minimum_percentage,
    }
