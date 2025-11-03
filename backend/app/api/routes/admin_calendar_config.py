"""
Admin API Routes for Academic Calendar Configuration Override

Allows administrators to create emergency overrides for semester boundary dates.
Used for scenarios like COVID-19, natural disasters, institutional policy changes.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator

from app.core.database import get_db
from app.models import User
from app.models.calendar import AcademicCalendarConfig
from app.services.automatic_semester import AutomaticSemesterService
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/api/admin/academic-calendar", tags=["Admin Calendar Config"])


# ============================================================================
# Request/Response Models
# ============================================================================

class DateBoundary(BaseModel):
    """Represents a month/day boundary (e.g., August 1 = month:8, day:1)"""
    month: int = Field(..., ge=1, le=12, description="Month (1-12)")
    day: int = Field(..., ge=1, le=31, description="Day (1-31)")


class CalendarOverrideCreate(BaseModel):
    """Request model for creating calendar override"""
    fall_start: DateBoundary
    fall_end: DateBoundary
    spring_start: DateBoundary
    spring_end: DateBoundary
    
    reason: str = Field(..., min_length=10, max_length=1000, description="Reason for override")
    effective_from: date = Field(..., description="Override effective from date")
    effective_until: Optional[date] = Field(None, description="Override expires on (NULL = indefinite)")
    
    is_emergency_override: bool = Field(False, description="Mark as emergency override")
    emergency_contact_email: Optional[str] = Field(None, max_length=255)
    
    @validator('effective_until')
    def validate_effective_range(cls, v, values):
        if v is not None and 'effective_from' in values:
            if v < values['effective_from']:
                raise ValueError('effective_until must be >= effective_from')
        return v
    
    @validator('fall_end')
    def validate_fall_dates(cls, v, values):
        if 'fall_start' in values:
            start = values['fall_start']
            # Simplified: just check month ordering (doesn't handle wrap-around perfectly)
            if v.month < start.month or (v.month == start.month and v.day <= start.day):
                raise ValueError('fall_end must be after fall_start')
        return v
    
    @validator('spring_end')
    def validate_spring_dates(cls, v, values):
        if 'spring_start' in values:
            start = values['spring_start']
            if v.month < start.month or (v.month == start.month and v.day <= start.day):
                raise ValueError('spring_end must be after spring_start')
        return v


class CalendarOverrideResponse(BaseModel):
    """Response model for calendar override"""
    id: int
    fall_start: DateBoundary
    fall_end: DateBoundary
    spring_start: DateBoundary
    spring_end: DateBoundary
    
    is_override_active: bool
    reason: str
    effective_from: date
    effective_until: Optional[date]
    
    is_emergency_override: bool
    emergency_contact_email: Optional[str]
    
    created_by: int
    created_at: datetime
    updated_by: Optional[int]
    updated_at: datetime
    
    class Config:
        from_attributes = True


class CurrentConfigResponse(BaseModel):
    """Current active calendar configuration"""
    fall_start: tuple
    fall_end: tuple
    spring_start: tuple
    spring_end: tuple
    is_override_active: bool
    defaults: dict
    override_details: Optional[CalendarOverrideResponse] = None


# ============================================================================
# Helper Functions
# ============================================================================

async def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Dependency to require admin role"""
    from app.models import UserRole
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


async def create_audit_log(
    session: AsyncSession,
    user_id: int,
    action: str,
    details: str
):
    """Create audit log entry (placeholder - implement based on your audit system)"""
    # TODO: Implement actual audit logging if you have an audit_logs table
    pass


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/current", response_model=CurrentConfigResponse)
async def get_current_calendar_config(
    session: AsyncSession = Depends(get_db)
):
    """
    Get current active calendar configuration.
    
    Returns the current semester boundary dates being used by the system,
    including whether they're from defaults or an admin override.
    """
    # Refresh override from DB (respects cache TTL)
    await AutomaticSemesterService.load_override_from_db(session)
    
    # Get active config
    config = AutomaticSemesterService.get_active_configuration()
    
    # Get override details if active
    override_details = None
    if config['is_override_active']:
        result = await session.execute(
            select(AcademicCalendarConfig)
            .where(AcademicCalendarConfig.is_override_active == True)
        )
        override = result.scalar_one_or_none()
        if override:
            override_details = CalendarOverrideResponse(
                id=override.id,
                fall_start=DateBoundary(month=override.fall_start_month, day=override.fall_start_day),
                fall_end=DateBoundary(month=override.fall_end_month, day=override.fall_end_day),
                spring_start=DateBoundary(month=override.spring_start_month, day=override.spring_start_day),
                spring_end=DateBoundary(month=override.spring_end_month, day=override.spring_end_day),
                is_override_active=override.is_override_active,
                reason=override.reason or "",
                effective_from=override.effective_from,
                effective_until=override.effective_until,
                is_emergency_override=override.is_emergency_override,
                emergency_contact_email=override.emergency_contact_email,
                created_by=override.created_by,
                created_at=override.created_at,
                updated_by=override.updated_by,
                updated_at=override.updated_at
            )
    
    return CurrentConfigResponse(
        fall_start=config['fall_start'],
        fall_end=config['fall_end'],
        spring_start=config['spring_start'],
        spring_end=config['spring_end'],
        is_override_active=config['is_override_active'],
        defaults=config['defaults'],
        override_details=override_details
    )


@router.post("/override", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_calendar_override(
    override_data: CalendarOverrideCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Create emergency calendar override.
    
    Deactivates any existing override and creates a new one with the specified dates.
    Requires admin privileges.
    
    **Use Cases:**
    - COVID-19 pandemic: Delay semester start by 4 weeks
    - Natural disaster: Adjust semester end date
    - Institutional policy: Change academic calendar temporarily
    """
    # Deactivate any existing override
    await session.execute(
        update(AcademicCalendarConfig)
        .where(AcademicCalendarConfig.is_override_active == True)
        .values(is_override_active=False, updated_at=datetime.now(), updated_by=current_user.id)
    )
    
    # Create new override
    new_override = AcademicCalendarConfig(
        fall_start_month=override_data.fall_start.month,
        fall_start_day=override_data.fall_start.day,
        fall_end_month=override_data.fall_end.month,
        fall_end_day=override_data.fall_end.day,
        spring_start_month=override_data.spring_start.month,
        spring_start_day=override_data.spring_start.day,
        spring_end_month=override_data.spring_end.month,
        spring_end_day=override_data.spring_end.day,
        is_override_active=True,
        reason=override_data.reason,
        effective_from=override_data.effective_from,
        effective_until=override_data.effective_until,
        is_emergency_override=override_data.is_emergency_override,
        emergency_contact_email=override_data.emergency_contact_email,
        created_by=current_user.id,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    session.add(new_override)
    await session.commit()
    await session.refresh(new_override)
    
    # Clear override cache to force immediate refresh
    AutomaticSemesterService.clear_override_cache()
    
    # Create audit log
    await create_audit_log(
        session=session,
        user_id=current_user.id,
        action="CALENDAR_OVERRIDE_CREATED",
        details=f"Emergency: {override_data.is_emergency_override}, Reason: {override_data.reason}"
    )
    
    return {
        "message": "Calendar override activated",
        "override_id": new_override.id,
        "is_emergency": new_override.is_emergency_override
    }


@router.delete("/override/{override_id}", response_model=dict)
async def deactivate_override(
    override_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Deactivate calendar override and revert to defaults.
    
    Sets the override as inactive and reloads default semester boundaries.
    Requires admin privileges.
    """
    # Find override
    result = await session.execute(
        select(AcademicCalendarConfig).where(AcademicCalendarConfig.id == override_id)
    )
    override = result.scalar_one_or_none()
    
    if not override:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Override {override_id} not found"
        )
    
    # Deactivate
    await session.execute(
        update(AcademicCalendarConfig)
        .where(AcademicCalendarConfig.id == override_id)
        .values(is_override_active=False, updated_by=current_user.id, updated_at=datetime.now())
    )
    await session.commit()
    
    # Reset service to defaults
    AutomaticSemesterService.reset_to_defaults()
    AutomaticSemesterService.clear_override_cache()
    
    # Create audit log
    await create_audit_log(
        session=session,
        user_id=current_user.id,
        action="CALENDAR_OVERRIDE_DEACTIVATED",
        details=f"Override ID: {override_id}"
    )
    
    return {
        "message": "Reverted to default calendar dates",
        "override_id": override_id
    }


@router.get("/overrides", response_model=List[CalendarOverrideResponse])
async def list_all_overrides(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
    include_inactive: bool = False
):
    """
    List all calendar overrides (active and optionally inactive).
    
    Useful for viewing override history and audit trail.
    Requires admin privileges.
    """
    query = select(AcademicCalendarConfig)
    
    if not include_inactive:
        query = query.where(AcademicCalendarConfig.is_override_active == True)
    
    query = query.order_by(AcademicCalendarConfig.created_at.desc())
    
    result = await session.execute(query)
    overrides = result.scalars().all()
    
    return [
        CalendarOverrideResponse(
            id=o.id,
            fall_start=DateBoundary(month=o.fall_start_month, day=o.fall_start_day),
            fall_end=DateBoundary(month=o.fall_end_month, day=o.fall_end_day),
            spring_start=DateBoundary(month=o.spring_start_month, day=o.spring_start_day),
            spring_end=DateBoundary(month=o.spring_end_month, day=o.spring_end_day),
            is_override_active=o.is_override_active,
            reason=o.reason or "",
            effective_from=o.effective_from,
            effective_until=o.effective_until,
            is_emergency_override=o.is_emergency_override,
            emergency_contact_email=o.emergency_contact_email,
            created_by=o.created_by,
            created_at=o.created_at,
            updated_by=o.updated_by,
            updated_at=o.updated_at
        )
        for o in overrides
    ]


@router.get("/defaults", response_model=dict)
async def get_default_dates():
    """
    Get hardcoded default semester boundaries.
    
    Returns the system defaults (August-December, January-May) that are used
    when no override is active.
    """
    return {
        "fall_start": {"month": 8, "day": 1},
        "fall_end": {"month": 12, "day": 15},
        "spring_start": {"month": 1, "day": 15},
        "spring_end": {"month": 5, "day": 30},
        "description": "Standard North American academic calendar"
    }
