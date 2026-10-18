from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, text, func, delete as sa_delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import date, datetime
from app.core.clock import app_today
from app.core.database import get_db
from app.models import Student, User, Faculty, AttendanceRecord
from app.schemas import Student as StudentSchema, StudentCreate, StudentUpdate
from app.api.dependencies import get_current_admin, get_current_user, require_admin_role, has_role
from app.services import face_enrollment, face_store
from app.services.domain_errors import DomainError
from app.utils import generate_student_id

router = APIRouter(prefix="/students", tags=["students"])

@router.get("/")
async def get_all_students(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all students (admin and teachers can see all, students see only themselves)."""
    if has_role(current_user, "admin"):
        # Admin can see all students
        result = await db.execute(
            select(Student).options(
                selectinload(Student.user),
                selectinload(Student.faculty_rel)
            ).offset(skip).limit(limit)
        )
    elif has_role(current_user, "student"):
        # Students can only see themselves
        result = await db.execute(
            select(Student).options(
                selectinload(Student.user),
                selectinload(Student.faculty_rel)
            ).where(Student.user_id == current_user.id)
        )
    else:
        # Teachers can see all students (you might want to restrict this)
        result = await db.execute(
            select(Student).options(
                selectinload(Student.user),
                selectinload(Student.faculty_rel)
            ).offset(skip).limit(limit)
        )
    
    students = result.scalars().all()
    
    # Convert to simple dict format to avoid serialization issues
    student_list = []
    for student in students:
        try:
            user_data = None
            if student.user:
                user_data = {
                    "id": student.user.id,
                    "email": student.user.email,
                    "full_name": student.user.full_name,
                    "role": student.user.role.value if hasattr(student.user.role, 'value') else student.user.role,
                    "is_active": student.user.is_active
                }
            
            print(f"[DEBUG] Processing student {student.student_id}")
            faculty_name = "Unknown Faculty"
            if student.faculty_rel:
                faculty_name = student.faculty_rel.name
            elif hasattr(student, 'faculty') and student.faculty:
                # Fallback for old string-based faculty
                faculty_name = student.faculty
                
            student_data = {
                "id": student.id,
                "name": student.user.full_name if student.user else "Unknown",
                "email": student.user.email if student.user else "unknown@example.com",
                "student_id": student.student_id,
                "faculty": faculty_name,
                "faculty_id": student.faculty_id,  # Add faculty_id for filtering
                "semester": getattr(student, "semester", 1),
                "year": getattr(student, "year", 1),
                "batch": getattr(student, "batch", 2025),
                "phone_number": student.phone_number or "",
                "emergency_contact": student.emergency_contact or "",
                "profile_image_url": getattr(student, "profile_image_url", ""),
                **face_store.face_fields(student),  # face_encoding is always None (§8)
                "user": user_data
            }
            student_list.append(student_data)
        except Exception as e:
            print(f"Error processing student {getattr(student, 'id', 'unknown')}: {str(e)}")
    
    print(f"Returning {len(student_list)} students")
    return student_list

@router.get("/{student_id}")
async def get_student(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific student by ID."""
    result = await db.execute(
        select(Student).options(
            selectinload(Student.user),
            selectinload(Student.faculty_rel)  # Eagerly load faculty
        ).where(Student.id == student_id)
    )
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Check permissions
    if has_role(current_user, "student") and student.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    return {
        "id": student.id,
        "student_id": student.student_id,
        "faculty": student.faculty_rel.name if student.faculty_rel else (student.faculty if hasattr(student, 'faculty') else "Unknown Faculty"),
        "year": student.year,
        "phone_number": student.phone_number,
        "emergency_contact": student.emergency_contact,
        "enrolled_on": student.enrolled_on.isoformat() if student.enrolled_on else None,
        "cohort_since": student.cohort_since.isoformat() if student.cohort_since else None,
        **face_store.face_fields(student),  # face_encoding is always None (§8)
        "user": {
            "id": student.user.id,
            "email": student.user.email,
            "full_name": student.user.full_name,
            "role": student.user.role.value if hasattr(student.user.role, 'value') else student.user.role,
            "is_active": student.user.is_active
        } if student.user else None
    }

@router.post("/")
async def create_student(
    student_data: StudentCreate,
    current_user: User = Depends(require_admin_role),
    db: AsyncSession = Depends(get_db)
):
    """Create a new student (admin only)."""
    print(f"[Backend] Student data batch: {getattr(student_data, 'batch', 'NOT_FOUND')}")
    print(f"[Backend] Student data semester: {getattr(student_data, 'semester', 'NOT_FOUND')}")
    print(f"[Backend] Student data year: {getattr(student_data, 'year', 'NOT_FOUND')}")
    
    # Admin only
    if not has_role(current_user, "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == student_data.user.email))
    if result.scalar_one_or_none():
        print(f"[Backend] Email already exists: {student_data.user.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Auto-generate student ID if not provided
    if not student_data.student_id:
        try:
            generated_id = await generate_student_id(student_data.faculty_id, db)
            student_data.student_id = generated_id
            print(f"[Backend] Auto-generated student ID: {generated_id}")
        except Exception as e:
            print(f"[Backend] Error generating student ID: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate student ID: {str(e)}"
            )
    else:
        # Check if manually provided student ID already exists
        result = await db.execute(select(Student).where(Student.student_id == student_data.student_id))
        if result.scalar_one_or_none():
            print(f"[Backend] Student ID already exists: {student_data.student_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student ID already exists"
            )
    
    try:
        # Create user first
        from app.core.security import get_password_hash
        print(f"[Backend] Creating user: {student_data.user.full_name} ({student_data.user.email})")
        user = User(
            email=student_data.user.email,
            full_name=student_data.user.full_name,
            hashed_password=get_password_hash(student_data.user.password),
            role="student"
        )
        db.add(user)
        await db.flush()  # Get the user ID
        print(f"[Backend] Created user with ID: {user.id}, Name: {user.full_name}")
        
        # Get faculty information - faculty_id is required
        if not student_data.faculty_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Faculty selection is required"
            )
            
        faculty_result = await db.execute(select(Faculty).where(Faculty.id == student_data.faculty_id))
        faculty = faculty_result.scalar_one_or_none()
        if not faculty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Faculty with ID {student_data.faculty_id} not found"
            )
        
        faculty_name = faculty.name
        print(f"[Backend] Selected faculty: {faculty_name} (ID: {student_data.faculty_id})")
        
        # Create student profile
        print(f"[Backend] Creating student profile: ID={student_data.student_id}, Faculty={faculty_name} (ID: {student_data.faculty_id})")
        student = Student(
            user_id=user.id,
            student_id=student_data.student_id,
            faculty=faculty_name,  # Set faculty name (required field)
            faculty_id=student_data.faculty_id,  # Set faculty_id (foreign key)
            semester=student_data.semester or 1,  # Add semester field
            year=student_data.year or 1,           # Keep year field
            batch=student_data.batch or datetime.now().year,  # Add batch field with current year default
            phone_number=student_data.phone_number,
            emergency_contact=student_data.emergency_contact
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)
        print(f"[Backend] Created student with ID: {student.id}, Faculty: {student.faculty}, Faculty_ID: {student.faculty_id}")
        await db.refresh(student)
        print(f"[Backend] Created student with ID: {student.id}")
        
        # Reload the student with faculty relationship
        await db.refresh(student, ["user", "faculty_rel"])
        
        response_data = {
            "id": student.id,
            "student_id": student.student_id,
            "faculty": student.faculty_rel.name if student.faculty_rel else "Unknown Faculty",
            "year": student.year,
            "phone_number": student.phone_number or "",
            "emergency_contact": student.emergency_contact or "",
            **face_store.face_fields(student),
            "user": {
                "id": student.user.id,
                "email": student.user.email,
                "full_name": student.user.full_name,
                "role": student.user.role.value if hasattr(student.user.role, 'value') else student.user.role,
                "is_active": student.user.is_active
            }
        }
        print(f"[Backend] Returning student data: {response_data}")
        return response_data
    except Exception as e:
        print(f"[Backend] Error creating student: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create student: {str(e)}"
        )

@router.put("/{student_id}")
async def update_student(
    student_id: int,
    student_data: dict,  # Changed from StudentUpdate to dict for more flexibility
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a student.

    - Admin: any field, with validation (semester 1-8, year 1-4, batch 2000-2100,
      existing faculty, unique student_id / email).
    - Student: own profile only, contact fields only (phone_number,
      emergency_contact, profile_image_url). Sending a protected field with a
      *different* value is rejected with 403; unchanged values are ignored.
    - Teachers and anyone else: 403.
    """
    is_admin = has_role(current_user, "admin")
    is_student = has_role(current_user, "student")
    if not (is_admin or is_student):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    if not isinstance(student_data, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid update payload")

    result = await db.execute(
        select(Student).options(selectinload(Student.user)).where(Student.id == student_id)
    )
    student = result.scalar_one_or_none()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )

    if is_student and student.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    contact_fields = ['phone_number', 'emergency_contact', 'profile_image_url']
    admin_student_fields = ['faculty_id', 'semester', 'year', 'batch', 'student_id']
    admin_user_fields = ['full_name', 'email']

    if is_student:
        # Reject attempts to change protected fields; ignore unchanged echoes.
        user = student.user
        current_values = {
            'faculty_id': student.faculty_id,
            'faculty': student.faculty,
            'semester': student.semester,
            'year': student.year,
            'batch': student.batch,
            'student_id': student.student_id,
            'enrolled_on': getattr(student, 'enrolled_on', None),
            'full_name': user.full_name if user else None,
            'email': user.email if user else None,
            'role': 'student',
            'is_active': user.is_active if user else None,
        }
        changed = []
        for field, value in student_data.items():
            if field in contact_fields or field in ('id', 'user', 'name', 'user_id'):
                continue
            if field in current_values:
                current = current_values[field]
                if value not in (None, "") and str(value) != str(current):
                    changed.append(field)
        if changed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "Students may only update their contact details",
                    "forbidden_fields": sorted(changed),
                }
            )
        for field in contact_fields:
            if field in student_data:
                setattr(student, field, student_data[field])
    else:
        # ---- Admin: validate first, then apply ----
        def as_int(field, lo, hi):
            value = student_data.get(field)
            if value is None or value == "":
                return None
            try:
                ivalue = int(value)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail=f"{field} must be an integer")
            if not (lo <= ivalue <= hi):
                raise HTTPException(status_code=400, detail=f"{field} must be between {lo} and {hi}")
            return ivalue

        semester = as_int('semester', 1, 8)
        year = as_int('year', 1, 4)
        batch = as_int('batch', 2000, 2100)

        faculty = None
        faculty_id = student_data.get('faculty_id')
        if faculty_id not in (None, ""):
            try:
                faculty_id = int(faculty_id)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="faculty_id must be an integer")
            faculty = (await db.execute(select(Faculty).where(Faculty.id == faculty_id))).scalar_one_or_none()
            if not faculty:
                raise HTTPException(status_code=400, detail=f"Faculty with ID {faculty_id} not found")
        else:
            faculty_id = None

        new_student_number = student_data.get('student_id')
        if new_student_number not in (None, "") and str(new_student_number) != student.student_id:
            dup = (await db.execute(
                select(Student.id).where(Student.student_id == str(new_student_number), Student.id != student.id).limit(1)
            )).scalar_one_or_none()
            if dup is not None:
                raise HTTPException(status_code=400, detail="Student ID already exists")
        else:
            new_student_number = None

        new_email = student_data.get('email')
        if new_email not in (None, "") and student.user and new_email != student.user.email:
            dup = (await db.execute(
                select(User.id).where(User.email == new_email, User.id != student.user_id).limit(1)
            )).scalar_one_or_none()
            if dup is not None:
                raise HTTPException(status_code=400, detail="Email already registered")
        else:
            new_email = None

        # enrolled_on (admin only; null/"" clears it -> roster/metrics fall back to created_at)
        if 'enrolled_on' in student_data:
            raw_enrolled = student_data.get('enrolled_on')
            if raw_enrolled in (None, ""):
                student.enrolled_on = None
            else:
                try:
                    enrolled_on = raw_enrolled if isinstance(raw_enrolled, date) else date.fromisoformat(str(raw_enrolled)[:10])
                except ValueError:
                    raise HTTPException(status_code=400, detail="enrolled_on must be a date (YYYY-MM-DD)")
                if not (2000 <= enrolled_on.year <= 2100):
                    raise HTTPException(status_code=400, detail="enrolled_on must be between 2000 and 2100")
                student.enrolled_on = enrolled_on

        # Rule §13.7: a cohort change (faculty or semester) restarts the roster window today.
        cohort_changed = (
            (semester is not None and semester != student.semester)
            or (faculty is not None and faculty.id != student.faculty_id)
        )
        if cohort_changed:
            student.cohort_since = app_today()

        if semester is not None:
            student.semester = semester
        if year is not None:
            student.year = year
        if batch is not None:
            student.batch = batch
        if faculty is not None:
            student.faculty_id = faculty.id
            student.faculty = faculty.name  # keep the legacy name column in sync
        if new_student_number is not None:
            student.student_id = str(new_student_number)
        for field in contact_fields:
            if field in student_data:
                setattr(student, field, student_data[field])

        user = student.user
        if user:
            if new_email is not None:
                user.email = new_email
            full_name = student_data.get('full_name')
            if full_name not in (None, ""):
                user.full_name = full_name

    try:
        await db.commit()
        await db.refresh(student)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update student: {str(e)}"
        )

    await db.refresh(student, ["user"])
    return {
        "id": student.id,
        "name": student.user.full_name if student.user else "Unknown",
        "email": student.user.email if student.user else "unknown@example.com",
        "student_id": student.student_id,
        "faculty": student.faculty,
        "semester": student.semester,
        "year": student.year,
        "batch": student.batch,
        "faculty_id": student.faculty_id,
        "enrolled_on": student.enrolled_on.isoformat() if student.enrolled_on else None,
        "cohort_since": student.cohort_since.isoformat() if student.cohort_since else None,
        "phone_number": student.phone_number,
        "emergency_contact": student.emergency_contact,
        **face_store.face_fields(student),
        "user": {
            "id": student.user.id,
            "email": student.user.email,
            "full_name": student.user.full_name,
            "role": student.user.role,
            "is_active": student.user.is_active
        } if student.user else None
    }

@router.delete("/{student_id}")
async def delete_student(
    student_id: int,
    hard: bool = False,
    current_user: User = Depends(require_admin_role),
    db: AsyncSession = Depends(get_db)
):
    """Remove a student (admin only).

    Default: deactivate the student's login (users.is_active = false). Attendance
    history and the profile are kept.
    hard=true: permanently delete the student and their user account, allowed only
    when the student has no attendance records (409 otherwise).
    """
    student = (await db.execute(select(Student).where(Student.id == student_id))).scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    user_id = student.user_id

    if not hard:
        user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if user is not None:
            user.is_active = False
        await db.commit()
        return {
            "message": f"Student with ID {student_id} deactivated successfully",
            "deactivated": True,
            "deleted": False,
        }

    attendance_count = (await db.execute(
        select(func.count(AttendanceRecord.id)).where(AttendanceRecord.student_id == student_id)
    )).scalar() or 0
    if attendance_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Student has attendance history and cannot be permanently deleted; deactivate instead",
                "attendance_records": int(attendance_count),
            }
        )

    try:
        # Core DELETEs: no ORM cascades. Any other referencing row (marks, event
        # attendance, ...) makes the DB refuse, which we report as 409.
        await db.execute(sa_delete(Student).where(Student.id == student_id))
        await db.execute(sa_delete(User).where(User.id == user_id))
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Student is referenced by other records and cannot be permanently deleted; deactivate instead"}
        )

    return {
        "message": f"Student with ID {student_id} deleted successfully",
        "deactivated": False,
        "deleted": True,
    }


# ------------------------------------------------------------------- face (§8)

class FaceResetRequest(BaseModel):
    reason: Optional[str] = None


async def _student_or_404(db: AsyncSession, student_id: int) -> Student:
    student = (await db.execute(select(Student).where(Student.id == student_id))).scalars().first()
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return student


@router.post("/{student_id}/face/reset")
async def reset_student_face(
    student_id: int,
    body: Optional[FaceResetRequest] = None,
    current_user: User = Depends(require_admin_role),
    db: AsyncSession = Depends(get_db)
):
    """Admin: delete the student's face templates so they can enrol again (docs/system/face-verification.md §8).

    Body ``{reason}`` (required, at least 3 characters) -> 400 ``reason_required`` otherwise.
    """
    student = await _student_or_404(db, student_id)
    try:
        result = await face_enrollment.admin_reset_face(
            db, student=student, actor=current_user, reason=body.reason if body else None)
        await db.commit()
        return result
    except DomainError as err:
        await db.rollback()
        raise err.to_http_exception()
    except Exception:
        await db.rollback()
        raise


@router.get("/{student_id}/face")
async def get_student_face(
    student_id: int,
    current_user: User = Depends(require_admin_role),
    db: AsyncSession = Depends(get_db)
):
    """Admin: the student's face enrolment status, templates (count, poses) and last 50 events."""
    student = await _student_or_404(db, student_id)
    return await face_enrollment.admin_face_info(db, student)
