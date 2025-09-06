from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import time, datetime
from pydantic import BaseModel, Field
from app.core.database import get_db
from app.models import ClassSchedule, Subject, Faculty, DayOfWeek, Student
from app.api.dependencies import get_current_user, get_current_admin, get_current_student

router = APIRouter(prefix="/schedules", tags=["schedules"])

# Pydantic models for request/response
class ScheduleCreate(BaseModel):
    subject_id: int
    faculty_id: int
    day_of_week: DayOfWeek
    start_time: str = Field(..., pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$", example="08:00")
    end_time: str = Field(..., pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$", example="09:30")
    semester: int = Field(..., ge=1, le=8)
    academic_year: int = Field(..., ge=2020, le=2030)
    classroom: Optional[str] = None
    instructor_name: Optional[str] = None
    notes: Optional[str] = None

class ScheduleUpdate(BaseModel):
    subject_id: Optional[int] = None
    faculty_id: Optional[int] = None
    day_of_week: Optional[DayOfWeek] = None
    start_time: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    end_time: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    semester: Optional[int] = Field(None, ge=1, le=8)
    academic_year: Optional[int] = Field(None, ge=2020, le=2030)
    classroom: Optional[str] = None
    instructor_name: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class ScheduleResponse(BaseModel):
    id: int
    subject_id: int
    subject_name: str
    subject_code: str
    faculty_id: int
    faculty_name: str
    day_of_week: str
    start_time: str
    end_time: str
    semester: int
    academic_year: int
    classroom: Optional[str]
    instructor_name: Optional[str]
    is_active: bool
    notes: Optional[str]
    duration_minutes: int
    time_slot_display: str

    class Config:
        from_attributes = True

def parse_time_string(time_str: str) -> time:
    """Convert time string (HH:MM) to time object"""
    try:
        return datetime.strptime(time_str, "%H:%M").time()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid time format: {time_str}. Use HH:MM format."
        )

@router.post("", response_model=ScheduleResponse)
async def create_schedule(
    schedule_data: ScheduleCreate,
    current_user = Depends(get_current_admin),  # Only admins can create schedules
    db: AsyncSession = Depends(get_db)
):
    """Create a new class schedule (Admin only)"""
    
    # Validate subject exists
    subject_query = select(Subject).where(Subject.id == schedule_data.subject_id)
    subject_result = await db.execute(subject_query)
    subject = subject_result.scalar_one_or_none()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject with ID {schedule_data.subject_id} not found"
        )
    
    # Validate faculty exists
    faculty_query = select(Faculty).where(Faculty.id == schedule_data.faculty_id)
    faculty_result = await db.execute(faculty_query)
    faculty = faculty_result.scalar_one_or_none()
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty with ID {schedule_data.faculty_id} not found"
        )
    
    # Parse time strings
    start_time = parse_time_string(schedule_data.start_time)
    end_time = parse_time_string(schedule_data.end_time)
    
    # Validate time logic
    if start_time >= end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start time must be before end time"
        )
    
    # Check for time conflicts (same faculty, day, semester, year)
    conflict_query = select(ClassSchedule).where(
        and_(
            ClassSchedule.faculty_id == schedule_data.faculty_id,
            ClassSchedule.day_of_week == schedule_data.day_of_week,
            ClassSchedule.semester == schedule_data.semester,
            ClassSchedule.academic_year == schedule_data.academic_year,
            ClassSchedule.is_active == True,
            or_(
                and_(ClassSchedule.start_time <= start_time, ClassSchedule.end_time > start_time),
                and_(ClassSchedule.start_time < end_time, ClassSchedule.end_time >= end_time),
                and_(ClassSchedule.start_time >= start_time, ClassSchedule.end_time <= end_time)
            )
        )
    )
    conflict_result = await db.execute(conflict_query)
    existing_schedule = conflict_result.scalar_one_or_none()
    
    if existing_schedule:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Time conflict: Faculty {faculty.name} already has a class on {schedule_data.day_of_week.value} from {existing_schedule.start_time} to {existing_schedule.end_time}"
        )
    
    # Check classroom conflicts if classroom is specified
    if schedule_data.classroom:
        classroom_conflict_query = select(ClassSchedule).where(
            and_(
                ClassSchedule.classroom == schedule_data.classroom,
                ClassSchedule.day_of_week == schedule_data.day_of_week,
                ClassSchedule.academic_year == schedule_data.academic_year,
                ClassSchedule.is_active == True,
                or_(
                    and_(ClassSchedule.start_time <= start_time, ClassSchedule.end_time > start_time),
                    and_(ClassSchedule.start_time < end_time, ClassSchedule.end_time >= end_time),
                    and_(ClassSchedule.start_time >= start_time, ClassSchedule.end_time <= end_time)
                )
            )
        )
        classroom_conflict_result = await db.execute(classroom_conflict_query)
        classroom_conflict = classroom_conflict_result.scalar_one_or_none()
        
        if classroom_conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Classroom conflict: {schedule_data.classroom} is already booked on {schedule_data.day_of_week.value} from {classroom_conflict.start_time} to {classroom_conflict.end_time}"
            )
    
    # Create the schedule
    new_schedule = ClassSchedule(
        subject_id=schedule_data.subject_id,
        faculty_id=schedule_data.faculty_id,
        day_of_week=schedule_data.day_of_week,
        start_time=start_time,
        end_time=end_time,
        semester=schedule_data.semester,
        academic_year=schedule_data.academic_year,
        classroom=schedule_data.classroom,
        instructor_name=schedule_data.instructor_name,
        notes=schedule_data.notes
    )
    
    db.add(new_schedule)
    await db.commit()
    await db.refresh(new_schedule)
    
    # Return the created schedule with related data
    return ScheduleResponse(
        id=new_schedule.id,
        subject_id=new_schedule.subject_id,
        subject_name=subject.name,
        subject_code=subject.code,
        faculty_id=new_schedule.faculty_id,
        faculty_name=faculty.name,
        day_of_week=new_schedule.day_of_week.value,
        start_time=new_schedule.start_time.strftime("%H:%M"),
        end_time=new_schedule.end_time.strftime("%H:%M"),
        semester=new_schedule.semester,
        academic_year=new_schedule.academic_year,
        classroom=new_schedule.classroom,
        instructor_name=new_schedule.instructor_name,
        is_active=new_schedule.is_active,
        notes=new_schedule.notes,
        duration_minutes=new_schedule.duration_minutes,
        time_slot_display=new_schedule.time_slot_display
    )

@router.get("", response_model=List[ScheduleResponse])
async def get_schedules(
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    academic_year: Optional[int] = None,
    day_of_week: Optional[DayOfWeek] = None,
    is_active: Optional[bool] = None,  # None shows all by default
    skip: int = 0,
    limit: Optional[int] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get class schedules with optional filters"""
    
    # Build query with joins to get subject and faculty names
    query = select(ClassSchedule).options(
        selectinload(ClassSchedule.subject),
        selectinload(ClassSchedule.faculty)
    )
    
    # Apply filters
    conditions = []
    if faculty_id:
        conditions.append(ClassSchedule.faculty_id == faculty_id)
    if semester:
        conditions.append(ClassSchedule.semester == semester)
    if academic_year:
        conditions.append(ClassSchedule.academic_year == academic_year)
    if day_of_week:
        conditions.append(ClassSchedule.day_of_week == day_of_week)
    if is_active is not None:
        conditions.append(ClassSchedule.is_active == is_active)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    # Order by day of week, then start time
    query = query.order_by(ClassSchedule.day_of_week, ClassSchedule.start_time)

    # Apply pagination only when limit is provided to preserve existing behavior elsewhere
    if limit is not None:
        if skip < 0:
            skip = 0
        if limit <= 0:
            limit = 10
        query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    schedules = result.scalars().all()
    
    # Transform to response format
    schedule_responses = []
    for schedule in schedules:
        schedule_responses.append(ScheduleResponse(
            id=schedule.id,
            subject_id=schedule.subject_id,
            subject_name=schedule.subject.name if schedule.subject else "Unknown",
            subject_code=schedule.subject.code if schedule.subject else "N/A",
            faculty_id=schedule.faculty_id,
            faculty_name=schedule.faculty.name if schedule.faculty else "Unknown",
            day_of_week=schedule.day_of_week.value,
            start_time=schedule.start_time.strftime("%H:%M"),
            end_time=schedule.end_time.strftime("%H:%M"),
            semester=schedule.semester,
            academic_year=schedule.academic_year,
            classroom=schedule.classroom,
            instructor_name=schedule.instructor_name,
            is_active=schedule.is_active,
            notes=schedule.notes,
            duration_minutes=schedule.duration_minutes,
            time_slot_display=schedule.time_slot_display
        ))
    
    return schedule_responses

@router.get("/today", response_model=List[ScheduleResponse])
async def get_today_schedule(
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get today's class schedule (Public endpoint)"""
    
    # Get current day of week (Monday=0, Sunday=6 in Python weekday())
    today = datetime.now()
    day_map = {
        0: DayOfWeek.MONDAY,
        1: DayOfWeek.TUESDAY,
        2: DayOfWeek.WEDNESDAY,
        3: DayOfWeek.THURSDAY,
        4: DayOfWeek.FRIDAY,
        5: DayOfWeek.SATURDAY,
        6: DayOfWeek.SUNDAY
    }
    today_enum = day_map[today.weekday()]
    
    # Get current academic year (you might want to adjust this logic)
    current_academic_year = today.year
    
    # Build query with joins to get subject and faculty names
    query = select(ClassSchedule).options(
        selectinload(ClassSchedule.subject),
        selectinload(ClassSchedule.faculty)
    )
    
    # Apply filters for today's schedule
    conditions = [
        ClassSchedule.day_of_week == today_enum,
        ClassSchedule.academic_year == current_academic_year,
        ClassSchedule.is_active == True
    ]
    
    # Note: faculty_id parameter represents instructor faculty, not student faculty
    # For student schedules, we filter by semester instead of instructor faculty
    # if faculty_id:
    #     conditions.append(ClassSchedule.faculty_id == faculty_id)
    if semester:
        conditions.append(ClassSchedule.semester == semester)
    
    query = query.where(and_(*conditions))
    
    # Order by start time
    query = query.order_by(ClassSchedule.start_time)
    
    result = await db.execute(query)
    schedules = result.scalars().all()
    
    # Transform to response format
    schedule_responses = []
    for schedule in schedules:
        schedule_responses.append(ScheduleResponse(
            id=schedule.id,
            subject_id=schedule.subject_id,
            subject_name=schedule.subject.name if schedule.subject else "Unknown",
            subject_code=schedule.subject.code if schedule.subject else "N/A",
            faculty_id=schedule.faculty_id,
            faculty_name=schedule.faculty.name if schedule.faculty else "Unknown",
            day_of_week=schedule.day_of_week.value,
            start_time=schedule.start_time.strftime("%H:%M"),
            end_time=schedule.end_time.strftime("%H:%M"),
            semester=schedule.semester,
            academic_year=schedule.academic_year,
            classroom=schedule.classroom,
            instructor_name=schedule.instructor_name,
            is_active=schedule.is_active,
            notes=schedule.notes,
            duration_minutes=schedule.duration_minutes,
            time_slot_display=schedule.time_slot_display
        ))
    
    return schedule_responses

@router.get("/student/today", response_model=List[ScheduleResponse])
async def get_student_today_schedule(
    current_student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """Get today's class schedule for the logged-in student (Student only)"""
    
    # Get current day of week (Monday=0, Sunday=6 in Python weekday())
    today = datetime.now()
    day_map = {
        0: DayOfWeek.MONDAY,
        1: DayOfWeek.TUESDAY,
        2: DayOfWeek.WEDNESDAY,
        3: DayOfWeek.THURSDAY,
        4: DayOfWeek.FRIDAY,
        5: DayOfWeek.SATURDAY,
        6: DayOfWeek.SUNDAY
    }
    today_enum = day_map[today.weekday()]
    
    # Get current academic year (you might want to adjust this logic)
    current_academic_year = today.year
    
    # PRIMARY FILTER: By student's faculty and semester (this is the correct approach)
    # Students should see subjects from their own faculty for their semester
    query = select(ClassSchedule).options(
        selectinload(ClassSchedule.subject).selectinload(Subject.faculty),
        selectinload(ClassSchedule.faculty)
    ).join(Subject, ClassSchedule.subject_id == Subject.id)
    
    # Apply filters for today's schedule specific to this student's faculty and semester
    conditions = [
        ClassSchedule.day_of_week == today_enum,
        ClassSchedule.academic_year == current_academic_year,
        ClassSchedule.is_active == True,
        ClassSchedule.semester == current_student.semester,
        Subject.faculty_id == current_student.faculty_id  # Filter by student's faculty
    ]
    
    query = query.where(and_(*conditions))
    
    # Order by start time
    query = query.order_by(ClassSchedule.start_time)
    
    result = await db.execute(query)
    schedules = result.scalars().all()
    
    # If no subjects found for this faculty/semester, this means:
    # 1. No schedules exist for this faculty on this day/semester
    # 2. Student might be cross-enrolled (but we prioritize faculty-based subjects)
    
    # Transform to response format
    schedule_responses = []
    for schedule in schedules:
        schedule_responses.append(ScheduleResponse(
            id=schedule.id,
            subject_id=schedule.subject_id,
            subject_name=schedule.subject.name if schedule.subject else "Unknown",
            subject_code=schedule.subject.code if schedule.subject else "N/A",
            faculty_id=schedule.faculty_id,
            faculty_name=schedule.faculty.name if schedule.faculty else "Unknown",
            day_of_week=schedule.day_of_week.value,
            start_time=schedule.start_time.strftime("%H:%M"),
            end_time=schedule.end_time.strftime("%H:%M"),
            semester=schedule.semester,
            academic_year=schedule.academic_year,
            classroom=schedule.classroom,
            instructor_name=schedule.instructor_name,
            is_active=schedule.is_active,
            notes=schedule.notes,
            duration_minutes=schedule.duration_minutes,
            time_slot_display=schedule.time_slot_display
        ))
    
    return schedule_responses

@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    schedule_data: ScheduleUpdate,
    current_user = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update a class schedule (Admin only)"""
    
    # Get existing schedule
    query = select(ClassSchedule).options(
        selectinload(ClassSchedule.subject),
        selectinload(ClassSchedule.faculty)
    ).where(ClassSchedule.id == schedule_id)
    result = await db.execute(query)
    schedule = result.scalar_one_or_none()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule with ID {schedule_id} not found"
        )
    
    # Update fields
    update_data = schedule_data.dict(exclude_unset=True)
    
    # Handle time parsing if provided
    if 'start_time' in update_data:
        update_data['start_time'] = parse_time_string(update_data['start_time'])
    if 'end_time' in update_data:
        update_data['end_time'] = parse_time_string(update_data['end_time'])
    
    # Validate time logic if both times are being updated
    start_time = update_data.get('start_time', schedule.start_time)
    end_time = update_data.get('end_time', schedule.end_time)
    if start_time >= end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start time must be before end time"
        )
    
    # Apply updates
    for field, value in update_data.items():
        setattr(schedule, field, value)
    
    await db.commit()
    await db.refresh(schedule)
    
    return ScheduleResponse(
        id=schedule.id,
        subject_id=schedule.subject_id,
        subject_name=schedule.subject.name if schedule.subject else "Unknown",
        subject_code=schedule.subject.code if schedule.subject else "N/A",
        faculty_id=schedule.faculty_id,
        faculty_name=schedule.faculty.name if schedule.faculty else "Unknown",
        day_of_week=schedule.day_of_week.value,
        start_time=schedule.start_time.strftime("%H:%M"),
        end_time=schedule.end_time.strftime("%H:%M"),
        semester=schedule.semester,
        academic_year=schedule.academic_year,
        classroom=schedule.classroom,
        instructor_name=schedule.instructor_name,
        is_active=schedule.is_active,
        notes=schedule.notes,
        duration_minutes=schedule.duration_minutes,
        time_slot_display=schedule.time_slot_display
    )

@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    current_user = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete a class schedule (Admin only)"""
    
    query = select(ClassSchedule).where(ClassSchedule.id == schedule_id)
    result = await db.execute(query)
    schedule = result.scalar_one_or_none()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule with ID {schedule_id} not found"
        )
    
    await db.delete(schedule)
    await db.commit()
    
    return {"message": f"Schedule {schedule_id} deleted successfully"}

@router.post("/{schedule_id}/toggle")
async def toggle_schedule_status(
    schedule_id: int,
    current_user = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Toggle schedule active status (Admin only)"""
    
    query = select(ClassSchedule).where(ClassSchedule.id == schedule_id)
    result = await db.execute(query)
    schedule = result.scalar_one_or_none()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule with ID {schedule_id} not found"
        )
    
    schedule.is_active = not schedule.is_active
    await db.commit()
    
    status_text = "activated" if schedule.is_active else "deactivated"
    return {"message": f"Schedule {schedule_id} {status_text} successfully", "is_active": schedule.is_active}