from collections import Counter, defaultdict
from datetime import datetime, date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models import AttendanceRecord, Mark, Student, Subject, ClassSchedule
from app.utils.attendance import coerce_record_date, normalize_attendance_status
from app.services.accurate_attendance_calculator import calculate_accurate_attendance, calculate_subject_wise_attendance

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/class-averages")
async def get_class_averages(
    class_id: Optional[int] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get class average attendance and marks for comparison."""
    try:
        # Get all attendance records
        attendance_query = select(AttendanceRecord)
        if class_id:
            # If we had a class system, we'd filter here
            pass

        attendance_result = await db.execute(attendance_query)
        attendance_records = attendance_result.scalars().all()

        # Calculate average attendance using real status values
        status_counter = Counter()
        for record in attendance_records:
            status = normalize_attendance_status(record.status)
            if status:
                status_counter[status] += 1

        total_count = sum(status_counter.values())
        attended_equivalent = status_counter.get("present", 0) + status_counter.get("late", 0)
        average_attendance = (attended_equivalent / total_count * 100) if total_count else 0.0
        
        # Calculate average marks if marks system exists
        try:
            marks_query = select(Mark)
            marks_result = await db.execute(marks_query)
            marks_records = marks_result.scalars().all()
            
            if marks_records:
                total_percentage = sum((mark.marks_obtained / mark.total_marks) * 100 for mark in marks_records if mark.total_marks > 0)
                average_marks = total_percentage / len(marks_records) if marks_records else 0
            else:
                average_marks = 0.0
        except:
            # If marks table doesn't exist or has no data
            average_marks = 0.0
        
        return {
            "averageAttendance": round(average_attendance, 2),
            "averageMarks": round(average_marks, 2),
            "classId": class_id,
            "calculatedAt": datetime.now().isoformat()
        }
        
    except Exception as e:
        # Return empty averages if calculation fails
        return {
            "averageAttendance": 0.0,
            "averageMarks": 0.0,
            "classId": class_id,
            "calculatedAt": datetime.now().isoformat(),
            "error": "Could not calculate averages"
        }

@router.get("/student-insights/{student_id}")
async def get_student_insights(
    student_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get insights and analytics for a specific student."""
    
    # Check if user can access this student's data
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this student's data"
        )
    
    try:
        # First get the student info with user relationship loaded
        student_query = select(Student).options(selectinload(Student.user)).where(Student.id == student_id)
        student_result = await db.execute(student_query)
        student = student_result.scalar_one_or_none()
        
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        
        # Use accurate attendance calculation that considers:
        # 1. Total classes HELD (not just student's records)
        # 2. Filters out system_inactive days
        # 3. Filters out holidays and non-class events
        # 4. Only counts EventType.CLASS events
        accurate_attendance = await calculate_accurate_attendance(
            db=db,
            student_id=student_id
        )
        
        total_classes = accurate_attendance["total_classes_held"]
        attended_classes = accurate_attendance["classes_attended"]
        present_classes = accurate_attendance["present_count"]
        late_classes = accurate_attendance["late_count"]
        absent_classes = accurate_attendance["total_absences"]
        excused_classes = accurate_attendance.get("excused_count", 0)
        attendance_percentage = accurate_attendance["attendance_percentage"]
        
        # Also get daily stats for trend analysis (keeping old logic for trends)
        attendance_query = select(AttendanceRecord).where(
            AttendanceRecord.student_id == student_id
        )
        attendance_result = await db.execute(attendance_query)
        attendance_records = attendance_result.scalars().all()
        
        daily_stats = defaultdict(lambda: {"present": 0, "total": 0})
        for record in attendance_records:
            status = normalize_attendance_status(record.status)
            record_date = coerce_record_date(record.date)
            if record_date:
                daily_stats[record_date]["total"] += 1
                if status in {"present", "late"}:
                    daily_stats[record_date]["present"] += 1

        # Determine risk level based on actual percentage
        if attendance_percentage >= 90:
            risk_level = "low"
        elif attendance_percentage >= 80:
            risk_level = "medium"
        elif attendance_percentage >= 70:
            risk_level = "high"
        else:
            risk_level = "critical"

        # Analyse short-term trends from daily stats
        sorted_days = sorted(daily_stats.items(), key=lambda item: item[0])

        def _average_rate(entries):
            total = sum(day_stats["total"] for _, day_stats in entries)
            if total == 0:
                return None
            present_total = sum(day_stats["present"] for _, day_stats in entries)
            return (present_total / total) * 100

        recent_window = 7
        recent_entries = sorted_days[-recent_window:]
        previous_entries = sorted_days[-2 * recent_window:-recent_window]

        recent_average = _average_rate(recent_entries)
        previous_average = _average_rate(previous_entries)
        change = None

        if recent_average is not None and previous_average is not None:
            change = recent_average - previous_average

        improving = change is not None and change >= 3
        declining = change is not None and change <= -3
        stable = not improving and not declining

        # Generate recommendations that reflect real attendance data
        recommendations = []

        if attendance_percentage >= 95:
            recommendations.append("Excellent attendance! Keep up the great work.")
        elif attendance_percentage < 75:
            recommendations.append(
                f"Attendance is {attendance_percentage:.1f}%, below the 75% requirement. Immediate improvement needed."
            )
            recommendations.append(
                "Consider meeting with your academic advisor to discuss strategies for better attendance."
            )
        elif attendance_percentage < 85:
            recommendations.append(
                f"Attendance is {attendance_percentage:.1f}%. Work on improving consistency."
            )

        if absent_classes > 5:
            recommendations.append(
                f"You have {absent_classes} recorded absences. Focus on attending upcoming classes and follow up on missed work."
            )
        if late_classes > 3:
            recommendations.append("There are several late arrivals. Aim to arrive before class starts to avoid penalties.")
        if improving:
            recommendations.append("Recent attendance shows improvement. Maintain this positive trend.")
        if declining:
            recommendations.append("Attendance has dipped compared to the previous weeks. Identify and address the obstacles causing this change.")
        
        # Note: student info already retrieved with user relationship loaded at the beginning
        
        return {
            "student": {
                "id": student.id,
                "student_id": student.student_id,
                "name": student.user.full_name if student.user else "Unknown",
                "email": student.user.email if student.user else "Unknown",
                "semester": student.semester or 1,
                "faculty": student.faculty_name if hasattr(student, 'faculty_name') else "Unknown",
                "faculty_id": student.faculty_id or 0,
            },
            "attendance": {
                "totalClasses": total_classes,
                "attendedClasses": attended_classes,
                "absentClasses": absent_classes,
                "lateClasses": late_classes,
                "excusedClasses": excused_classes,
                "percentage": round(attendance_percentage, 2)
            },
            "riskLevel": risk_level,
            "trends": {
                "improving": improving,
                "declining": declining,
                "stable": stable,
                "recentAverage": round(recent_average, 2) if recent_average is not None else None,
                "previousAverage": round(previous_average, 2) if previous_average is not None else None,
                "change": round(change, 2) if change is not None else None
            },
            "recommendations": recommendations,
            "subjects": []  # Will be populated by separate endpoint
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate insights: {str(e)}"
        )

@router.get("/attendance-trends")
async def get_attendance_trends(
    student_id: Optional[int] = None,
    days: int = 30,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get attendance trends over the specified number of days."""
    
    try:
        # Build a simple query without complex SQL functions
        base_query = select(AttendanceRecord)

        if student_id:
            base_query = base_query.where(AttendanceRecord.student_id == student_id)

        # Reduce dataset to requested window when a student filter is provided
        if student_id:
            start_cutoff = datetime.now().date() - timedelta(days=days - 1)
            base_query = base_query.where(AttendanceRecord.date >= start_cutoff)

        result = await db.execute(base_query)
        all_records = result.scalars().all()

        date_stats = defaultdict(lambda: {"total": 0, "present": 0})
        for record in all_records:
            record_date = coerce_record_date(record.date)
            if not record_date:
                continue

            date_stats[record_date]["total"] += 1

            status = normalize_attendance_status(record.status)
            if status in {"present", "late"}:
                date_stats[record_date]["present"] += 1

        chart_data = []
        for record_date, stats in sorted(date_stats.items())[-days:]:
            attendance_rate = (stats["present"] / stats["total"] * 100) if stats["total"] else 0
            chart_data.append({
                "date": record_date.isoformat(),
                "attendance_rate": round(attendance_rate, 2),
                "total_classes": stats["total"],
                "attended_classes": stats["present"]
            })

        return chart_data
        
    except Exception as e:
        # Return empty data if there's an error, but log it
        print(f"Error in attendance trends: {str(e)}")
        return []


@router.get("/weekly-breakdown")
async def get_weekly_breakdown(
    days: int = 7,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get real day-by-day attendance breakdown for the last N days."""
    
    today = date.today()
    start_date = today - timedelta(days=days - 1)
    
    # Get all attendance records in date range
    query = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.date >= start_date,
            AttendanceRecord.date <= today
        )
    )
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    # Group by date and status
    daily_breakdown = {}
    for i in range(days):
        check_date = start_date + timedelta(days=i)
        daily_breakdown[check_date] = {
            'date': check_date.isoformat(),
            'day': check_date.strftime('%a'),
            'present': 0,
            'absent': 0,
            'late': 0,
            'total': 0,
            'percentage': 0
        }
    
    # Count records by date and status
    for record in records:
        if record.date in daily_breakdown:
            status = normalize_attendance_status(record.status)
            
            if status == 'present':
                daily_breakdown[record.date]['present'] += 1
            elif status == 'absent':
                daily_breakdown[record.date]['absent'] += 1
            elif status == 'late':
                daily_breakdown[record.date]['late'] += 1
            
            daily_breakdown[record.date]['total'] += 1
    
    # Calculate percentages
    for day_data in daily_breakdown.values():
        if day_data['total'] > 0:
            day_data['percentage'] = round((day_data['present'] / day_data['total']) * 100, 1)
    
    # Convert to list sorted by date
    breakdown_list = [daily_breakdown[start_date + timedelta(days=i)] for i in range(days)]
    
    return {
        "breakdown": breakdown_list,
        "summary": {
            "total_records": len(records),
            "period_days": days,
            "start_date": start_date.isoformat(),
            "end_date": today.isoformat()
        }
    }


@router.get("/top-performers")
async def get_top_performers(
    limit: int = 10,
    min_classes: int = 5,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get students with highest attendance rates based on real data."""
    
    # Get all students with their attendance records
    students_query = select(Student).options(selectinload(Student.user))
    students_result = await db.execute(students_query)
    students = students_result.scalars().all()
    
    performers = []
    
    for student in students:
        if not student.user:
            continue
        
        # Get attendance records
        attendance_query = select(AttendanceRecord).where(
            AttendanceRecord.student_id == student.id
        )
        attendance_result = await db.execute(attendance_query)
        records = attendance_result.scalars().all()
        
        if len(records) < min_classes:
            continue
        
        # Calculate stats
        present_count = sum(1 for r in records if normalize_attendance_status(r.status) == 'present')
        total_count = len(records)
        attendance_rate = (present_count / total_count * 100) if total_count > 0 else 0
        
        # Get recent trend (last 7 days vs previous 7 days)
        today = date.today()
        recent_records = [r for r in records if r.date >= today - timedelta(days=7)]
        previous_records = [r for r in records if today - timedelta(days=14) <= r.date < today - timedelta(days=7)]
        
        recent_rate = (sum(1 for r in recent_records if normalize_attendance_status(r.status) == 'present') / len(recent_records) * 100) if recent_records else 0
        previous_rate = (sum(1 for r in previous_records if normalize_attendance_status(r.status) == 'present') / len(previous_records) * 100) if previous_records else 0
        
        trend = 'up' if recent_rate > previous_rate else 'down' if recent_rate < previous_rate else 'stable'
        
        performers.append({
            'student_id': student.student_id,
            'name': student.user.full_name,
            'email': student.user.email,
            'attendance_rate': round(attendance_rate, 1),
            'total_classes': total_count,
            'present_count': present_count,
            'absent_count': total_count - present_count,
            'trend': trend,
            'recent_rate': round(recent_rate, 1),
            'faculty': student.faculty,
            'semester': student.semester
        })
    
    # Sort by attendance rate
    performers.sort(key=lambda x: x['attendance_rate'], reverse=True)
    
    return {
        "top_performers": performers[:limit],
        "total_students": len(performers),
        "average_attendance": round(sum(p['attendance_rate'] for p in performers) / len(performers), 1) if performers else 0
    }


@router.get("/subject-wise")
async def get_subject_wise_analytics(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get attendance analytics broken down by subject."""
    
    # Get all subjects
    subjects_query = select(Subject)
    subjects_result = await db.execute(subjects_query)
    subjects = subjects_result.scalars().all()
    
    subject_analytics = []
    
    for subject in subjects:
        # Get attendance records for this subject
        attendance_query = select(AttendanceRecord).where(
            AttendanceRecord.subject_id == subject.id
        )
        attendance_result = await db.execute(attendance_query)
        records = attendance_result.scalars().all()
        
        if not records:
            continue
        
        # Calculate stats
        present = sum(1 for r in records if normalize_attendance_status(r.status) == 'present')
        absent = sum(1 for r in records if normalize_attendance_status(r.status) == 'absent')
        late = sum(1 for r in records if normalize_attendance_status(r.status) == 'late')
        total = len(records)
        
        # Get unique students
        unique_students = len(set(r.student_id for r in records))
        
        # Get date range
        dates = [r.date for r in records]
        
        subject_analytics.append({
            'subject_id': subject.id,
            'subject_name': subject.name,
            'subject_code': subject.code,
            'total_classes': total,
            'present': present,
            'absent': absent,
            'late': late,
            'attendance_rate': round((present / total * 100) if total > 0 else 0, 1),
            'unique_students': unique_students,
            'first_class': min(dates).isoformat() if dates else None,
            'last_class': max(dates).isoformat() if dates else None
        })
    
    # Sort by attendance rate
    subject_analytics.sort(key=lambda x: x['attendance_rate'], reverse=True)
    
    return {
        "subjects": subject_analytics,
        "total_subjects": len(subject_analytics),
        "average_rate": round(sum(s['attendance_rate'] for s in subject_analytics) / len(subject_analytics), 1) if subject_analytics else 0
    }


@router.get("/insights")
async def get_intelligent_insights(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate AI-powered insights from attendance data."""
    
    insights = []
    today = date.today()
    
    # Get total students
    students_query = select(Student)
    students_result = await db.execute(students_query)
    total_students = len(students_result.scalars().all())
    
    # Check today's attendance
    today_query = select(AttendanceRecord).where(AttendanceRecord.date == today)
    today_result = await db.execute(today_query)
    today_records = today_result.scalars().all()
    
    if not today_records:
        insights.append({
            'type': 'info',
            'priority': 'medium',
            'title': 'No Attendance Today',
            'description': f'No attendance has been recorded for {today.strftime("%B %d, %Y")}. This might be a weekend or holiday.',
            'action': 'View Calendar',
            'icon': 'calendar'
        })
    else:
        today_present = sum(1 for r in today_records if normalize_attendance_status(r.status) == 'present')
        today_rate = (today_present / len(today_records) * 100)
        
        if today_rate < 70:
            insights.append({
                'type': 'warning',
                'priority': 'high',
                'title': 'Low Attendance Alert',
                'description': f'Today\'s attendance is {today_rate:.1f}%, which is below the 70% threshold. {len(today_records) - today_present} students are absent.',
                'action': 'View Details',
                'icon': 'alert-triangle'
            })
        elif today_rate >= 90:
            insights.append({
                'type': 'success',
                'priority': 'low',
                'title': 'Excellent Attendance',
                'description': f'Outstanding! Today\'s attendance is {today_rate:.1f}% with {today_present} students present.',
                'action': 'View Report',
                'icon': 'check-circle'
            })
    
    # Check for students with consecutive absences
    week_ago = today - timedelta(days=7)
    recent_query = select(AttendanceRecord).where(
        AttendanceRecord.date >= week_ago
    )
    recent_result = await db.execute(recent_query)
    recent_records = recent_result.scalars().all()
    
    # Group by student
    student_absences = defaultdict(int)
    for record in recent_records:
        status = normalize_attendance_status(record.status)
        if status == 'absent':
            student_absences[record.student_id] += 1
    
    high_absence_students = [sid for sid, count in student_absences.items() if count >= 3]
    
    if high_absence_students:
        insights.append({
            'type': 'warning',
            'priority': 'high',
            'title': 'Students Need Attention',
            'description': f'{len(high_absence_students)} students have been absent 3+ times in the last week. Consider reaching out.',
            'action': 'View Students',
            'icon': 'user-x'
        })
    
    # Check overall system performance
    last_30_days = today - timedelta(days=30)
    month_query = select(AttendanceRecord).where(
        AttendanceRecord.date >= last_30_days
    )
    month_result = await db.execute(month_query)
    month_records = month_result.scalars().all()
    
    if month_records:
        month_present = sum(1 for r in month_records if normalize_attendance_status(r.status) == 'present')
        month_rate = (month_present / len(month_records) * 100)
        
        insights.append({
            'type': 'info',
            'priority': 'medium',
            'title': '30-Day Performance',
            'description': f'Overall attendance rate for the last month is {month_rate:.1f}% across {len(month_records)} recorded classes.',
            'action': 'View Trends',
            'icon': 'trending-up' if month_rate >= 75 else 'trending-down'
        })
    
    return {
        "insights": insights,
        "generated_at": datetime.now().isoformat(),
        "total_insights": len(insights)
    }


@router.get("/dashboard-summary")
async def get_dashboard_summary(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get comprehensive analytics summary for dashboard."""
    
    today = date.today()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    # Get today's stats
    today_query = select(AttendanceRecord).where(AttendanceRecord.date == today)
    today_result = await db.execute(today_query)
    today_records = today_result.scalars().all()
    
    today_present = sum(1 for r in today_records if normalize_attendance_status(r.status) == 'present')
    
    # Get weekly stats
    week_query = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.date >= week_ago,
            AttendanceRecord.date <= today
        )
    )
    week_result = await db.execute(week_query)
    week_records = week_result.scalars().all()
    
    week_present = sum(1 for r in week_records if normalize_attendance_status(r.status) == 'present')
    
    # Get monthly stats
    month_query = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.date >= month_ago,
            AttendanceRecord.date <= today
        )
    )
    month_result = await db.execute(month_query)
    month_records = month_result.scalars().all()
    
    month_present = sum(1 for r in month_records if normalize_attendance_status(r.status) == 'present')
    
    # Get total students
    students_query = select(Student)
    students_result = await db.execute(students_query)
    total_students = len(students_result.scalars().all())
    
    # Get total subjects
    subjects_query = select(Subject)
    subjects_result = await db.execute(subjects_query)
    total_subjects = len(subjects_result.scalars().all())
    
    return {
        "today": {
            "date": today.isoformat(),
            "total_records": len(today_records),
            "present": today_present,
            "absent": len(today_records) - today_present,
            "rate": round((today_present / len(today_records) * 100) if today_records else 0, 1)
        },
        "this_week": {
            "start_date": week_ago.isoformat(),
            "end_date": today.isoformat(),
            "total_records": len(week_records),
            "present": week_present,
            "absent": len(week_records) - week_present,
            "rate": round((week_present / len(week_records) * 100) if week_records else 0, 1)
        },
        "this_month": {
            "start_date": month_ago.isoformat(),
            "end_date": today.isoformat(),
            "total_records": len(month_records),
            "present": month_present,
            "absent": len(month_records) - month_present,
            "rate": round((month_present / len(month_records) * 100) if month_records else 0, 1)
        },
        "system": {
            "total_students": total_students,
            "total_subjects": total_subjects,
            "total_attendance_records": len(month_records)
        }
    }
