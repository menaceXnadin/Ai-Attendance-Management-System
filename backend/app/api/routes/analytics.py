from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime, date
from app.core.database import get_db
from app.models import AttendanceRecord, Student, Mark, Subject
from app.api.dependencies import get_current_user

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
        
        # Calculate average attendance manually
        if attendance_records:
            present_count = sum(1 for record in attendance_records if record.status == 'PRESENT')
            total_count = len(attendance_records)
            average_attendance = (present_count / total_count) * 100 if total_count > 0 else 0
        else:
            average_attendance = 0.0
        
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
        
        # Calculate stats manually to avoid SQL function issues
        total_classes = len(attendance_records)
        present_classes = sum(1 for record in attendance_records if str(record.status).upper() == 'PRESENT')
        absent_classes = sum(1 for record in attendance_records if str(record.status).upper() == 'ABSENT')
        late_classes = sum(1 for record in attendance_records if str(record.status).upper() == 'LATE')
        
        attendance_percentage = (present_classes / total_classes * 100) if total_classes > 0 else 0
        
        # Determine risk level
        if attendance_percentage >= 90:
            risk_level = "low"
        elif attendance_percentage >= 80:
            risk_level = "medium"
        elif attendance_percentage >= 70:
            risk_level = "high"
        else:
            risk_level = "critical"
        
        # Generate recommendations
        recommendations = []
        
        if attendance_percentage >= 95:
            recommendations.append("Excellent attendance! Keep up the great work.")
        elif attendance_percentage < 75:
            recommendations.append(f"Attendance is {attendance_percentage:.1f}%, below the 75% requirement. Immediate improvement needed.")
            recommendations.append("Consider meeting with your academic advisor to discuss strategies for better attendance.")
        elif attendance_percentage < 85:
            recommendations.append(f"Attendance is {attendance_percentage:.1f}%. Work on improving consistency.")
        
        if absent_classes > 5:
            recommendations.append(f"You have {absent_classes} absences. Focus on attending all upcoming classes.")
        
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
                "attendedClasses": present_classes,
                "absentClasses": absent_classes,
                "percentage": round(attendance_percentage, 2)
            },
            "riskLevel": risk_level,
            "trends": {
                "improving": False,  # Would need historical analysis
                "declining": attendance_percentage < 80,
                "stable": True
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
            
        result = await db.execute(base_query)
        all_records = result.scalars().all()
        
        # Group by date and calculate stats manually
        date_stats = {}
        for record in all_records:
            try:
                # Handle different date formats
                record_date = record.date
                if hasattr(record_date, 'date'):
                    # If it's a datetime object, get the date part
                    date_key = record_date.date().isoformat()
                elif hasattr(record_date, 'isoformat'):
                    # If it's already a date object
                    date_key = record_date.isoformat()
                else:
                    # Skip records with invalid dates
                    continue
                
                if date_key not in date_stats:
                    date_stats[date_key] = {'total': 0, 'present': 0}
                
                date_stats[date_key]['total'] += 1
                if record.status and str(record.status).upper() == 'PRESENT':
                    date_stats[date_key]['present'] += 1
                    
            except Exception as e:
                # Skip records with date parsing issues
                continue
        
        # Format for chart consumption - limit to recent dates
        chart_data = []
        for date_str, stats in sorted(date_stats.items())[-days:]:  # Get last N days
            attendance_rate = (stats['present'] / stats['total'] * 100) if stats['total'] > 0 else 0
            chart_data.append({
                "date": date_str,
                "attendance_rate": round(attendance_rate, 2),
                "total_classes": stats['total'],
                "attended_classes": stats['present']
            })
        
        return chart_data
        
    except Exception as e:
        # Return empty data if there's an error, but log it
        print(f"Error in attendance trends: {str(e)}")
        return []
