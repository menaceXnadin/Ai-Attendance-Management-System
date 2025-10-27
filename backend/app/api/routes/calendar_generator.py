"""
Calendar Generator API Routes

Endpoints for automatic calendar generation and maintenance.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict
from datetime import date, timedelta

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models import User, UserRole
from app.services.calendar_generator import (
    CalendarGeneratorService,
    auto_generate_calendar,
    generate_full_semester_calendar
)

router = APIRouter(prefix="/calendar-generator", tags=["calendar-generator"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role for calendar generation endpoints"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=403,
            detail="Only administrators can generate calendar events"
        )
    return current_user


@router.post("/auto-generate")
async def auto_generate_events(
    days_ahead: int = Query(30, description="Number of days to generate ahead", ge=1, le=180),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
) -> Dict:
    """
    Automatically generate class events for upcoming days.
    
    This endpoint should be called:
    - Daily via scheduled task/cron job
    - After adding new class schedules
    - When testing the system
    
    Args:
        days_ahead: How many days into the future to generate (default: 30, max: 180)
    
    Returns:
        Statistics about events created
    """
    try:
        result = await auto_generate_calendar(db, days_ahead)
        
        return {
            "success": True,
            "message": f"Calendar auto-generation complete",
            "statistics": result,
            "days_ahead": days_ahead
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating calendar: {str(e)}"
        )


@router.post("/generate-semester")
async def generate_full_semester(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
) -> Dict:
    """
    Generate class events for the entire current semester.
    
    Use this endpoint:
    - Initial setup of a new semester
    - After major schedule changes
    - To regenerate all events
    
    Warning: This may create a large number of events (100-500+)
    """
    try:
        result = await generate_full_semester_calendar(db)
        
        return {
            "success": True,
            "message": "Full semester calendar generated",
            "statistics": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating semester calendar: {str(e)}"
        )


@router.post("/cleanup-old-events")
async def cleanup_old_events(
    days_old: int = Query(90, description="Remove events older than this many days", ge=30, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
) -> Dict:
    """
    Clean up old auto-generated events to prevent database bloat.
    
    Args:
        days_old: Remove events older than this many days (default: 90, min: 30, max: 365)
    
    Returns:
        Number of events deleted
    """
    try:
        generator = CalendarGeneratorService(db)
        deleted_count = await generator.cleanup_old_events(days_old)
        
        return {
            "success": True,
            "message": f"Cleaned up {deleted_count} old events",
            "deleted_count": deleted_count,
            "cutoff_days": days_old
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error cleaning up events: {str(e)}"
        )


@router.get("/status")
async def get_generator_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict:
    """
    Get status of calendar generation system.
    
    Returns:
        Information about current semester, upcoming events coverage, etc.
    """
    try:
        generator = CalendarGeneratorService(db)
        semester = await generator.get_current_semester()
        
        if not semester:
            return {
                "status": "warning",
                "message": "No current semester configured",
                "semester": None,
                "coverage": None
            }
        
        # Check how many days ahead are covered
        from sqlalchemy import select, func, and_
        from app.models import AcademicEvent, EventType
        
        today = date.today()
        future_30_days = today + timedelta(days=30)
        
        # Count existing events in next 30 days
        query = select(func.count(AcademicEvent.id)).where(
            and_(
                AcademicEvent.start_date >= today,
                AcademicEvent.start_date <= future_30_days,
                AcademicEvent.event_type == EventType.CLASS,
                AcademicEvent.is_active == True
            )
        )
        result = await db.execute(query)
        future_events_count = result.scalar() or 0
        
        return {
            "status": "active",
            "message": "Calendar generation system operational",
            "semester": {
                "name": semester.semester_name,
                "number": semester.semester_number,
                "academic_year": semester.academic_year,
                "start_date": semester.start_date.isoformat(),
                "end_date": semester.end_date.isoformat(),
                "is_current": semester.is_current
            },
            "coverage": {
                "events_next_30_days": future_events_count,
                "last_check": today.isoformat(),
                "recommendation": "Run auto-generate if count is low" if future_events_count < 20 else "Coverage looks good"
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Error checking status: {str(e)}",
            "semester": None,
            "coverage": None
        }


@router.post("/regenerate-date-range")
async def regenerate_date_range(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
) -> Dict:
    """
    Regenerate events for a specific date range.
    
    Useful for:
    - Fixing missing events in a specific period
    - Updating events after schedule changes
    - Testing specific date ranges
    """
    try:
        # Parse dates
        from datetime import datetime
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        
        if end < start:
            raise HTTPException(
                status_code=400,
                detail="End date must be after start date"
            )
        
        if (end - start).days > 180:
            raise HTTPException(
                status_code=400,
                detail="Date range too large (max 180 days)"
            )
        
        generator = CalendarGeneratorService(db)
        semester = await generator.get_current_semester()
        
        if not semester:
            raise HTTPException(
                status_code=404,
                detail="No current semester configured"
            )
        
        result = await generator.generate_events_for_date_range(
            start_date=start,
            end_date=end,
            semester=semester.semester_number,
            academic_year=semester.academic_year
        )
        
        return {
            "success": True,
            "message": f"Events regenerated for {start_date} to {end_date}",
            "statistics": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error regenerating events: {str(e)}"
        )
