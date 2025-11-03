"""
System Settings API Routes
Endpoints for managing system-wide configuration including attendance thresholds
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from typing import List, Optional
from pydantic import BaseModel, Field
from app.core.database import get_db
from app.models import User, UserRole
from app.models.system_settings import SystemSetting, AttendanceThreshold
from app.api.dependencies import get_current_user

router = APIRouter()


# Pydantic Models
class AttendanceThresholdResponse(BaseModel):
    id: int
    name: str
    min_percentage: float
    max_percentage: Optional[float]
    color: str
    badge_style: str
    label: str
    description: Optional[str]
    order: int
    is_active: bool
    
    class Config:
        from_attributes = True


class AttendanceThresholdUpdate(BaseModel):
    name: Optional[str] = None
    min_percentage: Optional[float] = Field(None, ge=0, le=100)
    max_percentage: Optional[float] = Field(None, ge=0, le=100)
    color: Optional[str] = None
    badge_style: Optional[str] = None
    label: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None


class AttendanceThresholdCreate(BaseModel):
    name: str
    min_percentage: float = Field(..., ge=0, le=100)
    max_percentage: Optional[float] = Field(None, ge=0, le=100)
    color: str
    badge_style: str
    label: str
    description: Optional[str] = None
    order: int


class SystemSettingResponse(BaseModel):
    id: int
    key: str
    value: dict
    category: str
    description: Optional[str]
    data_type: str
    is_active: bool
    
    class Config:
        from_attributes = True


# Helper function to check admin access
def require_admin(current_user: User):
    """Ensure current user is an admin"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can modify system settings"
        )


# === ATTENDANCE THRESHOLD ENDPOINTS ===

@router.get("/attendance-thresholds", response_model=List[AttendanceThresholdResponse])
async def get_attendance_thresholds(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all attendance thresholds
    Public endpoint - any authenticated user can view thresholds
    """
    query = select(AttendanceThreshold).order_by(AttendanceThreshold.order)
    
    if active_only:
        query = query.where(AttendanceThreshold.is_active == True)
    
    result = await db.execute(query)
    thresholds = result.scalars().all()
    
    return thresholds


@router.get("/attendance-thresholds/{threshold_id}", response_model=AttendanceThresholdResponse)
async def get_attendance_threshold(
    threshold_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific attendance threshold by ID"""
    result = await db.execute(
        select(AttendanceThreshold).where(AttendanceThreshold.id == threshold_id)
    )
    threshold = result.scalar_one_or_none()
    
    if not threshold:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendance threshold not found"
        )
    
    return threshold


@router.put("/attendance-thresholds/{threshold_id}", response_model=AttendanceThresholdResponse)
async def update_attendance_threshold(
    threshold_id: int,
    threshold_update: AttendanceThresholdUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an attendance threshold (Admin only)
    Allows customization of percentage ranges, colors, labels, etc.
    """
    require_admin(current_user)
    
    # Get existing threshold
    result = await db.execute(
        select(AttendanceThreshold).where(AttendanceThreshold.id == threshold_id)
    )
    threshold = result.scalar_one_or_none()
    
    if not threshold:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendance threshold not found"
        )
    
    # Validate percentage range
    update_data = threshold_update.dict(exclude_unset=True)
    
    if "min_percentage" in update_data and "max_percentage" in update_data:
        if update_data["max_percentage"] is not None:
            if update_data["min_percentage"] > update_data["max_percentage"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="min_percentage cannot be greater than max_percentage"
                )
    
    # Update fields
    for field, value in update_data.items():
        setattr(threshold, field, value)
    
    await db.commit()
    await db.refresh(threshold)
    
    return threshold


@router.post("/attendance-thresholds", response_model=AttendanceThresholdResponse, status_code=status.HTTP_201_CREATED)
async def create_attendance_threshold(
    threshold_data: AttendanceThresholdCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new attendance threshold (Admin only)
    Useful for adding custom tiers (e.g., "Marginal" between Warning and Critical)
    """
    require_admin(current_user)
    
    # Validate percentage range
    if threshold_data.max_percentage is not None:
        if threshold_data.min_percentage > threshold_data.max_percentage:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="min_percentage cannot be greater than max_percentage"
            )
    
    # Create new threshold
    threshold = AttendanceThreshold(**threshold_data.dict())
    db.add(threshold)
    await db.commit()
    await db.refresh(threshold)
    
    return threshold


@router.delete("/attendance-thresholds/{threshold_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attendance_threshold(
    threshold_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete an attendance threshold (Admin only)
    Use with caution - may affect existing attendance displays
    """
    require_admin(current_user)
    
    result = await db.execute(
        select(AttendanceThreshold).where(AttendanceThreshold.id == threshold_id)
    )
    threshold = result.scalar_one_or_none()
    
    if not threshold:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendance threshold not found"
        )
    
    await db.delete(threshold)
    await db.commit()


@router.post("/attendance-thresholds/reset", response_model=List[AttendanceThresholdResponse])
async def reset_attendance_thresholds(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reset attendance thresholds to default values (Admin only)
    WARNING: This will delete all custom thresholds and restore defaults
    """
    require_admin(current_user)
    
    # Delete all existing thresholds
    await db.execute(delete(AttendanceThreshold))
    
    # Create default thresholds
    default_thresholds = [
        AttendanceThreshold(
            name="excellent",
            min_percentage=90.0,
            max_percentage=None,
            color="blue",
            badge_style="bg-blue-500/20 text-blue-300 border-blue-400/30",
            label="Excellent",
            description="Outstanding attendance (≥90%). Honor roll level performance.",
            order=1
        ),
        AttendanceThreshold(
            name="good",
            min_percentage=85.0,
            max_percentage=89.99,
            color="green",
            badge_style="bg-green-500/20 text-green-300 border-green-400/30",
            label="Good",
            description="Strong attendance (85-89%). Well above minimum requirement.",
            order=2
        ),
        AttendanceThreshold(
            name="warning",
            min_percentage=75.0,
            max_percentage=84.99,
            color="yellow",
            badge_style="bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
            label="Warning",
            description="Meeting minimum requirement (75-84%). Improvement recommended.",
            order=3
        ),
        AttendanceThreshold(
            name="critical",
            min_percentage=0.0,
            max_percentage=74.99,
            color="red",
            badge_style="bg-red-500/20 text-red-300 border-red-400/30",
            label="Critical",
            description="Below minimum requirement (<75%). Immediate action required.",
            order=4
        )
    ]
    
    for threshold in default_thresholds:
        db.add(threshold)
    
    await db.commit()
    
    # Return new thresholds
    result = await db.execute(
        select(AttendanceThreshold).order_by(AttendanceThreshold.order)
    )
    return result.scalars().all()


# === SYSTEM SETTINGS ENDPOINTS ===

@router.get("/settings", response_model=List[SystemSettingResponse])
async def get_system_settings(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all system settings, optionally filtered by category"""
    query = select(SystemSetting).where(SystemSetting.is_active == True)
    
    if category:
        query = query.where(SystemSetting.category == category)
    
    result = await db.execute(query)
    settings = result.scalars().all()
    
    return settings


@router.get("/settings/{key}", response_model=SystemSettingResponse)
async def get_system_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific system setting by key"""
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == key)
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setting '{key}' not found"
        )
    
    return setting
