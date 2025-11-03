"""
Teacher Management API Routes
Handles teacher registration, profile management, and listing.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models import User, Teacher, UserRole, Faculty, ClassSchedule, Subject, Student
from app.schemas import TeacherCreate, Teacher as TeacherSchema, TeacherUpdate, TeacherAssignmentResponse, TeacherAssignmentCreate
from app.utils.teacher_id_generator import generate_teacher_id
from app.api.dependencies import get_current_user, require_admin_role

router = APIRouter(prefix="/teachers", tags=["Teachers"])


@router.post("/", response_model=TeacherSchema, status_code=status.HTTP_201_CREATED)
async def create_teacher(
    teacher_data: TeacherCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """
    Create a new teacher account (Admin only).
    Race condition protection: Uses retry mechanism for concurrent teacher creation.
    """
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == teacher_data.user.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # If teacher_id was provided manually, ensure it is unique
    if teacher_data.teacher_id:
        result = await db.execute(select(Teacher).where(Teacher.teacher_id == teacher_data.teacher_id))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Teacher ID already exists"
            )
    
    # Verify faculty exists if provided
    if teacher_data.faculty_id:
        result = await db.execute(select(Faculty).where(Faculty.id == teacher_data.faculty_id))
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Faculty not found"
            )
    
    # Retry logic for handling concurrent teacher creation
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Create user
            user = User(
                email=teacher_data.user.email,
                full_name=teacher_data.user.full_name,
                hashed_password=get_password_hash(teacher_data.user.password),
                role=UserRole.faculty,
                is_active=True
            )
            db.add(user)
            await db.flush()
            
            # Determine teacher_id (auto-generate if not provided)
            new_teacher_id = teacher_data.teacher_id or await generate_teacher_id(db, teacher_data.faculty_id)

            # Create teacher profile
            teacher = Teacher(
                user_id=user.id,
                teacher_id=new_teacher_id,
                name=teacher_data.name,
                faculty_id=teacher_data.faculty_id,
                department=teacher_data.department,
                phone_number=teacher_data.phone_number,
                office_location=teacher_data.office_location
            )
            db.add(teacher)
            await db.commit()
            await db.refresh(teacher)
            
            # Eagerly load user relationship to avoid lazy-loading issues
            result = await db.execute(
                select(Teacher).options(selectinload(Teacher.user)).where(Teacher.id == teacher.id)
            )
            teacher = result.scalar_one()
            
            return teacher
            
        except Exception as e:
            await db.rollback()
            
            # Check if it's a unique constraint violation on teacher_id
            error_msg = str(e).lower()
            if "unique" in error_msg and "teacher_id" in error_msg and attempt < max_retries - 1:
                # Retry with a new ID
                import logging
                logging.warning(f"Teacher ID collision detected, retrying... (attempt {attempt + 1})")
                continue
            else:
                # Re-raise if it's not a teacher_id collision or we're out of retries
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to create teacher: {str(e)}"
                )
    
    # If we exhausted all retries
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to create teacher after multiple attempts due to high concurrent load"
    )


@router.get("/", response_model=List[TeacherSchema])
async def list_teachers(
    skip: int = 0,
    limit: int = 100,
    faculty_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all teachers. Can filter by faculty_id.
    """
    query = select(Teacher).options(selectinload(Teacher.user))
    
    if faculty_id:
        query = query.where(Teacher.faculty_id == faculty_id)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    teachers = result.scalars().all()
    
    return teachers


@router.get("/me", response_model=TeacherSchema)
async def get_current_teacher(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current teacher's profile.
    """
    current_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if current_role != "faculty":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a teacher account"
        )
    
    result = await db.execute(
        select(Teacher).options(selectinload(Teacher.user)).where(Teacher.user_id == current_user.id)
    )
    teacher = result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher profile not found"
        )
    
    return teacher


@router.get("/{teacher_id}", response_model=TeacherSchema)
async def get_teacher(
    teacher_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific teacher by ID.
    """
    result = await db.execute(
        select(Teacher).options(selectinload(Teacher.user)).where(Teacher.id == teacher_id)
    )
    teacher = result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found"
        )
    
    return teacher


@router.put("/me", response_model=TeacherSchema)
async def update_current_teacher(
    teacher_update: TeacherUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update current teacher's profile.
    """
    current_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if current_role != "faculty":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a teacher account"
        )
    
    result = await db.execute(
        select(Teacher).options(selectinload(Teacher.user)).where(Teacher.user_id == current_user.id)
    )
    teacher = result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher profile not found"
        )
    
    # Verify faculty exists if updating
    if teacher_update.faculty_id:
        result = await db.execute(select(Faculty).where(Faculty.id == teacher_update.faculty_id))
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Faculty not found"
            )
    
    # Update fields
    update_data = teacher_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(teacher, field, value)
    
    await db.commit()
    
    # Re-fetch with eager loading
    result = await db.execute(
        select(Teacher).options(selectinload(Teacher.user)).where(Teacher.id == teacher.id)
    )
    teacher = result.scalar_one()
    
    return teacher


@router.put("/{teacher_id}", response_model=TeacherSchema)
async def update_teacher(
    teacher_id: int,
    teacher_update: TeacherUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """
    Update a teacher's profile (Admin only).
    """
    result = await db.execute(
        select(Teacher).options(selectinload(Teacher.user)).where(Teacher.id == teacher_id)
    )
    teacher = result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found"
        )
    
    # Verify faculty exists if updating
    if teacher_update.faculty_id:
        result = await db.execute(select(Faculty).where(Faculty.id == teacher_update.faculty_id))
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Faculty not found"
            )
    
    # Update fields
    update_data = teacher_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(teacher, field, value)
    
    await db.commit()
    
    # Re-fetch with eager loading
    result = await db.execute(
        select(Teacher).options(selectinload(Teacher.user)).where(Teacher.id == teacher.id)
    )
    teacher = result.scalar_one()
    
    return teacher


@router.delete("/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_teacher(
    teacher_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """
    Delete a teacher account (Admin only).
    This will cascade delete the teacher profile and associated user.
    """
    result = await db.execute(select(Teacher).where(Teacher.id == teacher_id))
    teacher = result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found"
        )
    
    # Delete the user (will cascade to teacher profile)
    user_result = await db.execute(select(User).where(User.id == teacher.user_id))
    user = user_result.scalar_one_or_none()
    
    if user:
        await db.delete(user)
        await db.commit()
    
    return None


@router.get("/stats/count")
async def get_teacher_count(
    faculty_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """
    Get teacher count, optionally filtered by faculty (Admin only).
    """
    query = select(func.count(Teacher.id))
    
    if faculty_id:
        query = query.where(Teacher.faculty_id == faculty_id)
    
    result = await db.execute(query)
    count = result.scalar_one()
    
    return {"total_teachers": count, "faculty_id": faculty_id}


@router.get("/{teacher_id}/assignments", response_model=List[TeacherAssignmentResponse])
async def get_teacher_assignments(
    teacher_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """
    Get all subject assignments for a teacher (Admin only).
    Returns ClassSchedule entries where this teacher is assigned.
    """
    result = await db.execute(
        select(Teacher).where(Teacher.id == teacher_id)
    )
    teacher = result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found"
        )
    
    # Get all ClassSchedules assigned to this teacher
    schedules_query = select(ClassSchedule).options(
        selectinload(ClassSchedule.subject),
        selectinload(ClassSchedule.faculty)
    ).where(
        ClassSchedule.teacher_id == teacher_id
    ).order_by(
        ClassSchedule.day_of_week,
        ClassSchedule.start_time
    )
    
    schedules_result = await db.execute(schedules_query)
    schedules = schedules_result.scalars().all()
    
    # Build response with student counts
    assignments = []
    for schedule in schedules:
        # Count students in this faculty/semester
        student_count_query = select(func.count(Student.id)).where(
            Student.faculty_id == schedule.faculty_id,
            Student.semester == schedule.semester
        )
        student_count_result = await db.execute(student_count_query)
        student_count = student_count_result.scalar_one()
        
        assignments.append(TeacherAssignmentResponse(
            id=schedule.id,
            subject_id=schedule.subject_id,
            subject_name=schedule.subject.name if schedule.subject else "Unknown",
            subject_code=schedule.subject.code if schedule.subject else "N/A",
            faculty_id=schedule.faculty_id,
            faculty_name=schedule.faculty.name if schedule.faculty else "Unknown",
            semester=schedule.semester,
            day_of_week=schedule.day_of_week.value,
            start_time=schedule.start_time.strftime("%H:%M"),
            end_time=schedule.end_time.strftime("%H:%M"),
            classroom=schedule.classroom,
            academic_year=schedule.academic_year,
            student_count=student_count,
            time_slot_display=schedule.time_slot_display
        ))
    
    return assignments


@router.post("/{teacher_id}/assignments", response_model=TeacherAssignmentResponse)
async def assign_teacher_to_subject(
    teacher_id: int,
    assignment_data: TeacherAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """
    Assign teacher to a subject by updating ClassSchedule.teacher_id (Admin only).
    """
    # Verify teacher exists
    teacher_result = await db.execute(
        select(Teacher).where(Teacher.id == teacher_id)
    )
    teacher = teacher_result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found"
        )
    
    # Get the schedule
    schedule_result = await db.execute(
        select(ClassSchedule).options(
            selectinload(ClassSchedule.subject),
            selectinload(ClassSchedule.faculty)
        ).where(ClassSchedule.id == assignment_data.schedule_id)
    )
    schedule = schedule_result.scalar_one_or_none()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class schedule not found"
        )
    
    # Check if already assigned to another teacher
    if schedule.teacher_id and schedule.teacher_id != teacher_id:
        # Get the current teacher's name
        current_teacher_result = await db.execute(
            select(Teacher).where(Teacher.id == schedule.teacher_id)
        )
        current_teacher = current_teacher_result.scalar_one_or_none()
        teacher_name = current_teacher.name if current_teacher else "Another teacher"
        
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This class is already assigned to {teacher_name}. Please unassign them first."
        )
    
    # Assign teacher to schedule
    schedule.teacher_id = teacher_id
    await db.commit()
    await db.refresh(schedule)
    
    # Count students
    student_count_query = select(func.count(Student.id)).where(
        Student.faculty_id == schedule.faculty_id,
        Student.semester == schedule.semester
    )
    student_count_result = await db.execute(student_count_query)
    student_count = student_count_result.scalar_one()
    
    return TeacherAssignmentResponse(
        id=schedule.id,
        subject_id=schedule.subject_id,
        subject_name=schedule.subject.name if schedule.subject else "Unknown",
        subject_code=schedule.subject.code if schedule.subject else "N/A",
        faculty_id=schedule.faculty_id,
        faculty_name=schedule.faculty.name if schedule.faculty else "Unknown",
        semester=schedule.semester,
        day_of_week=schedule.day_of_week.value,
        start_time=schedule.start_time.strftime("%H:%M"),
        end_time=schedule.end_time.strftime("%H:%M"),
        classroom=schedule.classroom,
        academic_year=schedule.academic_year,
        student_count=student_count,
        time_slot_display=schedule.time_slot_display
    )


@router.delete("/{teacher_id}/assignments/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_teacher_assignment(
    teacher_id: int,
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """
    Remove teacher from a subject assignment by setting ClassSchedule.teacher_id = NULL (Admin only).
    """
    # Verify teacher exists
    teacher_result = await db.execute(
        select(Teacher).where(Teacher.id == teacher_id)
    )
    teacher = teacher_result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found"
        )
    
    # Get the schedule
    schedule_result = await db.execute(
        select(ClassSchedule).where(ClassSchedule.id == schedule_id)
    )
    schedule = schedule_result.scalar_one_or_none()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class schedule not found"
        )
    
    # Verify this teacher is assigned to this schedule
    if schedule.teacher_id != teacher_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This teacher is not assigned to this class schedule"
        )
    
    # Unassign teacher
    schedule.teacher_id = None
    await db.commit()
    
    return None


@router.get("/schedules/unassigned", response_model=List[TeacherAssignmentResponse])
async def get_unassigned_schedules(
    faculty_id: int = None,
    semester: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """
    Get class schedules that don't have a teacher assigned yet (Admin only).
    Useful for the "Add Assignment" dialog.
    """
    query = select(ClassSchedule).options(
        selectinload(ClassSchedule.subject),
        selectinload(ClassSchedule.faculty)
    ).where(
        ClassSchedule.teacher_id.is_(None),
        ClassSchedule.is_active == True
    )
    
    if faculty_id:
        query = query.where(ClassSchedule.faculty_id == faculty_id)
    if semester:
        query = query.where(ClassSchedule.semester == semester)
    
    query = query.order_by(
        ClassSchedule.faculty_id,
        ClassSchedule.semester,
        ClassSchedule.day_of_week,
        ClassSchedule.start_time
    )
    
    result = await db.execute(query)
    schedules = result.scalars().all()
    
    # Build response
    unassigned = []
    for schedule in schedules:
        # Count students
        student_count_query = select(func.count(Student.id)).where(
            Student.faculty_id == schedule.faculty_id,
            Student.semester == schedule.semester
        )
        student_count_result = await db.execute(student_count_query)
        student_count = student_count_result.scalar_one()
        
        unassigned.append(TeacherAssignmentResponse(
            id=schedule.id,
            subject_id=schedule.subject_id,
            subject_name=schedule.subject.name if schedule.subject else "Unknown",
            subject_code=schedule.subject.code if schedule.subject else "N/A",
            faculty_id=schedule.faculty_id,
            faculty_name=schedule.faculty.name if schedule.faculty else "Unknown",
            semester=schedule.semester,
            day_of_week=schedule.day_of_week.value,
            start_time=schedule.start_time.strftime("%H:%M"),
            end_time=schedule.end_time.strftime("%H:%M"),
            classroom=schedule.classroom,
            academic_year=schedule.academic_year,
            student_count=student_count,
            time_slot_display=schedule.time_slot_display
        ))
    
    return unassigned
