"""
Admin API Routes for the (deprecated) Academic Calendar Configuration Override.

DOMAIN_RULES §3.1 / §13.13: academic periods are managed in Semester Setup
(``/api/admin/semester-config``). The month/day override no longer drives term resolution:

* write endpoints (``POST /override``, ``DELETE /override/{id}``) return **410 Gone** with
  ``{"detail": "Academic periods are managed in Semester Setup"}`` (admin guard kept);
* read endpoints are unchanged (informational);
* boundaries are validated as real calendar dates (Feb 30 etc. rejected, Feb 29 allowed, periods
  may cross the new year); responses tolerate legacy rows so nothing can crash.
"""

import calendar as _calendar
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_admin_role
from app.core.database import get_db
from app.models import User
from app.models.calendar import AcademicCalendarConfig
from app.services.automatic_semester import AutomaticSemesterService

router = APIRouter(prefix="/api/admin/academic-calendar", tags=["Admin Calendar Config"])

GONE_MESSAGE = "Academic periods are managed in Semester Setup"


# ============================================================================
# Request/Response Models
# ============================================================================

def is_valid_boundary(month: int, day: int) -> bool:
    """True iff month/day is a real calendar date (leap year, so Feb 29 is allowed)."""
    try:
        month, day = int(month), int(day)
    except (TypeError, ValueError):
        return False
    if not 1 <= month <= 12:
        return False
    return 1 <= day <= _calendar.monthrange(2000, month)[1]


class DateBoundaryOut(BaseModel):
    """Month/day boundary as stored (lenient: legacy rows are shown, never re-validated)."""
    month: int
    day: int


class DateBoundary(DateBoundaryOut):
    """Month/day boundary in a request (e.g. August 1 = month:8, day:1); must be a real date."""
    month: int = Field(..., ge=1, le=12, description="Month (1-12)")
    day: int = Field(..., ge=1, le=31, description="Day (1-31)")

    @validator("day")
    def validate_real_date(cls, v, values):
        month = values.get("month")
        if month is not None and not is_valid_boundary(month, v):
            raise ValueError(f"{month}/{v} is not a valid calendar date")
        return v


class CalendarOverrideCreate(BaseModel):
    """Legacy request schema (writes are retired; kept for API documentation)."""
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
        if v is not None and 'effective_from' in values and v < values['effective_from']:
            raise ValueError('effective_until must be >= effective_from')
        return v
    # Month ordering is deliberately not validated: a period may cross the new year (e.g. Sept-Feb).


class CalendarOverrideResponse(BaseModel):
    """Response model for calendar override"""
    id: int
    fall_start: DateBoundaryOut
    fall_end: DateBoundaryOut
    spring_start: DateBoundaryOut
    spring_end: DateBoundaryOut

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
    """Current calendar configuration (informational)."""
    fall_start: tuple
    fall_end: tuple
    spring_start: tuple
    spring_end: tuple
    is_override_active: bool
    defaults: dict
    override_details: Optional[CalendarOverrideResponse] = None
    deprecated: bool = True
    message: str = GONE_MESSAGE


# Admin-only dependency (shared, Enum-safe role check).
require_admin = require_admin_role


def _to_response(o: AcademicCalendarConfig) -> CalendarOverrideResponse:
    return CalendarOverrideResponse(
        id=o.id,
        fall_start=DateBoundaryOut(month=o.fall_start_month, day=o.fall_start_day),
        fall_end=DateBoundaryOut(month=o.fall_end_month, day=o.fall_end_day),
        spring_start=DateBoundaryOut(month=o.spring_start_month, day=o.spring_start_day),
        spring_end=DateBoundaryOut(month=o.spring_end_month, day=o.spring_end_day),
        is_override_active=bool(o.is_override_active),
        reason=o.reason or "",
        effective_from=o.effective_from,
        effective_until=o.effective_until,
        is_emergency_override=bool(o.is_emergency_override),
        emergency_contact_email=o.emergency_contact_email,
        created_by=o.created_by,
        created_at=o.created_at,
        updated_by=o.updated_by,
        updated_at=o.updated_at,
    )


def _gone() -> HTTPException:
    return HTTPException(status_code=status.HTTP_410_GONE, detail=GONE_MESSAGE)


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/current", response_model=CurrentConfigResponse)
async def get_current_calendar_config(
    session: AsyncSession = Depends(get_db)
):
    """Informational month/day boundaries (no longer used to resolve terms)."""
    await AutomaticSemesterService.load_override_from_db(session)
    config = AutomaticSemesterService.get_active_configuration()

    override_details = None
    if config['is_override_active']:
        override = (await session.execute(
            select(AcademicCalendarConfig)
            .where(AcademicCalendarConfig.is_override_active.is_(True))
            .order_by(AcademicCalendarConfig.id.desc())
        )).scalars().first()
        if override:
            override_details = _to_response(override)

    return CurrentConfigResponse(
        fall_start=config['fall_start'],
        fall_end=config['fall_end'],
        spring_start=config['spring_start'],
        spring_end=config['spring_end'],
        is_override_active=config['is_override_active'],
        defaults=config['defaults'],
        override_details=override_details,
    )


@router.post("/override", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_calendar_override(
    current_user: User = Depends(require_admin)
):
    """Retired (410): academic periods are managed in Semester Setup."""
    raise _gone()


@router.delete("/override/{override_id}", response_model=dict)
async def deactivate_override(
    override_id: int,
    current_user: User = Depends(require_admin)
):
    """Retired (410): academic periods are managed in Semester Setup."""
    raise _gone()


@router.get("/overrides", response_model=List[CalendarOverrideResponse])
async def list_all_overrides(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
    include_inactive: bool = False
):
    """List calendar overrides (history; informational)."""
    query = select(AcademicCalendarConfig)
    if not include_inactive:
        query = query.where(AcademicCalendarConfig.is_override_active.is_(True))
    query = query.order_by(AcademicCalendarConfig.created_at.desc())
    overrides = (await session.execute(query)).scalars().all()
    return [_to_response(o) for o in overrides]


@router.get("/defaults", response_model=dict)
async def get_default_dates():
    """Legacy default month/day boundaries (informational only)."""
    return {
        "fall_start": {"month": 8, "day": 1},
        "fall_end": {"month": 12, "day": 15},
        "spring_start": {"month": 1, "day": 15},
        "spring_end": {"month": 5, "day": 30},
        "description": "Standard North American academic calendar (informational; terms are managed in Semester Setup)",
    }
