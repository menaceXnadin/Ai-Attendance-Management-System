"""
Academic Calendar API Endpoints
Provides REST API for calendar management with student/admin permissions
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import and_, or_, extract, func, select
from typing import List, Optional, Dict, Any
from datetime import date, datetime, timedelta
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models import User, UserRole, Student, Faculty, Subject
from app.models.calendar import (
    AcademicEvent, EventAttendance, CalendarSetting, AcademicYear,
    ClassScheduleTemplate, EventType, HolidayType, AttendanceStatus
)

router = APIRouter(prefix="/calendar", tags=["calendar"])

# Pydantic schemas for request/response

class EventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    event_type: EventType
    start_date: date
    end_date: Optional[date] = None
    start_time: Optional[str] = None  # Format: "HH:MM"
    end_time: Optional[str] = None
    is_all_day: bool = False
    holiday_type: Optional[HolidayType] = None
    subject_id: Optional[int] = None
    faculty_id: Optional[int] = None
    class_room: Optional[str] = None
    color_code: str = Field(..., pattern=r'^#[0-9A-Fa-f]{6}$')
    is_recurring: bool = False
    recurrence_pattern: Optional[Dict[str, Any]] = None
    attendance_required: bool = False
    notification_settings: Optional[Dict[str, Any]] = None

class EventCreate(EventBase):
    pass

class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    event_type: Optional[EventType] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_all_day: Optional[bool] = None
    color_code: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    class_room: Optional[str] = None
    is_active: Optional[bool] = None

class EventResponse(EventBase):
    id: int
    created_by: int
    created_at: datetime
    updated_at: datetime
    is_active: bool
    subject_name: Optional[str] = None
    faculty_name: Optional[str] = None
    creator_name: str
    attendance_count: Optional[int] = None

    class Config:
        from_attributes = True

class EventAttendanceResponse(BaseModel):
    id: int
    event_id: int
    student_id: int
    status: AttendanceStatus
    marked_at: Optional[datetime]
    face_verification_used: bool
    verification_confidence: Optional[int]
    student_name: str

    class Config:
        from_attributes = True

class CalendarSettingsBase(BaseModel):
    default_view: str = Field(default="month", pattern=r'^(month|week|day)$')
    start_week_on: str = Field(default="monday", pattern=r'^(monday|sunday)$')
    email_notifications: bool = True
    push_notifications: bool = True
    reminder_before_minutes: int = Field(default=15, ge=0, le=1440)
    color_scheme: str = "default"
    show_weekends: bool = True

class CalendarSettingsUpdate(CalendarSettingsBase):
    pass

class CalendarSettingsResponse(CalendarSettingsBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MonthViewResponse(BaseModel):
    year: int
    month: int
    events: List[EventResponse]
    holidays: List[EventResponse]
    total_events: int

class AttendanceMarkRequest(BaseModel):
    status: AttendanceStatus
    face_verification_used: bool = False
    verification_confidence: Optional[int] = Field(None, ge=0, le=100)

# Helper functions

def check_admin_permission(current_user: User):
    """Check if user has admin permissions"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permissions required"
        )

async def get_user_calendar_events(db: AsyncSession, user: User, start_date: date, end_date: date):
    """Get calendar events for a user based on their role (async)."""
    stmt = (
        select(AcademicEvent)
        .where(
            and_(
                AcademicEvent.start_date >= start_date,
                AcademicEvent.start_date <= end_date,
                AcademicEvent.is_active.is_(True),
            )
        )
        .options(
            selectinload(AcademicEvent.subject),
            selectinload(AcademicEvent.faculty),
        )
    )

    # Students see events relevant to their subjects/faculty
    if user.role == UserRole.student:
        student_res = await db.execute(select(Student).where(Student.user_id == user.id))
        student = student_res.scalar_one_or_none()
        if student:
            stmt = stmt.where(
                or_(
                    AcademicEvent.faculty_id == student.faculty_id,
                    AcademicEvent.event_type.in_([EventType.HOLIDAY, EventType.SPECIAL_EVENT]),
                    AcademicEvent.faculty_id.is_(None),
                )
            )

    result = await db.execute(stmt)
    return result.scalars().all()

# Calendar endpoints

@router.get("/events", response_model=List[EventResponse])
async def get_calendar_events(
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    event_type: Optional[EventType] = Query(None, description="Filter by event type"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get calendar events for the current user within date range"""
    
    # Validate date range
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )
    
    if (end_date - start_date).days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date range cannot exceed 365 days"
        )
    
    try:
        # Simple query without relationships first
        stmt = (
            select(AcademicEvent)
            .where(
                and_(
                    AcademicEvent.start_date >= start_date,
                    AcademicEvent.start_date <= end_date,
                    AcademicEvent.is_active.is_(True),
                )
            )
        )

        # Students see events relevant to their subjects/faculty
        if current_user.role == UserRole.student:
            student_res = await db.execute(select(Student).where(Student.user_id == current_user.id))
            student = student_res.scalar_one_or_none()
            if student:
                stmt = stmt.where(
                    or_(
                        AcademicEvent.faculty_id == student.faculty_id,
                        AcademicEvent.event_type.in_([EventType.HOLIDAY, EventType.SPECIAL_EVENT]),
                        AcademicEvent.faculty_id.is_(None),
                    )
                )

        result = await db.execute(stmt)
        events = result.scalars().all()
        
        # Filter by event type if specified
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        
        # Build response without complex relationships to avoid errors
        enhanced_events: List[EventResponse] = []
        for event in events:
            # Get subject and faculty names separately to avoid relationship issues
            subject_name = None
            faculty_name = None
            
            if event.subject_id:
                subject_res = await db.execute(select(Subject).where(Subject.id == event.subject_id))
                subject = subject_res.scalar_one_or_none()
                if subject:
                    subject_name = subject.name
            
            if event.faculty_id:
                faculty_res = await db.execute(select(Faculty).where(Faculty.id == event.faculty_id))
                faculty = faculty_res.scalar_one_or_none()
                if faculty:
                    faculty_name = faculty.name

            event_data = {
                "id": event.id,
                "title": event.title,
                "description": event.description,
                "event_type": event.event_type,
                "start_date": event.start_date,
                "end_date": event.end_date,
                "start_time": event.start_time.strftime("%H:%M") if event.start_time else None,
                "end_time": event.end_time.strftime("%H:%M") if event.end_time else None,
                "is_all_day": event.is_all_day,
                "holiday_type": event.holiday_type,
                "subject_id": event.subject_id,
                "faculty_id": event.faculty_id,
                "class_room": event.class_room,
                "color_code": event.color_code,
                "is_recurring": event.is_recurring,
                "recurrence_pattern": event.recurrence_pattern,
                "attendance_required": event.attendance_required,
                "notification_settings": event.notification_settings,
                "created_by": event.created_by,
                "created_at": event.created_at,
                "updated_at": event.updated_at,
                "is_active": event.is_active,
                "subject_name": subject_name,
                "faculty_name": faculty_name,
                "creator_name": "System",
                "attendance_count": None,
            }

            # Add attendance count for admins
            if current_user.role == UserRole.admin:
                cnt_res = await db.execute(
                    select(func.count(EventAttendance.id)).where(
                        EventAttendance.event_id == event.id
                    )
                )
                event_data["attendance_count"] = cnt_res.scalar() or 0

            enhanced_events.append(EventResponse(**event_data))

        return enhanced_events
        
    except Exception as e:
        print(f"Calendar events error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching calendar events: {str(e)}"
        )

@router.get("/month/{year}/{month}", response_model=MonthViewResponse)
async def get_month_view(
    year: int = Path(..., ge=2020, le=2030),
    month: int = Path(..., ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get calendar events for a specific month"""
    
    # Calculate month boundaries
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)
    
    events = await get_user_calendar_events(db, current_user, start_date, end_date)
    
    # Separate events and holidays
    regular_events = [e for e in events if e.event_type != EventType.HOLIDAY]
    holidays = [e for e in events if e.event_type == EventType.HOLIDAY]
    
    def map_event(e: AcademicEvent) -> EventResponse:
        return EventResponse(
            id=e.id,
            title=e.title,
            description=e.description,
            event_type=e.event_type,
            start_date=e.start_date,
            end_date=e.end_date,
            start_time=e.start_time.strftime("%H:%M") if e.start_time else None,
            end_time=e.end_time.strftime("%H:%M") if e.end_time else None,
            is_all_day=e.is_all_day,
            holiday_type=e.holiday_type,
            subject_id=e.subject_id,
            faculty_id=e.faculty_id,
            class_room=e.class_room,
            color_code=e.color_code,
            is_recurring=e.is_recurring,
            recurrence_pattern=e.recurrence_pattern,
            attendance_required=e.attendance_required,
            notification_settings=e.notification_settings,
            created_by=e.created_by,
            created_at=e.created_at,
            updated_at=e.updated_at,
            is_active=e.is_active,
            subject_name=e.subject.name if e.subject else None,
            faculty_name=e.faculty.name if e.faculty else None,
            creator_name="System",  # Simplified since creator relationship has issues
            attendance_count=None,
        )

    return MonthViewResponse(
        year=year,
        month=month,
        events=[map_event(e) for e in regular_events],
        holidays=[map_event(h) for h in holidays],
        total_events=len(events),
    )

@router.post("/events", response_model=EventResponse)
async def create_event(
    event_data: EventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new calendar event (Admin only)"""
    check_admin_permission(current_user)
    
    # Validate subject and faculty if provided
    if event_data.subject_id:
        subject = await db.get(Subject, event_data.subject_id)
        if not subject:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found",
            )
    
    if event_data.faculty_id:
        faculty = await db.get(Faculty, event_data.faculty_id)
        if not faculty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Faculty not found",
            )
    
    # Prepare event data with proper time handling
    from datetime import time
    event_dict = event_data.dict()
    
    # Convert empty time strings to None and parse valid times
    for time_field in ['start_time', 'end_time']:
        if time_field in event_dict and event_dict[time_field]:
            if isinstance(event_dict[time_field], str):
                if event_dict[time_field].strip() == '':
                    event_dict[time_field] = None
                else:
                    try:
                        h, m = map(int, event_dict[time_field].split(':'))
                        event_dict[time_field] = time(hour=h, minute=m)
                    except (ValueError, AttributeError):
                        event_dict[time_field] = None
        else:
            event_dict[time_field] = None
    
    # Create the event
    db_event = AcademicEvent(
        **event_dict,
        created_by=current_user.id
    )
    
    db.add(db_event)
    await db.commit()
    await db.refresh(db_event)

    # Manually construct the response to ensure correct time formatting
    return EventResponse(
        id=db_event.id,
        title=db_event.title,
        description=db_event.description,
        event_type=db_event.event_type,
        start_date=db_event.start_date,
        end_date=db_event.end_date,
        start_time=db_event.start_time.strftime("%H:%M") if db_event.start_time else None,
        end_time=db_event.end_time.strftime("%H:%M") if db_event.end_time else None,
        is_all_day=db_event.is_all_day,
        holiday_type=db_event.holiday_type,
        subject_id=db_event.subject_id,
        faculty_id=db_event.faculty_id,
        class_room=db_event.class_room,
        color_code=db_event.color_code,
        is_recurring=db_event.is_recurring,
        recurrence_pattern=db_event.recurrence_pattern,
        attendance_required=db_event.attendance_required,
        notification_settings=db_event.notification_settings,
        created_by=db_event.created_by,
        created_at=db_event.created_at,
        updated_at=db_event.updated_at,
        is_active=db_event.is_active,
        subject_name=None,  # Simplified for now
        faculty_name=None,  # Simplified for now
        creator_name="System", # Simplified
        attendance_count=None,
    )

@router.put("/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    event_data: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing calendar event (Admin only)"""
    check_admin_permission(current_user)
    
    res = await db.execute(select(AcademicEvent).where(AcademicEvent.id == event_id))
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Update only provided fields, with time string parsing
    from datetime import time
    update_data = event_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field in ("start_time", "end_time") and isinstance(value, str):
            # Parse "HH:MM" string to time object
            try:
                h, m = map(int, value.split(":"))
                value = time(hour=h, minute=m)
            except Exception:
                value = None
        setattr(event, field, value)

    event.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(event)

    # Manually construct the response to ensure correct time formatting
    return EventResponse(
        id=event.id,
        title=event.title,
        description=event.description,
        event_type=event.event_type,
        start_date=event.start_date,
        end_date=event.end_date,
        start_time=event.start_time.strftime("%H:%M") if event.start_time else None,
        end_time=event.end_time.strftime("%H:%M") if event.end_time else None,
        is_all_day=event.is_all_day,
        holiday_type=event.holiday_type,
        subject_id=event.subject_id,
        faculty_id=event.faculty_id,
        class_room=event.class_room,
        color_code=event.color_code,
        is_recurring=event.is_recurring,
        recurrence_pattern=event.recurrence_pattern,
        attendance_required=event.attendance_required,
        notification_settings=event.notification_settings,
        created_by=event.created_by,
        created_at=event.created_at,
        updated_at=event.updated_at,
        is_active=event.is_active,
        subject_name=None, # Simplified for now
        faculty_name=None, # Simplified for now
        creator_name="System", # Simplified
        attendance_count=None,
    )

@router.delete("/events/{event_id}")
async def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a calendar event (Admin only)"""
    check_admin_permission(current_user)
    
    res = await db.execute(select(AcademicEvent).where(AcademicEvent.id == event_id))
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Hard delete - actually remove the record from database
    await db.delete(event)
    await db.commit()
    
    return {"message": "Event deleted successfully"}

# Attendance endpoints

@router.get("/events/{event_id}/attendance", response_model=List[EventAttendanceResponse])
async def get_event_attendance(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get attendance records for an event (Admin only)"""
    check_admin_permission(current_user)
    
    res = await db.execute(select(AcademicEvent).where(AcademicEvent.id == event_id))
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    att_res = await db.execute(
        select(EventAttendance).where(EventAttendance.event_id == event_id)
    )
    attendance_records = att_res.scalars().all()
    
    enhanced_records = []
    for record in attendance_records:
        stu_res = await db.execute(select(Student).where(Student.id == record.student_id))
        student = stu_res.scalar_one_or_none()
        record_dict = {
            **record.__dict__,
            "student_name": student.user.full_name if student else "Unknown"
        }
        enhanced_records.append(EventAttendanceResponse(**record_dict))
    
    return enhanced_records

@router.post("/events/{event_id}/attendance")
async def mark_attendance(
    event_id: int,
    attendance_data: AttendanceMarkRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark attendance for an event (Students can mark their own, Admins can mark anyone's)"""
    
    # Find the event
    res = await db.execute(select(AcademicEvent).where(AcademicEvent.id == event_id))
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # For students, they can only mark their own attendance
    if current_user.role == UserRole.student:
        sres = await db.execute(
            select(Student).where(Student.user_id == current_user.id)
        )
        student = sres.scalar_one_or_none()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found",
            )
        student_id = student.id
    else:
        # Admin implementation would require student_id parameter
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin attendance marking requires student_id parameter"
        )
    
    # Check if attendance already exists
    ex_res = await db.execute(
        select(EventAttendance).where(
            and_(
                EventAttendance.event_id == event_id,
                EventAttendance.student_id == student_id,
            )
        )
    )
    existing_attendance = ex_res.scalar_one_or_none()
    
    if existing_attendance:
        # Update existing attendance
        existing_attendance.status = attendance_data.status
        existing_attendance.marked_at = datetime.utcnow()
        existing_attendance.face_verification_used = attendance_data.face_verification_used
        existing_attendance.verification_confidence = attendance_data.verification_confidence
        existing_attendance.marked_by = current_user.id
    else:
        # Create new attendance record
        new_attendance = EventAttendance(
            event_id=event_id,
            student_id=student_id,
            status=attendance_data.status,
            marked_at=datetime.utcnow(),
            face_verification_used=attendance_data.face_verification_used,
            verification_confidence=attendance_data.verification_confidence,
            marked_by=current_user.id
        )
        db.add(new_attendance)
    
    await db.commit()
    return {"message": "Attendance marked successfully"}

# Settings endpoints

@router.get("/settings", response_model=CalendarSettingsResponse)
async def get_calendar_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get calendar settings for current user"""
    
    res = await db.execute(
        select(CalendarSetting).where(CalendarSetting.user_id == current_user.id)
    )
    settings = res.scalar_one_or_none()
    
    if not settings:
        # Create default settings
        settings = CalendarSetting(user_id=current_user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    
    return CalendarSettingsResponse(**settings.__dict__)

@router.put("/settings", response_model=CalendarSettingsResponse)
async def update_calendar_settings(
    settings_data: CalendarSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update calendar settings for current user"""
    
    res = await db.execute(
        select(CalendarSetting).where(CalendarSetting.user_id == current_user.id)
    )
    settings = res.scalar_one_or_none()
    
    if not settings:
        settings = CalendarSetting(user_id=current_user.id)
        db.add(settings)
    
    # Update settings
    for field, value in settings_data.dict().items():
        setattr(settings, field, value)
    
    settings.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(settings)
    
    return CalendarSettingsResponse(**settings.__dict__)

# Support POST for settings to align with some clients
@router.post("/settings", response_model=CalendarSettingsResponse)
async def create_or_update_calendar_settings(
    settings_data: CalendarSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update calendar settings for current user (POST alias)."""
    res = await db.execute(
        select(CalendarSetting).where(CalendarSetting.user_id == current_user.id)
    )
    settings = res.scalar_one_or_none()
    if not settings:
        settings = CalendarSetting(user_id=current_user.id)
        db.add(settings)
    # Update settings
    for field, value in settings_data.dict().items():
        setattr(settings, field, value)
    settings.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(settings)
    return CalendarSettingsResponse(**settings.__dict__)

# Statistics endpoints

@router.get("/stats/overview")
async def get_calendar_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get calendar overview statistics"""
    
    today = date.today()
    start_of_month = today.replace(day=1)
    end_of_month = (start_of_month + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    
    # Get events for current month
    events = await get_user_calendar_events(db, current_user, start_of_month, end_of_month)
    
    stats = {
        "total_events_this_month": len(events),
        "upcoming_events": len([e for e in events if e.start_date >= today]),
        "classes_this_month": len([e for e in events if e.event_type == EventType.CLASS]),
        "holidays_this_month": len([e for e in events if e.event_type == EventType.HOLIDAY]),
        "exams_this_month": len([e for e in events if e.event_type == EventType.EXAM])
    }
    
    # Add attendance stats for students
    if current_user.role == UserRole.student:
        sres = await db.execute(select(Student).where(Student.user_id == current_user.id))
        student = sres.scalar_one_or_none()
        if student:
            cnt_res = await db.execute(
                select(func.count(EventAttendance.id)).where(
                    and_(
                        EventAttendance.student_id == student.id,
                        EventAttendance.status == AttendanceStatus.PRESENT,
                        extract('month', EventAttendance.created_at) == today.month,
                    )
                )
            )
            stats["attended_events_this_month"] = cnt_res.scalar() or 0
    
    return stats
