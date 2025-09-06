"""
Academic Metrics API Routes

Provides endpoints for dynamic calculation of academic days and periods
based on academic_events and class_schedules tables.
"""

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models import User
from app.services.academic_calculator import (
    AcademicCalculatorService,
    get_semester_academic_metrics,
    get_current_semester_metrics
)

router = APIRouter(prefix="/academic-metrics", tags=["Academic Metrics"])


@router.get("/calculate")
async def calculate_academic_metrics(
    start_date: date = Query(..., description="Semester start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Semester end date (YYYY-MM-DD)"),
    semester: Optional[int] = Query(None, description="Semester number (1-8)", ge=1, le=8),
    academic_year: Optional[int] = Query(None, description="Academic year (e.g., 2025)", ge=2020),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Calculate total academic days and periods for a given date range.
    
    **Academic Days**: Count of CLASS events with attendance_required=TRUE
    **Total Periods**: Sum of scheduled subjects across all academic days
    
    Returns:
    ```json
    {
        "total_academic_days": 113,
        "total_periods": 565,
        "class_days_breakdown": [
            {
                "date": "2025-08-01",
                "day_of_week": "friday",
                "periods_count": 5
            }
        ]
    }
    ```
    """
    
    if start_date >= end_date:
        raise HTTPException(
            status_code=400, 
            detail="Start date must be before end date"
        )
    
    calculator = AcademicCalculatorService(db)
    
    try:
        metrics = await calculator.calculate_academic_metrics(
            start_date=start_date,
            end_date=end_date,
            semester=semester,
            academic_year=academic_year
        )
        
        return {
            "success": True,
            "data": metrics,
            "filters": {
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d"),
                "semester": semester,
                "academic_year": academic_year
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating academic metrics: {str(e)}"
        )


@router.get("/current-semester")
async def get_current_semester_academic_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get academic metrics for the current semester (Fall 2025).
    
    Convenience endpoint that uses predefined semester dates.
    """
    
    try:
        metrics = await get_current_semester_metrics(db)
        
        return {
            "success": True,
            "data": metrics,
            "semester_info": {
                "name": "Fall 2025",
                "start_date": "2025-08-01",
                "end_date": "2025-12-15"
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting current semester metrics: {str(e)}"
        )


@router.get("/detailed-breakdown")
async def get_detailed_schedule_breakdown(
    start_date: date = Query(..., description="Semester start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Semester end date (YYYY-MM-DD)"),
    semester: Optional[int] = Query(None, description="Semester number (1-8)", ge=1, le=8),
    academic_year: Optional[int] = Query(None, description="Academic year (e.g., 2025)", ge=2020),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed breakdown of academic days with complete schedule information.
    
    Returns comprehensive data including:
    - Each class day with its scheduled subjects
    - Time slots, classrooms, and faculty information
    - Daily period counts
    
    Useful for detailed attendance planning and schedule verification.
    """
    
    if start_date >= end_date:
        raise HTTPException(
            status_code=400, 
            detail="Start date must be before end date"
        )
    
    calculator = AcademicCalculatorService(db)
    
    try:
        breakdown = await calculator.get_detailed_schedule_breakdown(
            start_date=start_date,
            end_date=end_date,
            semester=semester,
            academic_year=academic_year
        )
        
        return {
            "success": True,
            "data": breakdown
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting detailed breakdown: {str(e)}"
        )


@router.get("/summary")
async def get_academic_summary(
    start_date: date = Query(..., description="Semester start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Semester end date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a quick summary of academic metrics in the format expected by frontend.
    
    Returns the simple JSON format:
    ```json
    {
        "total_academic_days": 113,
        "total_periods": 565
    }
    ```
    
    This endpoint is optimized for frontend consumption and matches
    the existing attendance calculation expectations.
    """
    
    if start_date >= end_date:
        raise HTTPException(
            status_code=400, 
            detail="Start date must be before end date"
        )
    
    try:
        metrics = await get_semester_academic_metrics(db, start_date, end_date)
        
        # Return simple format for frontend
        return {
            "total_academic_days": metrics["total_academic_days"],
            "total_periods": metrics["total_periods"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating summary: {str(e)}"
        )


@router.get("/validate-data")
async def validate_academic_data(
    start_date: date = Query(..., description="Semester start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Semester end date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Validate that academic events and class schedules are properly configured.
    
    Checks for:
    - Missing academic events (class days)
    - Days with events but no schedules
    - Days with schedules but no events
    - Inconsistencies in the data
    
    Useful for system administrators to ensure data integrity.
    """
    
    calculator = AcademicCalculatorService(db)
    
    try:
        # Get class days from events
        class_days = await calculator._get_class_days(start_date, end_date)
        
        # Check each day for schedule consistency
        validation_results = {
            "total_class_days": len(class_days),
            "days_with_issues": [],
            "summary": {
                "days_without_schedules": 0,
                "days_with_empty_schedules": 0,
                "total_issues": 0
            }
        }
        
        for class_day in class_days:
            periods_count = await calculator._get_periods_for_day(class_day)
            
            if periods_count == 0:
                validation_results["days_with_issues"].append({
                    "date": class_day.strftime("%Y-%m-%d"),
                    "day_of_week": class_day.strftime("%A"),
                    "issue": "No scheduled subjects found",
                    "periods_count": 0
                })
                validation_results["summary"]["days_with_empty_schedules"] += 1
        
        validation_results["summary"]["total_issues"] = len(validation_results["days_with_issues"])
        validation_results["data_integrity"] = "good" if validation_results["summary"]["total_issues"] == 0 else "needs_attention"
        
        return {
            "success": True,
            "validation": validation_results
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error validating academic data: {str(e)}"
        )