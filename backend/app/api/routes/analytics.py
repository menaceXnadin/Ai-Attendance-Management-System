from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
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
        # Calculate average attendance percentage
        attendance_query = select(
            func.avg(
                func.case(
                    (AttendanceRecord.status == 'PRESENT', 100.0),
                    else_=0.0
                )
            ).label('average_attendance')
        )
        
        if class_id:
            # If we had a class system, we'd filter here
            # For now, calculate overall averages
            pass
            
        attendance_result = await db.execute(attendance_query)
        average_attendance = attendance_result.scalar() or 0.0
        
        # Calculate average marks if marks system exists
        try:
            marks_query = select(
                func.avg(
                    (Mark.marks_obtained / Mark.total_marks) * 100
                ).label('average_marks')
            )
            
            marks_result = await db.execute(marks_query)
            average_marks = marks_result.scalar() or 0.0
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
        # Get student's attendance summary
        attendance_query = select(
            func.count().label('total_classes'),
            func.sum(
                func.case(
                    (AttendanceRecord.status == 'PRESENT', 1),
                    else_=0
                )
            ).label('present_classes'),
            func.sum(
                func.case(
                    (AttendanceRecord.status == 'ABSENT', 1),
                    else_=0
                )
            ).label('absent_classes'),
            func.sum(
                func.case(
                    (AttendanceRecord.status == 'LATE', 1),
                    else_=0
                )
            ).label('late_classes')
        ).where(AttendanceRecord.student_id == student_id)
        
        attendance_result = await db.execute(attendance_query)
        attendance_stats = attendance_result.first()
        
        total_classes = attendance_stats.total_classes or 0
        present_classes = attendance_stats.present_classes or 0
        absent_classes = attendance_stats.absent_classes or 0
        late_classes = attendance_stats.late_classes or 0
        
        attendance_percentage = (present_classes / total_classes * 100) if total_classes > 0 else 0
        
        # Generate insights based on attendance pattern
        insights = []
        
        if attendance_percentage >= 95:
            insights.append({
                "type": "success",
                "title": "Excellent Attendance",
                "message": f"Outstanding! You maintain {attendance_percentage:.1f}% attendance.",
                "priority": "low"
            })
        elif attendance_percentage < 75:
            insights.append({
                "type": "warning",
                "title": "Attendance Alert",
                "message": f"Your attendance is {attendance_percentage:.1f}%, below the 75% requirement.",
                "priority": "high"
            })
        
        if absent_classes > 5:
            insights.append({
                "type": "info",
                "title": "Absence Pattern",
                "message": f"You have {absent_classes} absences. Consider speaking with your advisor.",
                "priority": "medium"
            })
        
        return {
            "studentId": student_id,
            "attendance": {
                "totalClasses": total_classes,
                "presentClasses": present_classes,
                "absentClasses": absent_classes,
                "lateClasses": late_classes,
                "percentage": round(attendance_percentage, 2)
            },
            "insights": insights,
            "generatedAt": datetime.now().isoformat()
        }
        
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
    
    # Calculate date range
    end_date = datetime.now().date()
    start_date = date.fromordinal(end_date.toordinal() - days)
    
    try:
        # Build query
        query = select(
            func.date(AttendanceRecord.date).label('date'),
            func.count().label('total_records'),
            func.sum(
                func.case(
                    (AttendanceRecord.status == 'PRESENT', 1),
                    else_=0
                )
            ).label('present_count')
        ).where(
            and_(
                func.date(AttendanceRecord.date) >= start_date,
                func.date(AttendanceRecord.date) <= end_date
            )
        )
        
        if student_id:
            query = query.where(AttendanceRecord.student_id == student_id)
            
        query = query.group_by(func.date(AttendanceRecord.date)).order_by(func.date(AttendanceRecord.date))
        
        result = await db.execute(query)
        trends = result.all()
        
        # Format for chart consumption
        chart_data = []
        for trend in trends:
            attendance_rate = (trend.present_count / trend.total_records * 100) if trend.total_records > 0 else 0
            chart_data.append({
                "date": trend.date.isoformat(),
                "attendanceRate": round(attendance_rate, 2),
                "totalClasses": trend.total_records,
                "presentClasses": trend.present_count
            })
        
        return {
            "trends": chart_data,
            "period": {
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
                "days": days
            },
            "studentId": student_id
        }
        
    except Exception as e:
        return {
            "trends": [],
            "period": {
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
                "days": days
            },
            "studentId": student_id,
            "error": str(e)
        }
