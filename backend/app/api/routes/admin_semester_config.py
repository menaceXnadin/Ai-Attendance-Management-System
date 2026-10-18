#!/usr/bin/env python3
"""Admin term (semester configuration) API — DOMAIN_RULES §3, §3.3, §13.13.

``semester_configurations`` is the single source of truth for academic terms. All rules live in
``app.services.term_service``; this module only maps HTTP <-> service:

* ``is_current`` is computed from the dates (active term containing ``app_today()``); the stored
  column is kept in sync on every write but is never authoritative.
* Every response item carries ``state``: ``current | upcoming | past | inactive``.
* Create/update validation (end > start, exam window inside the term, academic year 2000-2100,
  no overlap with another active term under an advisory lock) -> 400 ``{detail: message}``;
  overlap -> 409 ``{detail: message}``.
* ``DELETE`` deactivates (``is_active = false``); terms are never hard-deleted.
"""

from datetime import date, datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_admin_role
from app.core.clock import app_today
from app.core.database import get_db
from app.models import SemesterConfiguration, User
from app.services import term_service
from app.services.domain_errors import DomainError


# --------------------------------------------------------------------------- schemas
class SemesterConfigRequest(BaseModel):
    semester_number: Optional[int] = Field(
        None, ge=1, le=8,
        description="Reference semester for sorting/display (1-8). Defaults to the next number within the academic year.",
    )
    academic_year: Optional[int] = Field(None, description="Academic-year label (start year, e.g. 2025 for 2025-26). Defaults to the start date's year.")
    semester_name: str = Field(..., min_length=1, max_length=100, description="Term name (e.g. 'Fall 2025')")
    start_date: date
    end_date: date
    total_weeks: Optional[int] = Field(None, ge=1, le=60)
    exam_week_start: Optional[date] = None
    exam_week_end: Optional[date] = None
    is_current: Optional[bool] = Field(None, description="Ignored: computed from the dates")
    is_active: bool = True


class SemesterConfigUpdate(BaseModel):
    semester_number: Optional[int] = Field(None, ge=1, le=8)
    academic_year: Optional[int] = None
    semester_name: Optional[str] = Field(None, min_length=1, max_length=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    total_weeks: Optional[int] = Field(None, ge=1, le=60)
    exam_week_start: Optional[date] = None
    exam_week_end: Optional[date] = None
    is_current: Optional[bool] = Field(None, description="Ignored: computed from the dates")
    is_active: Optional[bool] = None


router = APIRouter(prefix="/admin/semester-config", tags=["Admin - Semester Configuration"])

# Admin-only dependency (shared, Enum-safe role check).
require_admin_user = require_admin_role


# --------------------------------------------------------------------------- helpers
def term_state(row: Any, today: date) -> str:
    """``inactive`` | ``current`` | ``upcoming`` | ``past`` (computed, never stored)."""
    if row.is_active is False:
        return "inactive"
    if row.start_date <= today <= row.end_date:
        return "current"
    return "upcoming" if row.start_date > today else "past"


def serialize_term(row: SemesterConfiguration, today: Optional[date] = None) -> dict[str, Any]:
    today = today or app_today()
    state = term_state(row, today)
    return {
        "id": row.id,
        "semester_number": row.semester_number,
        "academic_year": row.academic_year,
        "semester_name": row.semester_name,
        "name": row.semester_name,
        "start_date": row.start_date.isoformat(),
        "end_date": row.end_date.isoformat(),
        "total_weeks": row.total_weeks,
        "exam_week_start": row.exam_week_start.isoformat() if row.exam_week_start else None,
        "exam_week_end": row.exam_week_end.isoformat() if row.exam_week_end else None,
        "is_current": state == "current",
        "is_active": row.is_active is not False,
        "state": state,
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _http_from_term_error(err: DomainError) -> HTTPException:
    """``term_invalid`` -> 409 when any error is an overlap, else 400; detail = message string."""
    errors = err.details.get("errors") or []
    overlap = [e for e in errors if e.get("code") == "overlaps_active_term"]
    if overlap:
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=overlap[0]["message"])
    if errors:
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                             detail="; ".join(e["message"] for e in errors))
    return HTTPException(status_code=err.http_status if err.http_status != 422 else 400, detail=err.message)


async def _sync_is_current(db: AsyncSession) -> None:
    """Keep the legacy ``is_current`` column equal to the computed value (Rule §3)."""
    today = app_today()
    computed = and_(
        SemesterConfiguration.is_active.is_(True),
        SemesterConfiguration.start_date <= today,
        SemesterConfiguration.end_date >= today,
    )
    await db.execute(
        update(SemesterConfiguration)
        .where(SemesterConfiguration.is_current.is_distinct_from(computed))
        .values(is_current=computed)
        .execution_options(synchronize_session=False)
    )


def _refresh_semester_facade() -> None:
    """Drop the per-worker term cache used by the legacy ``AutomaticSemesterService`` facade."""
    try:
        from app.services.automatic_semester import AutomaticSemesterService

        AutomaticSemesterService.clear_override_cache()
        AutomaticSemesterService.invalidate_terms()
    except Exception:  # pragma: no cover - facade is optional
        pass


async def _get_row(db: AsyncSession, config_id: int) -> SemesterConfiguration:
    row = await db.get(SemesterConfiguration, config_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester configuration not found")
    return row


async def _default_semester_number(db: AsyncSession, academic_year: int) -> int:
    count = (await db.execute(
        select(func.count(SemesterConfiguration.id)).where(
            SemesterConfiguration.academic_year == academic_year,
            SemesterConfiguration.is_active.is_(True),
        )
    )).scalar() or 0
    return max(1, min(8, int(count) + 1))


def _weeks(start: date, end: date) -> int:
    return max(1, min(60, -(-((end - start).days + 1) // 7)))


# --------------------------------------------------------------------------- reads
@router.get("/")
async def get_all_semester_configurations(
    active_only: bool = Query(False, description="Return only active terms"),
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """All terms (newest first) with computed ``is_current`` and ``state``."""
    stmt = select(SemesterConfiguration).order_by(SemesterConfiguration.start_date.desc(), SemesterConfiguration.id.desc())
    if active_only:
        stmt = stmt.where(SemesterConfiguration.is_active.is_(True))
    rows = (await db.execute(stmt)).scalars().all()
    today = app_today()
    return [serialize_term(r, today) for r in rows]


@router.get("/current")
async def get_current_semester_configuration(
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """The active term containing today, else 404 ``{detail, term_state}``."""
    terms = await term_service.load_terms(db)
    today = app_today()
    current = term_service.term_for_date(terms, today)
    if current is None:
        state = term_service.compute_term_state(terms, today)
        message = "No term is in progress today (between terms)" if state == term_service.TERM_STATE_BETWEEN \
            else "No terms have been configured"
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": message, "term_state": state})
    row = await _get_row(db, current.id)
    return {**serialize_term(row, today), "term_state": term_service.TERM_STATE_ACTIVE}


@router.get("/validate/dates")
async def validate_semester_dates(
    start_date: date = Query(..., description="Proposed start date"),
    end_date: date = Query(..., description="Proposed end date"),
    exclude_id: Optional[int] = Query(None, description="ID to exclude from validation"),
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Advisory check (same rules as create/update, without taking the write lock)."""
    errors = term_service.validate_term_fields(start_date=start_date, end_date=end_date)
    if errors:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=errors[0]["message"])
    conflicts = term_service.find_overlapping_terms(await term_service.load_terms(db), start_date, end_date,
                                                    exclude_id=exclude_id)
    if conflicts:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Date range conflicts with existing terms",
                "conflicts": [t.summary() for t in conflicts],
            },
        )
    return {"valid": True, "message": "No date conflicts found"}


@router.get("/{config_id}")
async def get_semester_configuration(
    config_id: int,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    return serialize_term(await _get_row(db, config_id))


# --------------------------------------------------------------------------- writes
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_semester_configuration(
    config_data: SemesterConfigRequest,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a term (Rule §3.3 validation under the term write lock)."""
    academic_year = config_data.academic_year if config_data.academic_year is not None else config_data.start_date.year
    try:
        await term_service.assert_term_valid(
            db,
            start_date=config_data.start_date,
            end_date=config_data.end_date,
            exam_week_start=config_data.exam_week_start,
            exam_week_end=config_data.exam_week_end,
            academic_year=academic_year,
            is_active=config_data.is_active,
        )
    except DomainError as err:
        await db.rollback()
        raise _http_from_term_error(err)

    semester_number = config_data.semester_number or await _default_semester_number(db, academic_year)
    now = datetime.utcnow()
    row = SemesterConfiguration(
        semester_number=semester_number,
        academic_year=academic_year,
        semester_name=config_data.semester_name.strip(),
        start_date=config_data.start_date,
        end_date=config_data.end_date,
        total_weeks=config_data.total_weeks or _weeks(config_data.start_date, config_data.end_date),
        exam_week_start=config_data.exam_week_start,
        exam_week_end=config_data.exam_week_end,
        is_current=False,
        is_active=config_data.is_active,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.flush()
    await _sync_is_current(db)
    await db.commit()
    await db.refresh(row)
    _refresh_semester_facade()
    return serialize_term(row)


@router.put("/{config_id}")
async def update_semester_configuration(
    config_id: int,
    config_data: SemesterConfigUpdate,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Partial update; the merged term is re-validated (Rule §3.3). ``is_current`` is ignored."""
    row = await _get_row(db, config_id)
    changes = config_data.model_dump(exclude_unset=True)
    changes.pop("is_current", None)
    if "semester_name" in changes and changes["semester_name"] is not None:
        changes["semester_name"] = changes["semester_name"].strip()
    for required in ("semester_name", "start_date", "end_date", "semester_number", "academic_year", "is_active"):
        if required in changes and changes[required] is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{required} cannot be empty")

    merged = {
        "start_date": changes.get("start_date", row.start_date),
        "end_date": changes.get("end_date", row.end_date),
        "exam_week_start": changes.get("exam_week_start", row.exam_week_start),
        "exam_week_end": changes.get("exam_week_end", row.exam_week_end),
        "academic_year": changes.get("academic_year", row.academic_year),
        "is_active": changes.get("is_active", row.is_active is not False),
    }
    try:
        await term_service.assert_term_valid(db, exclude_id=row.id, **merged)
    except DomainError as err:
        await db.rollback()
        raise _http_from_term_error(err)

    if changes:
        for field, value in changes.items():
            setattr(row, field, value)
        row.updated_at = datetime.utcnow()
        await db.flush()
        await _sync_is_current(db)
    await db.commit()
    await db.refresh(row)
    _refresh_semester_facade()
    return serialize_term(row)


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_semester_configuration(
    config_id: int,
    soft_delete: bool = Query(True, description="Ignored: terms are always deactivated, never hard-deleted"),
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a term (``is_active = false``). Hard delete is never performed (Rule §3.3)."""
    row = await _get_row(db, config_id)
    if row.is_active is not False:
        row.is_active = False
        row.updated_at = datetime.utcnow()
        await db.flush()
        await _sync_is_current(db)
    await db.commit()
    _refresh_semester_facade()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{config_id}/set-current")
async def set_current_semester(
    config_id: int,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Retired: the current term is the active term whose dates contain today."""
    await _get_row(db, config_id)
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="The current term is determined by its dates; edit the term's start and end dates instead",
    )
