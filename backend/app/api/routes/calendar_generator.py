"""
Calendar Generator API Routes — retired (DOMAIN_RULES §9).

CLASS "marker" events are no longer needed: class sessions are materialized from the timetable
for dates inside an active term. Every mutating endpoint returns **410 Gone** with an explanation
(admin guard kept); ``GET /status`` reports ``status: "disabled"`` plus the current term.
"""

from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, require_admin_role
from app.core.database import get_db
from app.models import User
from app.services import term_service
from app.services.calendar_generator import DISABLED_MESSAGE

router = APIRouter(prefix="/calendar-generator", tags=["calendar-generator"])

# Admin-only dependency (shared, Enum-safe role check).
require_admin = require_admin_role


def _gone() -> HTTPException:
    return HTTPException(status_code=410, detail=DISABLED_MESSAGE)


@router.post("/auto-generate")
async def auto_generate_events(
    days_ahead: int = Query(30, ge=1, le=180),
    current_user: User = Depends(require_admin)
) -> Dict:
    """Retired (410)."""
    raise _gone()


@router.post("/generate-semester")
async def generate_full_semester(
    current_user: User = Depends(require_admin)
) -> Dict:
    """Retired (410)."""
    raise _gone()


@router.post("/cleanup-old-events")
async def cleanup_old_events(
    days_old: int = Query(90, ge=30, le=365),
    current_user: User = Depends(require_admin)
) -> Dict:
    """Retired (410). Calendar events are never hard-deleted."""
    raise _gone()


@router.post("/regenerate-date-range")
async def regenerate_date_range(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(require_admin)
) -> Dict:
    """Retired (410)."""
    raise _gone()


@router.get("/status")
async def get_generator_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict:
    """The generator is disabled; reports the current term for context."""
    ctx = await term_service.get_term_context(db)
    term = ctx.current_term
    return {
        "status": "disabled",
        "message": DISABLED_MESSAGE,
        "term_state": ctx.state,
        "semester": {
            "id": term.id,
            "name": term.name,
            "number": term.semester_number,
            "academic_year": term.academic_year,
            "start_date": term.start_date.isoformat(),
            "end_date": term.end_date.isoformat(),
            "is_current": True,
        } if term else None,
        "coverage": None,
    }
