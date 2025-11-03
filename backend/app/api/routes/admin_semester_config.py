#!/usr/bin/env python3
"""
Admin Semester Configuration API

Provides CRUD operations for managing semester configurations.
Only accessible to admin users.
"""

from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, update, delete, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, validator

from app.core.database import get_db
from app.models import SemesterConfiguration, User, UserRole
from app.api.dependencies import get_current_user
from app.services.academic_calculator import SemesterService


# Pydantic models for request/response
class SemesterConfigRequest(BaseModel):
    semester_number: Optional[int] = Field(None, ge=1, le=8, description="Optional reference semester for sorting/display (not used for filtering)")
    academic_year: int = Field(..., ge=2020, le=2030, description="Academic year (e.g., 2025-2026 enter 2025)")
    semester_name: str = Field(..., max_length=100, description="Period name (e.g., 'Fall 2025 Academic Period')")
    start_date: date = Field(..., description="Period start date (applies to entire university)")
    end_date: date = Field(..., description="Period end date (applies to entire university)")
    total_weeks: Optional[int] = Field(None, ge=1, le=20, description="Duration in weeks")
    exam_week_start: Optional[date] = Field(None, description="Exam period start date")
    exam_week_end: Optional[date] = Field(None, description="Exam period end date")
    is_current: bool = Field(False, description="Whether this is the active academic period")
    is_active: bool = Field(True, description="Whether this period is active")
    
    @validator('end_date')
    def validate_end_date(cls, v, values):
        if 'start_date' in values and v <= values['start_date']:
            raise ValueError('end_date must be after start_date')
        return v
    
    @validator('exam_week_end')
    def validate_exam_week_end(cls, v, values):
        if v is not None and 'exam_week_start' in values and values['exam_week_start'] is not None:
            if v <= values['exam_week_start']:
                raise ValueError('exam_week_end must be after exam_week_start')
        return v


class SemesterConfigResponse(SemesterConfigRequest):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int]
    
    class Config:
        from_attributes = True


class SemesterConfigUpdate(BaseModel):
    semester_name: Optional[str] = Field(None, max_length=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    total_weeks: Optional[int] = Field(None, ge=1, le=20)
    exam_week_start: Optional[date] = None
    exam_week_end: Optional[date] = None
    is_current: Optional[bool] = None
    is_active: Optional[bool] = None


router = APIRouter(prefix="/admin/semester-config", tags=["Admin - Semester Configuration"])


async def require_admin_user(current_user: User = Depends(get_current_user)):
    """Dependency to ensure only admin users can access these endpoints"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@router.get("/", response_model=List[SemesterConfigResponse])
async def get_all_semester_configurations(
    active_only: bool = Query(False, description="Return only active semesters"),
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all semester configurations"""
    semester_service = SemesterService(db)
    configurations = await semester_service.get_all_semesters(active_only=active_only)
    return configurations


@router.get("/current", response_model=Optional[SemesterConfigResponse])
async def get_current_semester_configuration(
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the current semester configuration"""
    semester_service = SemesterService(db)
    current_semester = await semester_service.get_current_semester()
    
    if not current_semester:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No current semester configuration found"
        )
    
    return current_semester


@router.get("/{config_id}", response_model=SemesterConfigResponse)
async def get_semester_configuration(
    config_id: int,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific semester configuration by ID"""
    semester_service = SemesterService(db)
    configuration = await semester_service.get_semester_by_id(config_id)
    
    if not configuration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semester configuration not found"
        )
    
    return configuration


@router.post("/", response_model=SemesterConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_semester_configuration(
    config_data: SemesterConfigRequest,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new semester configuration"""
    
    # Check for conflicts with existing semesters
    conflict_query = select(SemesterConfiguration).where(
        and_(
            SemesterConfiguration.academic_year == config_data.academic_year,
            SemesterConfiguration.semester_number == config_data.semester_number,
            SemesterConfiguration.is_active == True
        )
    )
    conflict_result = await db.execute(conflict_query)
    existing = conflict_result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Semester {config_data.semester_number} for academic year {config_data.academic_year} already exists"
        )
    
    # If this is set as current, unset any other current semester
    if config_data.is_current:
        await _unset_current_semesters(db)
    
    # Create new semester configuration
    new_config = SemesterConfiguration(
        **config_data.dict(),
        created_by=current_user.id
    )
    
    db.add(new_config)
    await db.commit()
    await db.refresh(new_config)
    
    return new_config


@router.put("/{config_id}", response_model=SemesterConfigResponse)
async def update_semester_configuration(
    config_id: int,
    config_data: SemesterConfigUpdate,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an existing semester configuration"""
    
    # Get existing configuration
    query = select(SemesterConfiguration).where(SemesterConfiguration.id == config_id)
    result = await db.execute(query)
    existing_config = result.scalar_one_or_none()
    
    if not existing_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semester configuration not found"
        )
    
    # If setting as current, unset other current semesters
    if config_data.is_current:
        await _unset_current_semesters(db, exclude_id=config_id)
    
    # Update fields
    update_data = {k: v for k, v in config_data.dict(exclude_unset=True).items()}
    if update_data:
        update_data['updated_at'] = datetime.utcnow()
        
        update_query = update(SemesterConfiguration).where(
            SemesterConfiguration.id == config_id
        ).values(**update_data)
        
        await db.execute(update_query)
        await db.commit()
        await db.refresh(existing_config)
    
    return existing_config


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_semester_configuration(
    config_id: int,
    soft_delete: bool = Query(True, description="Soft delete (set is_active=False) or hard delete"),
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a semester configuration"""
    
    # Check if configuration exists
    query = select(SemesterConfiguration).where(SemesterConfiguration.id == config_id)
    result = await db.execute(query)
    existing_config = result.scalar_one_or_none()
    
    if not existing_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semester configuration not found"
        )
    
    if existing_config.is_current:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the current semester configuration"
        )
    
    if soft_delete:
        # Soft delete - just mark as inactive
        update_query = update(SemesterConfiguration).where(
            SemesterConfiguration.id == config_id
        ).values(is_active=False, updated_at=datetime.utcnow())
        
        await db.execute(update_query)
    else:
        # Hard delete
        delete_query = delete(SemesterConfiguration).where(SemesterConfiguration.id == config_id)
        await db.execute(delete_query)
    
    await db.commit()


@router.post("/{config_id}/set-current", response_model=SemesterConfigResponse)
async def set_current_semester(
    config_id: int,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Set a semester configuration as the current semester"""
    
    # Check if configuration exists
    query = select(SemesterConfiguration).where(
        and_(
            SemesterConfiguration.id == config_id,
            SemesterConfiguration.is_active == True
        )
    )
    result = await db.execute(query)
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semester configuration not found or inactive"
        )
    
    # Unset all other current semesters
    await _unset_current_semesters(db)
    
    # Set this one as current
    update_query = update(SemesterConfiguration).where(
        SemesterConfiguration.id == config_id
    ).values(is_current=True, updated_at=datetime.utcnow())
    
    await db.execute(update_query)
    await db.commit()
    await db.refresh(config)
    
    return config


@router.get("/validate/dates")
async def validate_semester_dates(
    start_date: date = Query(..., description="Proposed start date"),
    end_date: date = Query(..., description="Proposed end date"),
    exclude_id: Optional[int] = Query(None, description="ID to exclude from validation"),
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Validate that semester dates don't conflict with existing semesters"""
    
    if end_date <= start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )
    
    # Check for date overlaps
    conditions = [
        SemesterConfiguration.is_active == True,
        # Check for any overlap
        and_(
            SemesterConfiguration.start_date < end_date,
            SemesterConfiguration.end_date > start_date
        )
    ]
    
    if exclude_id:
        conditions.append(SemesterConfiguration.id != exclude_id)
    
    query = select(SemesterConfiguration).where(and_(*conditions))
    result = await db.execute(query)
    conflicts = result.scalars().all()
    
    if conflicts:
        conflict_details = [
            {
                "id": config.id,
                "name": config.semester_name,
                "start_date": config.start_date.isoformat(),
                "end_date": config.end_date.isoformat()
            }
            for config in conflicts
        ]
        
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Date range conflicts with existing semesters",
                "conflicts": conflict_details
            }
        )
    
    return {"valid": True, "message": "No date conflicts found"}


# Helper functions
async def _unset_current_semesters(db: AsyncSession, exclude_id: Optional[int] = None):
    """Unset all current semester flags, optionally excluding one ID"""
    conditions = [SemesterConfiguration.is_current == True]
    
    if exclude_id:
        conditions.append(SemesterConfiguration.id != exclude_id)
    
    update_query = update(SemesterConfiguration).where(
        and_(*conditions)
    ).values(is_current=False, updated_at=datetime.utcnow())
    
    await db.execute(update_query)