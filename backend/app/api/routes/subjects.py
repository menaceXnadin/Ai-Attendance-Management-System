from fastapi import APIRouter, HTTPException, Depends, Request, status
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, Integer, text, func, delete as sa_delete
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from app.core.database import get_db, get_sync_db
from app.models import Subject, Faculty, AttendanceRecord, ClassSchedule, Mark, AcademicEvent
from app.schemas import SubjectCreate, Subject as SubjectSchema
from app.api.dependencies import get_current_user, require_admin_role, require_debug_admin

router = APIRouter(prefix="/subjects", tags=["subjects"])

@router.get("/debug-auth")
async def debug_auth_endpoint(current_user = Depends(require_debug_admin)):
    """Debug endpoint to confirm bearer auth works (admin + DEBUG only). Never echoes the token."""
    return {"message": "HTTPBearer working", "user_id": current_user.id}

@router.get("/debug-test")
async def debug_test_endpoint(request: Request, current_user = Depends(require_debug_admin)):
    """Debug endpoint (admin + DEBUG only). Never echoes request headers."""
    has_auth = request.headers.get('authorization') is not None
    return {"message": "Debug test successful", "auth_header": "<redacted>" if has_auth else None}

@router.get("/", response_model=List[SubjectSchema])
async def get_subjects(
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get subjects with optional filters for faculty and semester."""
    query = select(Subject)
    
    # Apply filters
    conditions = []
    if faculty_id:
        conditions.append(Subject.faculty_id == faculty_id)
    
    if conditions:
        query = query.where(*conditions)
    
    result = await db.execute(query)
    subjects = result.scalars().all()
    
    return subjects

@router.get("/by-faculty-semester")
async def get_subjects_by_faculty_semester(
    faculty_id: int,
    semester: Optional[int] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get subjects filtered by faculty and semester."""
    query = select(Subject).where(Subject.faculty_id == faculty_id)
    
    # Filter by semester if provided
    if semester is not None:
        query = query.where(text(f"class_schedule->>'semester' = '{semester}'"))
    
    result = await db.execute(query)
    subjects = result.scalars().all()
    
    # Return subjects with proper class_schedule data
    subjects_data = []
    for subject in subjects:
        class_schedule = subject.class_schedule or {}
        subjects_data.append({
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "description": subject.description,
            "credits": subject.credits,
            "faculty_id": subject.faculty_id,
            "class_schedule": class_schedule,
            "semester": class_schedule.get('semester') if class_schedule else None
        })
    
    return subjects_data

@router.get("/by-faculty")
async def get_subjects_by_faculty(
    faculty_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all subjects for a specific faculty."""
    query = select(Subject).where(Subject.faculty_id == faculty_id)
    
    result = await db.execute(query)
    subjects = result.scalars().all()
    
    return subjects

@router.post("/", response_model=SubjectSchema)
async def create_subject(
    subject: SubjectCreate,
    current_user = Depends(require_admin_role),
    db: AsyncSession = Depends(get_db)
):
    """Create a new subject."""
    # Check if subject code already exists
    existing_subject = await db.execute(
        select(Subject).where(Subject.code == subject.code)
    )
    if existing_subject.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Subject code already exists")
    
    # Check if faculty exists
    if subject.faculty_id:
        faculty_check = await db.execute(
            select(Faculty).where(Faculty.id == subject.faculty_id)
        )
        if not faculty_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Faculty not found")
    
    new_subject = Subject(
        name=subject.name,
        code=subject.code,
        description=subject.description,
        credits=subject.credits,
        faculty_id=getattr(subject, 'faculty_id', None),
        class_schedule=subject.class_schedule
    )
    
    db.add(new_subject)
    await db.commit()
    await db.refresh(new_subject)
    
    return new_subject

@router.get("/{subject_id}", response_model=SubjectSchema)
async def get_subject(
    subject_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific subject by ID."""
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    return subject

@router.delete("/{subject_id}")
async def delete_subject(
    subject_id: int,
    current_user = Depends(require_admin_role),
    db: AsyncSession = Depends(get_db)
):
    """Delete a subject (admin only).

    Refuses with 409 while attendance records, class schedules, marks or calendar
    events reference the subject: attendance/marks are history, and nulling an
    event's subject_id would turn a subject-specific cancellation into a
    whole-day one. Deactivate the schedules / move the data first.
    """
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    async def _count(model, column) -> int:
        res = await db.execute(select(func.count()).select_from(model).where(column == subject_id))
        return int(res.scalar() or 0)

    references = {
        "attendance_records": await _count(AttendanceRecord, AttendanceRecord.subject_id),
        "class_schedules": await _count(ClassSchedule, ClassSchedule.subject_id),
        "marks": await _count(Mark, Mark.subject_id),
        "academic_events": await _count(AcademicEvent, AcademicEvent.subject_id),
    }
    if any(references.values()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Cannot delete a subject that is still referenced",
                "references": references,
                "suggestion": "Deactivate its schedules instead; subjects with attendance history are kept.",
            },
        )

    try:
        # Core DELETE: no ORM cascades (they would delete marks / null event scopes).
        await db.execute(sa_delete(Subject).where(Subject.id == subject_id))
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Cannot delete a subject that is still referenced by other records"},
        )

    return {"message": "Subject deleted successfully"}
