from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, text
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime
from app.core.database import get_db
from app.models import Student, User, Faculty
from app.schemas import Student as StudentSchema, StudentCreate, StudentUpdate
from app.api.dependencies import get_current_admin, get_current_user

router = APIRouter(prefix="/students", tags=["students"])

@router.get("/")
async def get_all_students(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all students (admin and teachers can see all, students see only themselves)."""
    if (hasattr(current_user.role, 'value') and current_user.role.value == "admin") or current_user.role == "admin":
        # Admin can see all students
        result = await db.execute(
            select(Student).options(
                selectinload(Student.user),
                selectinload(Student.faculty_rel)
            ).offset(skip).limit(limit)
        )
    elif (hasattr(current_user.role, 'value') and current_user.role.value == "student") or current_user.role == "student":
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
                "semester": getattr(student, "semester", 1),
                "year": getattr(student, "year", 1),
                "batch": getattr(student, "batch", 2025),
                "phone_number": student.phone_number or "",
                "emergency_contact": student.emergency_contact or "",
                "profile_image_url": getattr(student, "profile_image_url", ""),
                "face_encoding": getattr(student, "face_encoding", []),
                "user": user_data
            }
            student_list.append(student_data)
            print(f"Added student to list: {student_data}")
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
        select(Student).options(selectinload(Student.user)).where(Student.id == student_id)
    )
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Check permissions
    if ((hasattr(current_user.role, 'value') and current_user.role.value == "student") or current_user.role == "student") and student.user_id != current_user.id:
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
        "face_encoding": getattr(student, "face_encoding", []),
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new student (admin only)."""
    print(f"[Backend] Received create student request: {student_data}")
    print(f"[Backend] Student data batch: {getattr(student_data, 'batch', 'NOT_FOUND')}")
    print(f"[Backend] Student data semester: {getattr(student_data, 'semester', 'NOT_FOUND')}")
    print(f"[Backend] Student data year: {getattr(student_data, 'year', 'NOT_FOUND')}")
    
    # Check if user is admin
    if current_user.role != "admin":
        print(f"[Backend] Unauthorized create attempt by user: {current_user.email}")
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
    
    # Check if student ID already exists
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
        user = User(
            email=student_data.user.email,
            full_name=student_data.user.full_name,
            hashed_password=get_password_hash(student_data.user.password),
            role="student"
        )
        db.add(user)
        await db.flush()  # Get the user ID
        print(f"[Backend] Created user with ID: {user.id}")
        
        # Create student profile
        student = Student(
            user_id=user.id,
            student_id=student_data.student_id,
            faculty_id=student_data.faculty_id,  # Use faculty_id instead of faculty
            semester=student_data.semester or 1,  # Add semester field
            year=student_data.year or 1,           # Keep year field
            batch=student_data.batch or datetime.now().year,  # Add batch field with current year default
            phone_number=student_data.phone_number,
            emergency_contact=student_data.emergency_contact
        )
        db.add(student)
        await db.commit()
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
    """Update a student."""
    print(f"[Backend] Received update request for student ID: {student_id}")
    print(f"[Backend] Update data: {student_data}")
    print(f"[Backend] Current user: {current_user.email} (role: {current_user.role})")
    
    result = await db.execute(
        select(Student).options(selectinload(Student.user)).where(Student.id == student_id)
    )
    student = result.scalar_one_or_none()
    
    if not student:
        print(f"[Backend] Student with ID {student_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    print(f"[Backend] Found student: {student.student_id} - {student.user.full_name if student.user else 'No user'}")
    
    # Check permissions
    if current_user.role == "student" and student.user_id != current_user.id:
        print(f"[Backend] Permission denied: student can only update their own profile")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Update student fields
    student_fields = ['faculty', 'semester', 'year', 'batch', 'phone_number', 'emergency_contact', 'student_id']
    updated_fields = []
    for field in student_fields:
        if field in student_data:
            old_value = getattr(student, field)
            new_value = student_data[field]
            setattr(student, field, new_value)
            updated_fields.append(f"{field}: {old_value} -> {new_value}")
            print(f"[Backend] Updated {field}: {old_value} -> {new_value}")
    
    # Update user fields if provided and user has permissions
    if current_user.role == "admin":
        user = student.user
        if user:
            user_fields = ['full_name', 'email']
            for field in user_fields:
                if field in student_data:
                    old_value = getattr(user, field)
                    new_value = student_data[field]
                    setattr(user, field, new_value)
                    updated_fields.append(f"user.{field}: {old_value} -> {new_value}")
                    print(f"[Backend] Updated user.{field}: {old_value} -> {new_value}")
    
    print(f"[Backend] Fields updated: {updated_fields}")
    
    try:
        await db.commit()
        await db.refresh(student)
        print(f"[Backend] Student update committed successfully")
    except Exception as e:
        print(f"[Backend] Error committing update: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update student: {str(e)}"
        )
    
    return {
        "id": student.id,
        "name": student.user.full_name if student.user else "Unknown",
        "email": student.user.email if student.user else "unknown@example.com",
        "student_id": student.student_id,
        "faculty": student.faculty,
        "semester": student.semester,
        "year": student.year,
        "batch": student.batch,
        "phone_number": student.phone_number,
        "emergency_contact": student.emergency_contact,
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a student (admin only)."""
    print(f"[Backend] Received delete request for student ID: {student_id}")

    # Check if user is admin
    if (hasattr(current_user.role, 'value') and current_user.role.value != "admin") and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    try:
        # Simple approach: Delete student by ID without any relationships
        # This avoids issues with missing tables
        await db.execute(
            text("DELETE FROM students WHERE id = :student_id"),
            {"student_id": student_id}
        )
        
        print(f"[Backend] Student {student_id} deleted, committing transaction")
        await db.commit()
        
        return {"message": f"Student with ID {student_id} deleted successfully"}
    
    except Exception as e:
        print(f"[Backend] Error during deletion: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete student: {str(e)}"
        )
