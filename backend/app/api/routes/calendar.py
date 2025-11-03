from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, delete
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta, time
from app.core.database import get_db
from app.models import AcademicEvent, EventType, HolidayType, User
from app.api.dependencies import get_current_user
from app.services.automatic_semester import AutomaticSemesterService
import calendar

router = APIRouter(prefix="/calendar", tags=["calendar"])

@router.get("/events")
async def get_calendar_events(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    event_type: Optional[EventType] = Query(None, description="Filter by event type"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get calendar events for a date range"""
    
    query = select(AcademicEvent).where(AcademicEvent.is_active == True)
    
    # Apply date filters
    if start_date and end_date:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        query = query.where(
            and_(
                AcademicEvent.start_date >= start,
                AcademicEvent.start_date <= end
            )
        )
    
    # Apply event type filter
    if event_type:
        query = query.where(AcademicEvent.event_type == event_type)
    
    query = query.order_by(AcademicEvent.start_date, AcademicEvent.start_time)
    result = await db.execute(query)
    events = result.scalars().all()
    
    # Transform to frontend format
    calendar_events = []
    for event in events:
        calendar_events.append({
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "event_type": event.event_type.value,
            "start_date": event.start_date.isoformat(),
            "end_date": event.end_date.isoformat() if event.end_date else event.start_date.isoformat(),
            "start_time": event.start_time.strftime("%H:%M") if event.start_time else None,
            "end_time": event.end_time.strftime("%H:%M") if event.end_time else None,
            "is_all_day": event.is_all_day,
            "color_code": event.color_code,
            "subject_id": event.subject_id,
            "faculty_id": event.faculty_id,
            "class_room": event.class_room,
            "attendance_required": event.attendance_required
        })
    
    return calendar_events

@router.get("/semester-info")
async def get_semester_info(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current semester information and statistics"""
    
    # Use automatic semester detection
    period = AutomaticSemesterService.get_current_period()
    semester_start = period.start_date
    semester_end = period.end_date
    semester_name = period.semester_name
    
    # Get all academic events in current semester
    events_query = select(AcademicEvent).where(
        and_(
            AcademicEvent.start_date >= semester_start,
            AcademicEvent.start_date <= semester_end,
            AcademicEvent.is_active == True
        )
    )
    
    result = await db.execute(events_query)
    all_events = result.scalars().all()
    
    # Count events by type
    class_days = len([e for e in all_events if e.event_type == EventType.CLASS])
    holidays = len([e for e in all_events if e.event_type == EventType.HOLIDAY])
    exams = len([e for e in all_events if e.event_type == EventType.EXAM])
    special_events = len([e for e in all_events if e.event_type == EventType.SPECIAL_EVENT])
    
    # Calculate days elapsed and remaining
    today = date.today()
    days_elapsed = max(0, (today - semester_start).days)
    days_remaining = max(0, (semester_end - today).days)
    total_semester_days = (semester_end - semester_start).days + 1
    
    # Calculate progress percentage
    progress_percentage = min(100, (days_elapsed / total_semester_days) * 100) if total_semester_days > 0 else 0
    
    return {
        "semester_name": semester_name,
        "start_date": semester_start.isoformat(),
        "end_date": semester_end.isoformat(),
        "total_days": total_semester_days,
        "days_elapsed": days_elapsed,
        "days_remaining": days_remaining,
        "progress_percentage": round(progress_percentage, 1),
        "academic_statistics": {
            "total_class_days": class_days,
            "total_holidays": holidays,
            "total_exams": exams,
            "special_events": special_events,
            "total_academic_events": len(all_events)
        },
        "current_week": {
            "week_number": today.isocalendar()[1],
            "week_start": (today - timedelta(days=today.weekday())).isoformat(),
            "week_end": (today + timedelta(days=6-today.weekday())).isoformat()
        }
    }

@router.post("/populate-semester")
async def populate_semester_calendar(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Populate calendar with class days and Saturday holidays for current semester"""
    
    # Check if user is admin
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can populate calendar data"
        )
    
    # Use automatic semester detection
    period = AutomaticSemesterService.get_current_period()
    semester_start = period.start_date
    semester_end = period.end_date
    semester_name = period.semester_name
    
    # Clear existing events for this semester
    delete_query = delete(AcademicEvent).where(
        and_(
            AcademicEvent.start_date >= semester_start,
            AcademicEvent.start_date <= semester_end
        )
    )
    await db.execute(delete_query)
    
    # Generate calendar events
    current_date = semester_start
    events_created = 0
    
    while current_date <= semester_end:
        # Saturday (5) = Holiday (Nepal standard), Sunday-Friday = Class days
        if current_date.weekday() == 5:  # Saturday
            # Create holiday event
            holiday_event = AcademicEvent(
                title=f"Saturday Holiday",
                description="Regular Saturday holiday (Nepal standard)",
                event_type=EventType.HOLIDAY,
                start_date=current_date,
                end_date=current_date,
                is_all_day=True,
                holiday_type=HolidayType.FULL_DAY,
                color_code="#EF4444",  # Red for holidays
                created_by=current_user.id,
                attendance_required=False
            )
            db.add(holiday_event)
            events_created += 1
            
        else:  # Sunday to Friday = Class days
            class_event = AcademicEvent(
                title=f"Academic Day",
                description=f"Regular class day - {current_date.strftime('%A')}",
                event_type=EventType.CLASS,
                start_date=current_date,
                end_date=current_date,
                start_time=time(8, 0),  # 8:00 AM
                end_time=time(17, 0),   # 5:00 PM
                is_all_day=False,
                color_code="#10B981",   # Green for class days
                created_by=current_user.id,
                attendance_required=True
            )
            db.add(class_event)
            events_created += 1
        
        current_date += timedelta(days=1)
    
    await db.commit()
    
    return {
        "message": f"Successfully populated {semester_name} calendar",
        "semester_start": semester_start.isoformat(),
        "semester_end": semester_end.isoformat(),
        "events_created": events_created,
        "academic_days": len([d for d in range((semester_end - semester_start).days + 1) 
                             if (semester_start + timedelta(days=d)).weekday() != 5]),  # All days except Saturday
        "holidays": len([d for d in range((semester_end - semester_start).days + 1) 
                        if (semester_start + timedelta(days=d)).weekday() == 5])  # Only Saturdays
    }

@router.get("/academic-days-count")
async def get_academic_days_count(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get count of academic days (class days) in a date range based on calendar events"""
    
    # Use current semester if no dates provided
    if not start_date or not end_date:
        current_year = datetime.now().year
        # Use automatic semester detection
        period = AutomaticSemesterService.get_current_period()
        start = period.start_date
        end = period.end_date
    else:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    
    # Count class days from calendar events
    class_days_query = select(func.count(AcademicEvent.id)).where(
        and_(
            AcademicEvent.start_date >= start,
            AcademicEvent.start_date <= end,
            AcademicEvent.event_type == EventType.CLASS,
            AcademicEvent.is_active == True
        )
    )
    
    # Count holidays
    holidays_query = select(func.count(AcademicEvent.id)).where(
        and_(
            AcademicEvent.start_date >= start,
            AcademicEvent.start_date <= end,
            AcademicEvent.event_type == EventType.HOLIDAY,
            AcademicEvent.is_active == True
        )
    )
    
    class_days_result = await db.execute(class_days_query)
    holidays_result = await db.execute(holidays_query)
    
    total_class_days = class_days_result.scalar() or 0
    total_holidays = holidays_result.scalar() or 0
    
    # Calculate some additional stats
    total_calendar_days = (end - start).days + 1
    days_elapsed = max(0, (date.today() - start).days) if date.today() >= start else 0
    
    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "total_calendar_days": total_calendar_days,
        "total_class_days": total_class_days,
        "total_holidays": total_holidays,
        "days_elapsed": min(days_elapsed, total_calendar_days),
        "class_days_remaining": max(0, total_class_days - days_elapsed) if date.today() >= start else total_class_days
    }

@router.delete("/events/{event_id}")
async def delete_calendar_event(
    event_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a calendar event (admin only)"""
    
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete calendar events"
        )
    
    # Find the event
    result = await db.execute(select(AcademicEvent).where(AcademicEvent.id == event_id))
    event = result.scalar_one_or_none()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar event not found"
        )
    
    await db.delete(event)
    await db.commit()
    
    return {"message": "Calendar event deleted successfully"}

@router.post("/events")
async def create_calendar_event(
    event_data: dict,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new calendar event (admin only)"""
    
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create calendar events"
        )
    
    # Create new event
    new_event = AcademicEvent(
        title=event_data["title"],
        description=event_data.get("description"),
        event_type=EventType(event_data["event_type"]),
        start_date=datetime.strptime(event_data["start_date"], "%Y-%m-%d").date(),
        end_date=datetime.strptime(event_data["end_date"], "%Y-%m-%d").date() if event_data.get("end_date") else None,
        start_time=datetime.strptime(event_data["start_time"], "%H:%M").time() if event_data.get("start_time") else None,
        end_time=datetime.strptime(event_data["end_time"], "%H:%M").time() if event_data.get("end_time") else None,
        is_all_day=event_data.get("is_all_day", False),
        color_code=event_data.get("color_code", "#10B981"),
        created_by=current_user.id,
        attendance_required=event_data.get("attendance_required", False)
    )
    
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)
    
    return {
        "id": new_event.id,
        "message": "Calendar event created successfully",
        "event": {
            "title": new_event.title,
            "event_type": new_event.event_type.value,
            "start_date": new_event.start_date.isoformat(),
            "end_date": new_event.end_date.isoformat() if new_event.end_date else None
        }
    }

@router.put("/events/{event_id}")
async def update_calendar_event(
    event_id: int,
    event_data: dict,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a calendar event (admin only)"""
    
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update calendar events"
        )
    
    # Find the event
    result = await db.execute(select(AcademicEvent).where(AcademicEvent.id == event_id))
    event = result.scalar_one_or_none()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar event not found"
        )
    
    # Update event fields
    event.title = event_data["title"]
    event.description = event_data.get("description")
    event.event_type = EventType(event_data["event_type"])
    event.start_date = datetime.strptime(event_data["start_date"], "%Y-%m-%d").date()
    event.end_date = datetime.strptime(event_data["end_date"], "%Y-%m-%d").date() if event_data.get("end_date") else None
    event.start_time = datetime.strptime(event_data["start_time"], "%H:%M").time() if event_data.get("start_time") else None
    event.end_time = datetime.strptime(event_data["end_time"], "%H:%M").time() if event_data.get("end_time") else None
    event.is_all_day = event_data.get("is_all_day", False)
    event.color_code = event_data.get("color_code", "#10B981")
    event.attendance_required = event_data.get("attendance_required", False)
    
    # Update location if provided
    if "location" in event_data:
        event.class_room = event_data["location"]
    
    await db.commit()
    await db.refresh(event)
    
    return {
        "id": event.id,
        "message": "Calendar event updated successfully",
        "event": {
            "title": event.title,
            "description": event.description,
            "event_type": event.event_type.value,
            "start_date": event.start_date.isoformat(),
            "end_date": event.end_date.isoformat() if event.end_date else None,
            "start_time": event.start_time.strftime("%H:%M") if event.start_time else None,
            "end_time": event.end_time.strftime("%H:%M") if event.end_time else None,
            "is_all_day": event.is_all_day,
            "color_code": event.color_code,
            "location": event.class_room,
            "attendance_required": event.attendance_required
        }
    }