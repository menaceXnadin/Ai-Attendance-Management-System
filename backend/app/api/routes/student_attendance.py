"""
Student Attendance API Routes
Comprehensive attendance management for students
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, asc, case
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models import User, AttendanceStatus
from app.models import Student, AttendanceRecord, Subject
from app.models.schedule import ClassSchedule
from app.models.calendar import AcademicEvent
from app.services.academic_calculator import get_current_semester_metrics, get_student_specific_semester_metrics
from app.services.session_metrics_service import SessionMetricsService
from app.services.automatic_semester import AutomaticSemesterService

router = APIRouter(prefix="/student-attendance", tags=["student-attendance"])

@router.get("/summary")
async def get_student_attendance_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive attendance summary for the current student"""
    
    # Get student record
    student_query = select(Student).where(Student.user_id == current_user.id)
    result = await db.execute(student_query)
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")
    
    # Get academic metrics for current time period but use student's individual semester
    # This fixes the bug where all students were seeing semester 5 data regardless of their actual semester
    academic_metrics = await get_student_specific_semester_metrics(db, student.semester)
    
    # Get attendance summary - COUNT UNIQUE DAYS, NOT INDIVIDUAL PERIODS
    # This fixes the bug where we were mixing periods (19) with days (113)
    
    # Query for unique days with present status
    present_days_query = select(func.count(func.distinct(func.date(AttendanceRecord.date)))).where(
        and_(AttendanceRecord.student_id == student.id, AttendanceRecord.status == AttendanceStatus.present)
    )
    present_days_result = await db.execute(present_days_query)
    present_days = present_days_result.scalar() or 0
    
    # Query for unique days with absent status  
    absent_days_query = select(func.count(func.distinct(func.date(AttendanceRecord.date)))).where(
        and_(AttendanceRecord.student_id == student.id, AttendanceRecord.status == AttendanceStatus.absent)
    )
    absent_days_result = await db.execute(absent_days_query)
    absent_days = absent_days_result.scalar() or 0
    
    # Query for unique days with late status
    late_days_query = select(func.count(func.distinct(func.date(AttendanceRecord.date)))).where(
        and_(AttendanceRecord.student_id == student.id, AttendanceRecord.status == AttendanceStatus.late)
    )
    late_days_result = await db.execute(late_days_query)
    late_days = late_days_result.scalar() or 0
    
    # Also get period counts for detailed reporting
    period_query = select(
        func.count(AttendanceRecord.id).label('total_records'),
        func.sum(case((AttendanceRecord.status == AttendanceStatus.present, 1), else_=0)).label('present_periods'),
        func.sum(case((AttendanceRecord.status == AttendanceStatus.absent, 1), else_=0)).label('absent_periods'),
        func.sum(case((AttendanceRecord.status == AttendanceStatus.late, 1), else_=0)).label('late_periods'),
        func.avg(case((AttendanceRecord.confidence_score.isnot(None), AttendanceRecord.confidence_score), else_=None)).label('avg_confidence')
    ).where(AttendanceRecord.student_id == student.id)
    
    period_result = await db.execute(period_query)
    periods = period_result.first()
    
    # Calculate percentages using DAYS (not periods)
    total_academic_days = academic_metrics.get('total_academic_days', 0)
    
    # Get session metrics for enhanced accuracy
    session_service = SessionMetricsService(db)
    semester_start = datetime.strptime(academic_metrics.get('semester_start_date'), "%Y-%m-%d").date()
    semester_end = datetime.strptime(academic_metrics.get('semester_end_date'), "%Y-%m-%d").date()
    
    session_metrics = await session_service.get_comprehensive_metrics(
        start_date=semester_start,
        end_date=semester_end,
        student_id=student.id,
        semester=student.semester
    )
    
    # Use recommended calculation method from session metrics
    recommended_method = session_metrics["recommended"]["method"]
    
    # Choose denominator based on recommendation
    if recommended_method == "actual":
        total_for_calculation = session_metrics["actual"]["total_conducted_days"]
    else:
        total_for_calculation = total_academic_days
    
    # Use day-based calculation for main percentage
    percentage_present = (present_days / total_for_calculation * 100) if total_for_calculation > 0 else 0
    percentage_absent = (absent_days / total_for_calculation * 100) if total_for_calculation > 0 else 0  
    percentage_late = (late_days / total_for_calculation * 100) if total_for_calculation > 0 else 0
    
    return {
        "total_academic_days": total_academic_days,
        "total_periods": academic_metrics.get('total_periods', 0),
        
        # SESSION METRICS (Planned vs Actual)
        "session_metrics": {
            "planned_classes": session_metrics["planned"]["total_academic_days"],
            "actual_conducted_classes": session_metrics["actual"]["total_conducted_days"],
            "calculation_method_used": recommended_method,
            "deviation": session_metrics["deviation"]["count"],
            "deviation_severity": session_metrics["deviation"]["severity"],
            "has_deviation": session_metrics["deviation"]["severity"] != "minimal"
        },
        
        # DYNAMIC SEMESTER INFO (from database configuration)
        "semester_start_date": academic_metrics.get('semester_start_date'),
        "semester_end_date": academic_metrics.get('semester_end_date'),
        
        # DAY-BASED METRICS (primary) - Using recommended calculation method
        "present": present_days,
        "absent": absent_days,
        "late": late_days,
        "total_used_for_calculation": total_for_calculation,
        "total_days_with_attendance": present_days + absent_days + late_days,
        "days_with_any_attendance": present_days + absent_days + late_days,  # Frontend compatibility
        "percentage_present": round(percentage_present, 2),
        "percentage_absent": round(percentage_absent, 2),
        "percentage_late": round(percentage_late, 2),
        
        # PERIOD-BASED METRICS (secondary, for detailed analysis)
        "present_periods": periods.present_periods or 0,
        "absent_periods": periods.absent_periods or 0,
        "late_periods": periods.late_periods or 0,
        "total_periods_marked": periods.total_records or 0,
        
        "average_confidence": round(periods.avg_confidence or 0, 2),
        "academic_metrics": academic_metrics
    }

@router.get("/records")
async def get_student_attendance_records(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    subject_id: Optional[int] = Query(None, description="Filter by subject"),
    status: Optional[str] = Query(None, description="Filter by status (present/absent/late)"),
    limit: int = Query(50, description="Number of records to return"),
    offset: int = Query(0, description="Number of records to skip"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed attendance records for the current student"""
    
    # Get student record
    student_query = select(Student).where(Student.user_id == current_user.id)
    result = await db.execute(student_query)
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")
    
    # Build query
    query = select(AttendanceRecord).options(
        selectinload(AttendanceRecord.subject)
    ).where(AttendanceRecord.student_id == student.id)
    
    # Apply filters
    if start_date:
        query = query.where(AttendanceRecord.date >= datetime.fromisoformat(start_date).date())
    if end_date:
        query = query.where(AttendanceRecord.date <= datetime.fromisoformat(end_date).date())
    if subject_id:
        query = query.where(AttendanceRecord.subject_id == subject_id)
    if status:
        query = query.where(AttendanceRecord.status == status)
    
    # Order by date descending
    query = query.order_by(desc(AttendanceRecord.date), desc(AttendanceRecord.created_at))
    
    # Apply pagination
    query = query.offset(offset).limit(limit)
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    # Format response
    formatted_records = []
    for record in records:
        formatted_records.append({
            "id": record.id,
            "date": record.date.isoformat(),
            "subject_id": record.subject_id,
            "subject_name": record.subject.name if record.subject else "Unknown",
            "status": record.status,
            "marked_at": record.marked_at.isoformat() if record.marked_at else None,
            "confidence_score": record.confidence_score,
            "method": record.method,
            "notes": record.notes
        })
    
    return {
        "records": formatted_records,
        "total": len(formatted_records),
        "offset": offset,
        "limit": limit
    }

@router.get("/subject-breakdown")
async def get_subject_attendance_breakdown(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get attendance breakdown by subject for the current student"""
    
    # Get student record
    student_query = select(Student).where(Student.user_id == current_user.id)
    result = await db.execute(student_query)
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")
    
    # Get subject-wise attendance
    try:
        query = select(
            Subject.id.label('subject_id'),
            Subject.name.label('subject_name'),
            Subject.code.label('subject_code'),
            func.count(AttendanceRecord.id).label('total_classes'),
            func.sum(case((AttendanceRecord.status == AttendanceStatus.present, 1), else_=0)).label('attended_classes'),
            func.sum(case((AttendanceRecord.status == AttendanceStatus.absent, 1), else_=0)).label('absent_classes'),
            func.sum(case((AttendanceRecord.status == AttendanceStatus.late, 1), else_=0)).label('late_classes'),
            func.max(AttendanceRecord.date).label('last_attendance_date'),
            func.avg(case((AttendanceRecord.confidence_score.isnot(None), AttendanceRecord.confidence_score), else_=None)).label('avg_confidence')
        ).select_from(
            Subject
        ).outerjoin(
            AttendanceRecord, and_(
                AttendanceRecord.subject_id == Subject.id,
                AttendanceRecord.student_id == student.id
            )
        ).where(
            Subject.faculty_id == student.faculty_id,
            Subject.semester == student.semester
        ).group_by(
            Subject.id, Subject.name, Subject.code
        ).order_by(Subject.name)
        
        result = await db.execute(query)
        subjects = result.all()
        
    except Exception as e:
        print(f"Error in subject breakdown query: {e}")
        # Return empty result if query fails
        subjects = []
    
    # Calculate streaks and trends for each subject
    subject_breakdown = []
    for subject in subjects:
        total_classes = subject.total_classes or 0
        attended_classes = subject.attended_classes or 0
        
        percentage = (attended_classes / total_classes * 100) if total_classes > 0 else 0
        
        # Calculate streak (simplified - would need more complex logic for actual streaks)
        streak = await calculate_subject_streak(db, student.id, subject.subject_id)
        
        # Determine trend (simplified)
        trend = await calculate_subject_trend(db, student.id, subject.subject_id)
        
        subject_breakdown.append({
            "subject_id": subject.subject_id,
            "subject_name": subject.subject_name,
            "subject_code": subject.subject_code,
            "total_classes": total_classes,
            "attended_classes": attended_classes,
            "absent_classes": subject.absent_classes or 0,
            "late_classes": subject.late_classes or 0,
            "percentage": round(percentage, 2),
            "last_attendance": subject.last_attendance_date.isoformat() if subject.last_attendance_date else None,
            "streak": streak,
            "trend": trend,
            "average_confidence": round(subject.avg_confidence or 0, 2)
        })
    
    return {
        "subjects": subject_breakdown,
        "total_subjects": len(subject_breakdown)
    }

@router.get("/analytics")
async def get_student_attendance_analytics(
    period: str = Query("semester", description="Analysis period (week/month/semester/year)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get advanced attendance analytics for the current student"""
    
    # Get student record
    student_query = select(Student).where(Student.user_id == current_user.id)
    result = await db.execute(student_query)
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")
    
    # Calculate date range based on period
    end_date = datetime.now().date()
    if period == "week":
        start_date = end_date - timedelta(days=7)
    elif period == "month":
        start_date = end_date - timedelta(days=30)
    elif period == "semester":
        # Use automatic semester detection
        period_info = AutomaticSemesterService.get_current_period()
        start_date = period_info.start_date
    else:  # year
        start_date = datetime(end_date.year, 1, 1).date()
    
    # Get attendance data for the period
    query = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.date >= start_date,
            AttendanceRecord.date <= end_date
        )
    ).order_by(AttendanceRecord.date)
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    # Calculate analytics
    analytics = {
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_records": len(records),
        "daily_breakdown": calculate_daily_breakdown(records),
        "weekly_trends": calculate_weekly_trends(records),
        "best_day": calculate_best_day(records),
        "worst_day": calculate_worst_day(records),
        "consistency_score": calculate_consistency_score(records),
        "improvement_suggestions": generate_improvement_suggestions(records)
    }
    
    return analytics

@router.get("/goals")
async def get_attendance_goals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get attendance goals and progress for the current student"""
    
    # Get student record
    student_query = select(Student).where(Student.user_id == current_user.id)
    result = await db.execute(student_query)
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")
    
    # Get current attendance summary
    summary = await get_student_attendance_summary(db, current_user)
    
    # Calculate goals for different targets
    targets = [75, 80, 85, 90, 95]
    goals = []
    
    for target in targets:
        current_percentage = summary["percentage_present"]
        present_days = summary["present"]
        total_days = summary["total_academic_days"]
        remaining_days = max(0, total_days - summary["total_marked"])
        
        # Calculate classes needed to reach target
        required_total_present = (target * total_days) / 100
        classes_needed = max(0, required_total_present - present_days)
        
        is_achievable = classes_needed <= remaining_days
        
        goals.append({
            "target_percentage": target,
            "current_percentage": current_percentage,
            "classes_needed": int(classes_needed),
            "remaining_days": remaining_days,
            "is_achievable": is_achievable,
            "difficulty": "easy" if classes_needed <= remaining_days * 0.5 else "medium" if is_achievable else "hard"
        })
    
    return {
        "goals": goals,
        "current_status": {
            "percentage": summary["percentage_present"],
            "present_days": summary["present"],
            "total_days": summary["total_academic_days"],
            "remaining_days": max(0, summary["total_academic_days"] - summary["total_marked"])
        }
    }

# Helper functions
async def calculate_subject_streak(db: AsyncSession, student_id: int, subject_id: int) -> int:
    """Calculate current attendance streak for a subject"""
    query = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.subject_id == subject_id
        )
    ).order_by(desc(AttendanceRecord.date)).limit(10)
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    streak = 0
    for record in records:
        if record.status == AttendanceStatus.present:
            streak += 1
        else:
            break
    
    return streak

async def calculate_subject_trend(db: AsyncSession, student_id: int, subject_id: int) -> str:
    """Calculate attendance trend for a subject"""
    query = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.subject_id == subject_id
        )
    ).order_by(desc(AttendanceRecord.date)).limit(20)
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    if len(records) < 10:
        return "stable"
    
    recent = records[:10]
    older = records[10:]
    
    recent_percentage = len([r for r in recent if r.status == AttendanceStatus.present]) / len(recent) * 100
    older_percentage = len([r for r in older if r.status == AttendanceStatus.present]) / len(older) * 100
    
    if recent_percentage > older_percentage + 10:
        return "up"
    elif recent_percentage < older_percentage - 10:
        return "down"
    else:
        return "stable"

def calculate_daily_breakdown(records: List[AttendanceRecord]) -> Dict[str, Any]:
    """Calculate daily attendance breakdown"""
    daily_stats = {}
    
    for record in records:
        day = record.date.strftime('%A')
        if day not in daily_stats:
            daily_stats[day] = {"present": 0, "absent": 0, "late": 0, "total": 0}
        
        daily_stats[day][record.status] += 1
        daily_stats[day]["total"] += 1
    
    # Calculate percentages
    for day in daily_stats:
        total = daily_stats[day]["total"]
        if total > 0:
            daily_stats[day]["percentage"] = round(daily_stats[day]["present"] / total * 100, 2)
        else:
            daily_stats[day]["percentage"] = 0
    
    return daily_stats

def calculate_weekly_trends(records: List[AttendanceRecord]) -> List[Dict[str, Any]]:
    """Calculate weekly attendance trends"""
    weekly_data = {}
    
    for record in records:
        week = record.date.strftime('%Y-W%U')
        if week not in weekly_data:
            weekly_data[week] = {"present": 0, "total": 0}
        
        if record.status == AttendanceStatus.present:
            weekly_data[week]["present"] += 1
        weekly_data[week]["total"] += 1
    
    trends = []
    for week, data in sorted(weekly_data.items()):
        percentage = (data["present"] / data["total"] * 100) if data["total"] > 0 else 0
        trends.append({
            "week": week,
            "percentage": round(percentage, 2),
            "present": data["present"],
            "total": data["total"]
        })
    
    return trends

def calculate_best_day(records: List[AttendanceRecord]) -> str:
    """Find the day with best attendance"""
    daily_breakdown = calculate_daily_breakdown(records)
    
    best_day = "Monday"
    best_percentage = 0
    
    for day, stats in daily_breakdown.items():
        if stats["percentage"] > best_percentage:
            best_percentage = stats["percentage"]
            best_day = day
    
    return best_day

def calculate_worst_day(records: List[AttendanceRecord]) -> str:
    """Find the day with worst attendance"""
    daily_breakdown = calculate_daily_breakdown(records)
    
    worst_day = "Monday"
    worst_percentage = 100
    
    for day, stats in daily_breakdown.items():
        if stats["percentage"] < worst_percentage:
            worst_percentage = stats["percentage"]
            worst_day = day
    
    return worst_day

def calculate_consistency_score(records: List[AttendanceRecord]) -> float:
    """Calculate attendance consistency score (0-100)"""
    if not records:
        return 0
    
    # Calculate standard deviation of weekly attendance
    weekly_trends = calculate_weekly_trends(records)
    
    if len(weekly_trends) < 2:
        return 100  # Perfect consistency if only one week
    
    percentages = [trend["percentage"] for trend in weekly_trends]
    mean_percentage = sum(percentages) / len(percentages)
    
    variance = sum((p - mean_percentage) ** 2 for p in percentages) / len(percentages)
    std_dev = variance ** 0.5
    
    # Convert to consistency score (lower std_dev = higher consistency)
    consistency_score = max(0, 100 - std_dev)
    
    return round(consistency_score, 2)

def generate_improvement_suggestions(records: List[AttendanceRecord]) -> List[str]:
    """Generate personalized improvement suggestions"""
    suggestions = []
    
    if not records:
        return ["Start attending classes regularly to build a good attendance record."]
    
    daily_breakdown = calculate_daily_breakdown(records)
    
    # Find problematic days
    for day, stats in daily_breakdown.items():
        if stats["percentage"] < 70:
            suggestions.append(f"Focus on improving {day} attendance ({stats['percentage']:.1f}%)")
    
    # Check recent trend
    recent_records = records[-10:] if len(records) >= 10 else records
    recent_present = len([r for r in recent_records if r.status == AttendanceStatus.present])
    recent_percentage = (recent_present / len(recent_records)) * 100
    
    if recent_percentage < 75:
        suggestions.append("Your recent attendance is below 75%. Consider setting daily reminders.")
    
    # Check consistency
    consistency = calculate_consistency_score(records)
    if consistency < 70:
        suggestions.append("Try to maintain consistent attendance patterns throughout the week.")
    
    if not suggestions:
        suggestions.append("Great job! Keep maintaining your excellent attendance record.")
    
    return suggestions