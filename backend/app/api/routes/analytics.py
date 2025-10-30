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
        
        # Get student's attendance records with a simple query
        attendance_query = select(AttendanceRecord).where(
            AttendanceRecord.student_id == student_id
        )

        attendance_result = await db.execute(attendance_query)
        attendance_records = attendance_result.scalars().all()

        status_counter = Counter()
        daily_stats = defaultdict(lambda: {"present": 0, "total": 0})

        for record in attendance_records:
            status = normalize_attendance_status(record.status)
            record_date = coerce_record_date(record.date)

            if status:
                status_counter[status] += 1

            if record_date:
                daily_stats[record_date]["total"] += 1
                if status in {"present", "late"}:
                    daily_stats[record_date]["present"] += 1

        # FIX: Calculate total_classes as the student's actual attendance records count
        # This represents the total number of class sessions (periods) the student was marked for
        # Each record = 1 class session, which correctly accounts for:
        # - Multiple subjects per day
        # - Multiple periods of the same subject
        # - The actual scheduled classes this student has
        total_classes = sum(status_counter.values())
        
        # Fallback for edge case where status_counter is empty
        if total_classes == 0:
            total_classes = len(attendance_records)
        
        # Count status totals
        present_classes = status_counter.get("present", 0)
        late_classes = status_counter.get("late", 0)
        attended_classes = present_classes + late_classes
        absent_classes = status_counter.get("absent", 0)
        excused_classes = status_counter.get("excused", 0)

        # Calculate attendance percentage
        # total_classes = all records (present + late + absent + excused)
        # attended_classes = present + late (classes where student was there)
        if total_classes == 0:
            attendance_percentage = 0.0
        else:
            effective_total = total_classes - excused_classes
            effective_total = effective_total if effective_total > 0 else total_classes
            attendance_percentage = (attended_classes / effective_total * 100)

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
