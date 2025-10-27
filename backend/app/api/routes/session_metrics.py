"""
Session Metrics API Routes

Provides endpoints for accessing planned vs actual class metrics.
"""

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models import User
from app.services.session_metrics_service import SessionMetricsService


router = APIRouter(prefix="/session-metrics", tags=["session-metrics"])


@router.get("/comprehensive")
async def get_comprehensive_session_metrics(
    start_date: date = Query(..., description="Period start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Period end date (YYYY-MM-DD)"),
    student_id: Optional[int] = Query(None, description="Filter by student ID"),
    subject_id: Optional[int] = Query(None, description="Filter by subject ID"),
    semester: Optional[int] = Query(None, description="Filter by semester (1-8)"),
    academic_year: Optional[int] = Query(None, description="Filter by academic year"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive session metrics showing both planned and actual classes.
    
    **Returns:**
    - `planned`: Metrics from academic calendar (scheduled classes)
    - `actual`: Metrics from attendance records (conducted classes)
    - `deviation`: Analysis of differences between planned and actual
    - `recommended`: Recommended calculation method
    
    **Use Cases:**
    - Administrative planning: Use planned metrics
    - Student performance: Use actual metrics
    - Real-time tracking: Use hybrid with deviation alerts
    
    **Example Response:**
    ```json
    {
      "planned": {
        "total_academic_days": 113,
        "total_periods": 565,
        "source": "academic_events calendar"
      },
      "actual": {
        "total_conducted_days": 108,
        "total_conducted_periods": 540,
        "source": "attendance_records"
      },
      "deviation": {
        "count": -5,
        "percentage": -4.42,
        "severity": "moderate",
        "likely_causes": ["Classes cancelled but not removed from calendar"]
      },
      "recommended": {
        "method": "hybrid",
        "reason": "Significant deviation - use hybrid approach"
      }
    }
    ```
    """
    
    service = SessionMetricsService(db)
    
    try:
        metrics = await service.get_comprehensive_metrics(
            start_date=start_date,
            end_date=end_date,
            student_id=student_id,
            subject_id=subject_id,
            semester=semester,
            academic_year=academic_year
        )
        
        return metrics
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating session metrics: {str(e)}"
        )


@router.get("/attendance-with-deviation")
async def calculate_attendance_with_deviation(
    start_date: date = Query(..., description="Period start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Period end date (YYYY-MM-DD)"),
    calculation_method: str = Query(
        "hybrid",
        description="Calculation method: 'planned', 'actual', or 'hybrid'",
        regex="^(planned|actual|hybrid)$"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Calculate student attendance with full awareness of planned vs actual sessions.
    
    **Calculation Methods:**
    - `planned`: Use scheduled classes from calendar (stricter, good for goals)
    - `actual`: Use only conducted sessions (fairer, good for grades)
    - `hybrid`: Smart selection based on deviation (recommended)
    
    **Returns:**
    - Attendance percentage
    - Total days calculation
    - Deviation alert if significant difference exists
    - Comprehensive metrics breakdown
    
    **Example Response:**
    ```json
    {
      "present_days": 95,
      "total_days_used": 108,
      "percentage": 87.96,
      "calculation_method": "hybrid",
      "deviation_alert": true,
      "metrics_breakdown": {
        "planned": {...},
        "actual": {...},
        "deviation": {...}
      },
      "recommendation": {
        "method": "actual",
        "reason": "More sessions conducted than planned"
      }
    }
    ```
    """
    
    # Get student record from current user
    from app.models import Student
    from sqlalchemy import select
    
    student_query = select(Student).where(Student.user_id == current_user.id)
    result = await db.execute(student_query)
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student record not found for current user"
        )
    
    service = SessionMetricsService(db)
    
    try:
        attendance_data = await service.calculate_attendance_with_deviation_awareness(
            student_id=student.id,
            start_date=start_date,
            end_date=end_date,
            calculation_method=calculation_method
        )
        
        return attendance_data
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating attendance: {str(e)}"
        )


@router.get("/deviation-summary")
async def get_deviation_summary(
    start_date: date = Query(..., description="Period start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Period end date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a quick summary of deviations between planned and actual sessions.
    
    Useful for dashboard widgets and quick health checks.
    
    **Returns:**
    ```json
    {
      "planned_total": 113,
      "actual_total": 108,
      "deviation": -5,
      "deviation_percentage": -4.42,
      "severity": "moderate",
      "status": "warning",
      "message": "5 fewer sessions than planned - verify cancellations"
    }
    ```
    """
    
    service = SessionMetricsService(db)
    
    try:
        metrics = await service.get_comprehensive_metrics(
            start_date=start_date,
            end_date=end_date
        )
        
        deviation = metrics["deviation"]
        planned = metrics["planned"]["total_academic_days"]
        actual = metrics["actual"]["total_conducted_days"]
        
        # Determine status
        if deviation["severity"] == "minimal":
            status = "healthy"
            message = "Session counts are in sync"
        elif deviation["count"] > 0:
            status = "info"
            message = f"{deviation['count']} more sessions conducted than planned"
        else:
            status = "warning"
            message = f"{abs(deviation['count'])} fewer sessions than planned - verify cancellations"
        
        return {
            "planned_total": planned,
            "actual_total": actual,
            "deviation": deviation["count"],
            "deviation_percentage": deviation["percentage"],
            "severity": deviation["severity"],
            "status": status,
            "message": message,
            "likely_causes": deviation["likely_causes"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating deviation summary: {str(e)}"
        )


@router.get("/student-specific")
async def get_student_specific_metrics(
    start_date: date = Query(..., description="Period start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Period end date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get session metrics specific to the logged-in student.
    
    Shows:
    - Classes the student actually attended
    - Total planned classes
    - Student's personal deviation (makeup classes, missed opportunities)
    
    **Returns:**
    ```json
    {
      "student_info": {
        "id": 123,
        "name": "John Doe",
        "semester": 5
      },
      "planned_classes": 113,
      "actual_classes_student_has_records": 105,
      "attended_classes": 95,
      "attendance_percentage": 90.48,
      "deviation_from_plan": -8,
      "missed_opportunities": 8
    }
    ```
    """
    
    # Get student record
    from app.models import Student
    from sqlalchemy import select
    
    student_query = select(Student).where(Student.user_id == current_user.id)
    result = await db.execute(student_query)
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student record not found for current user"
        )
    
    service = SessionMetricsService(db)
    
    try:
        metrics = await service.get_comprehensive_metrics(
            start_date=start_date,
            end_date=end_date,
            student_id=student.id
        )
        
        # Get student's present days
        from app.models import AttendanceRecord, AttendanceStatus
        from sqlalchemy import and_, func, distinct, case
        
        present_query = select(
            func.count(distinct(
                case((AttendanceRecord.status == AttendanceStatus.present, AttendanceRecord.date))
            ))
        ).where(
            and_(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.date >= start_date,
                AttendanceRecord.date <= end_date
            )
        )
        
        result = await db.execute(present_query)
        attended_classes = result.scalar() or 0
        
        planned = metrics["planned"]["total_academic_days"]
        actual_student = metrics["actual"]["total_conducted_days"]
        
        return {
            "student_info": {
                "id": student.id,
                "name": student.user.full_name if student.user else "Unknown",
                "semester": student.semester
            },
            "planned_classes": planned,
            "actual_classes_student_has_records": actual_student,
            "attended_classes": attended_classes,
            "attendance_percentage": round(
                (attended_classes / planned * 100) if planned > 0 else 0, 
                2
            ),
            "deviation_from_plan": actual_student - planned,
            "missed_opportunities": max(0, planned - actual_student),
            "metrics_detail": metrics
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating student metrics: {str(e)}"
        )
