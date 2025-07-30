from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from app.core.database import get_db
from app.models import Subject
from app.api.dependencies import get_current_user, get_current_admin

router = APIRouter(prefix="/classes", tags=["classes"])

@router.get("")
async def get_all_classes(
    skip: int = 0,
    limit: int = 100,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all classes."""
    result = await db.execute(
        select(Subject).options(selectinload(Subject.faculty)).offset(skip).limit(limit)
    )
    subjects = result.scalars().all()
    
    # Transform to match frontend expectations - return simple dict
    class_list = []
    for subject in subjects:
        class_list.append({
            "id": subject.id,
            "name": subject.name,
            "teacherId": "1",
            "subject": subject.name,
            "code": subject.code,
            "description": subject.description or "",
            "credits": subject.credits,
            "faculty_id": subject.faculty_id,
            "faculty_name": subject.faculty.name if subject.faculty else None
        })
    
    return class_list

@router.get("/{class_id}")
async def get_class(
    class_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific class by ID."""
    result = await db.execute(
        select(Subject).options(selectinload(Subject.faculty)).where(Subject.id == class_id)
    )
    subject = result.scalar_one_or_none()
    
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    return {
        "id": subject.id,
        "name": subject.name,
        "teacherId": "1",
        "subject": subject.name,
        "code": subject.code,
        "description": subject.description or "",
        "credits": subject.credits,
        "faculty_id": subject.faculty_id,
        "faculty_name": subject.faculty.name if subject.faculty else None
    }

@router.post("")
async def create_class(
    class_data: dict,
    current_admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new class (admin only)."""
    # Generate a simple code if not provided
    import random
    code = class_data.get("code", f"SUBJ{random.randint(100, 999)}")
    
    new_subject = Subject(
        name=class_data.get("name", ""),
        code=code,
        description=class_data.get("description", ""),
        credits=class_data.get("credits", 3),
        faculty_id=class_data.get("faculty_id")
    )
    
    db.add(new_subject)
    await db.commit()
    await db.refresh(new_subject)
    
    # Load faculty relationship for response
    result = await db.execute(
        select(Subject).options(selectinload(Subject.faculty)).where(Subject.id == new_subject.id)
    )
    subject_with_faculty = result.scalar_one()
    
    return {
        "id": str(subject_with_faculty.id),
        "name": subject_with_faculty.name,
        "teacherId": "1",
        "subject": subject_with_faculty.name,
        "code": subject_with_faculty.code,
        "description": subject_with_faculty.description,
        "credits": subject_with_faculty.credits,
        "faculty_id": subject_with_faculty.faculty_id,
        "faculty_name": subject_with_faculty.faculty.name if subject_with_faculty.faculty else None
    }

@router.put("/{class_id}")
async def update_class(
    class_id: int,
    class_data: dict,
    current_admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update a class (admin only)."""
    result = await db.execute(
        select(Subject).options(selectinload(Subject.faculty)).where(Subject.id == class_id)
    )
    subject = result.scalar_one_or_none()
    
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    # Update fields
    if "name" in class_data:
        subject.name = class_data["name"]
    if "code" in class_data:
        subject.code = class_data["code"]
    if "description" in class_data:
        subject.description = class_data["description"]
    if "credits" in class_data:
        subject.credits = class_data["credits"]
    if "faculty_id" in class_data:
        subject.faculty_id = class_data["faculty_id"]
    
    await db.commit()
    await db.refresh(subject, ['faculty'])
    
    return {
        "id": str(subject.id),
        "name": subject.name,
        "teacherId": "1",
        "subject": subject.name,
        "code": subject.code,
        "description": subject.description,
        "credits": subject.credits,
        "faculty_id": subject.faculty_id,
        "faculty_name": subject.faculty.name if subject.faculty else None
    }

@router.delete("/{class_id}")
async def delete_class(
    class_id: int,
    current_admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete a class (admin only)."""
    result = await db.execute(select(Subject).where(Subject.id == class_id))
    subject = result.scalar_one_or_none()
    
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    await db.delete(subject)
    await db.commit()
    
    return {"message": "Class deleted successfully"}
