"""
System Settings API Routes
Endpoints for managing system-wide configuration including attendance thresholds.

DOMAIN_RULES §2, §13.12:
* ``GET /attendance-policy`` (any authenticated user) exposes the effective policy, the risk
  bands and the term state, so clients never hard-code 75/85/90.
* Attendance thresholds are contiguous half-open bands ``[min, next_min)`` over 0-100%: the lowest
  band starts at 0, minimums are distinct, and the boundary between the at-risk band (second
  lowest) and the critical band (lowest) equals ``attendance_minimum``. Writes that would break
  this are rejected with 400 ``{detail: message}``. ``max_percentage`` is derived (legacy
  inclusive form ``next_min - 0.01``; ``null`` for the top band) and re-synced on every write.
* ``PUT /settings/{key}`` (admin) updates a setting; ``attendance_minimum.percentage`` must be
  in (0, 100] and moving it moves the at-risk/critical boundary with it.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, has_role, require_admin_role
from app.core.clock import app_timezone_name, app_today
from app.core.database import get_db
from app.models import User
from app.models.system_settings import AttendanceThreshold, SystemSetting
from app.services import term_service
from app.services.attendance_policy import get_attendance_policy
from app.services.face_policy import DEFAULT_FACE_POLICY, validation_errors as face_policy_validation_errors

router = APIRouter()

_EPS = 1e-9
_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
#: Policy keys that ``PUT /settings/{key}`` may create when missing.
_UPSERTABLE_KEYS = {
    "attendance_minimum": ("attendance", "Minimum attendance percentage required for exam eligibility"),
    "attendance_policy": ("attendance", "Attendance recording and auto-absent policy"),
    "academic_calendar_type": ("academic", "Academic calendar system in use"),
    "face_verification": ("security", "Face verification, liveness and proof-of-presence policy"),
}


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


class SystemSettingUpdate(BaseModel):
    value: Dict[str, Any]
    description: Optional[str] = None
    is_active: Optional[bool] = None


# Helper function to check admin access
def require_admin(current_user: User):
    """Ensure current user is an admin"""
    if not has_role(current_user, "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can modify system settings"
        )


# === BAND VALIDATION (pure) ===

def _active(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [r for r in rows if r.get("is_active", True) is not False]


def _ordered(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Active rows by ``min_percentage`` descending (best band first)."""
    return sorted(_active(rows), key=lambda r: float(r["min_percentage"]), reverse=True)


def band_structure_error(rows: List[Dict[str, Any]]) -> Optional[str]:
    """Contiguity rules without the minimum boundary: >= 2 bands, unique names, distinct
    minimums in [0, 100], lowest band starts at 0."""
    active = _active(rows)
    if len(active) < 2:
        return "At least two active bands are required: an at-risk band and a critical band"
    seen = set()
    for r in active:
        name = str(r.get("name") or "").strip().lower()
        if not name:
            return "Every band needs a name"
        if name in seen:
            return f"Band names must be unique ('{name}' is used twice)"
        seen.add(name)
        mn = float(r["min_percentage"])
        if not (0.0 <= mn <= 100.0):
            return f"min_percentage for '{name}' must be between 0 and 100"
    ordered = _ordered(rows)
    for upper, lower in zip(ordered, ordered[1:]):
        if abs(float(upper["min_percentage"]) - float(lower["min_percentage"])) < _EPS:
            return (f"Bands '{upper['name']}' and '{lower['name']}' cannot both start at "
                    f"{float(lower['min_percentage']):g}%")
    if abs(float(ordered[-1]["min_percentage"])) > _EPS:
        return (f"The lowest band ('{ordered[-1]['name']}') must start at 0% so the bands cover "
                "0-100% without gaps")
    return None


def band_validation_error(rows: List[Dict[str, Any]], minimum: float) -> Optional[str]:
    """Full rule set (Rule §2, §13.12): structure + at-risk/critical boundary == minimum."""
    error = band_structure_error(rows)
    if error:
        return error
    ordered = _ordered(rows)
    at_risk, critical = ordered[-2], ordered[-1]
    if abs(float(at_risk["min_percentage"]) - float(minimum)) > _EPS:
        return (f"The boundary between the at-risk band ('{at_risk['name']}') and the critical band "
                f"('{critical['name']}') must equal the attendance minimum ({float(minimum):g}%), not "
                f"{float(at_risk['min_percentage']):g}%. Change the attendance minimum to move it.")
    return None


def derived_max(rows: List[Dict[str, Any]], row: Dict[str, Any]) -> Optional[float]:
    """Legacy inclusive upper bound of ``row``: next higher band's min - 0.01 (``None`` = top)."""
    ordered = _ordered(rows)
    for i, r in enumerate(ordered):
        if r is row:
            return None if i == 0 else round(float(ordered[i - 1]["min_percentage"]) - 0.01, 2)
    return row.get("max_percentage")


def explicit_max_error(rows: List[Dict[str, Any]], row: Dict[str, Any], requested: Optional[float]) -> Optional[str]:
    """A client-sent ``max_percentage`` must agree with contiguity (inclusive or exclusive form)."""
    if requested is None or row.get("is_active", True) is False:
        return None
    expected = derived_max(rows, row)
    if expected is None:
        if abs(requested - 100.0) < 0.005:
            return None
        return f"'{row['name']}' is the top band; its max_percentage must be empty (or 100)"
    if abs(requested - expected) < 0.005 or abs(requested - (expected + 0.01)) < 0.005:
        return None
    return (f"max_percentage for '{row['name']}' must be {expected:g} (bands are contiguous: a band "
            "ends where the next higher band starts)")


def _row_dict(t: AttendanceThreshold) -> Dict[str, Any]:
    return {"obj": t, "id": t.id, "name": t.name, "min_percentage": float(t.min_percentage),
            "max_percentage": t.max_percentage, "is_active": t.is_active is not False}


def _resync_max(rows: List[Dict[str, Any]]) -> None:
    """Write the derived ``max_percentage`` onto every active ORM row."""
    for r in _active(rows):
        obj = r.get("obj")
        if obj is not None:
            obj.max_percentage = derived_max(rows, r)


async def _load_rows(db: AsyncSession) -> List[Dict[str, Any]]:
    result = await db.execute(select(AttendanceThreshold).order_by(AttendanceThreshold.order, AttendanceThreshold.id))
    return [_row_dict(t) for t in result.scalars().all()]


def _bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


# === POLICY ===

@router.get("/attendance-policy")
async def get_attendance_policy_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Effective attendance policy + bands + term state (any authenticated user; read-only)."""
    policy = await get_attendance_policy(db)
    ctx = await term_service.get_term_context(db)
    bands = list(policy.bands)
    out_bands = [
        {
            "name": b.name,
            "label": b.label or b.name.capitalize(),
            "min": b.min_percentage,
            "max": bands[i - 1].min_percentage if i > 0 else None,  # exclusive; null = top band
            "color": b.color,
        }
        for i, b in enumerate(bands)
    ]
    current = ctx.current_term
    return {
        "minimum_percentage": policy.minimum_percentage,
        "late_counts_as_attended": policy.late_counts_as_attended,
        "checkin_opens_minutes_before": policy.checkin_opens_minutes_before,
        "late_after_minutes": policy.late_after_minutes,
        "checkin_closes_after_minutes": policy.checkin_closes_after_minutes,
        "finalize_grace_minutes": policy.finalize_grace_minutes,
        "teacher_edit_window_days": policy.teacher_edit_window_days,
        "weekly_off_days": [_WEEKDAYS[d] for d in sorted(policy.weekly_off_days)],
        "bands": out_bands,
        "term_state": ctx.state,
        "current_term": {
            "id": current.id,
            "name": current.name,
            "start_date": current.start_date.isoformat(),
            "end_date": current.end_date.isoformat(),
            "exam_week_start": current.exam_week_start.isoformat() if current.exam_week_start else None,
            "exam_week_end": current.exam_week_end.isoformat() if current.exam_week_end else None,
        } if current else None,
        "reporting_term": ctx.term.summary() if ctx.term else None,
        "auto_absent_lookback_days": policy.auto_absent_lookback_days,
        "exam_days_suspend_classes": policy.exam_days_suspend_classes,
        "calendar_type": policy.calendar_type,
        "tracking_start_date": policy.tracking_start_date.isoformat() if policy.tracking_start_date else None,
        "timezone": app_timezone_name(),
        "today": app_today().isoformat(),
    }


# === ATTENDANCE THRESHOLD ENDPOINTS ===

@router.get("/attendance-thresholds", response_model=List[AttendanceThresholdResponse])
async def get_attendance_thresholds(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all attendance thresholds (any authenticated user)."""
    query = select(AttendanceThreshold).order_by(AttendanceThreshold.order)
    if active_only:
        query = query.where(AttendanceThreshold.is_active.is_(True))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/attendance-thresholds/{threshold_id}", response_model=AttendanceThresholdResponse)
async def get_attendance_threshold(
    threshold_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific attendance threshold by ID"""
    threshold = await db.get(AttendanceThreshold, threshold_id)
    if not threshold:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance threshold not found")
    return threshold


@router.put("/attendance-thresholds/{threshold_id}", response_model=AttendanceThresholdResponse)
async def update_attendance_threshold(
    threshold_id: int,
    threshold_update: AttendanceThresholdUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Update a threshold (Admin only). The resulting band set must stay valid (400 otherwise)."""
    require_admin(current_user)
    minimum = (await get_attendance_policy(db)).minimum_percentage
    rows = await _load_rows(db)
    target = next((r for r in rows if r["id"] == threshold_id), None)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance threshold not found")

    update_data = threshold_update.model_dump(exclude_unset=True)
    for required in ("name", "min_percentage", "color", "badge_style", "label", "order", "is_active"):
        if required in update_data and update_data[required] is None:
            raise _bad_request(f"{required} cannot be empty")
    if "name" in update_data:
        target["name"] = update_data["name"]
    if "min_percentage" in update_data:
        target["min_percentage"] = float(update_data["min_percentage"])
    if "is_active" in update_data:
        target["is_active"] = bool(update_data["is_active"])
    error = band_validation_error(rows, minimum) or explicit_max_error(rows, target, update_data.get("max_percentage"))
    if error:
        raise _bad_request(error)

    threshold = target["obj"]
    for field, value in update_data.items():
        if field != "max_percentage":
            setattr(threshold, field, value)
    _resync_max(rows)
    if not target["is_active"]:
        threshold.max_percentage = update_data.get("max_percentage", threshold.max_percentage)
    await db.commit()
    await db.refresh(threshold)
    return threshold


@router.post("/attendance-thresholds", response_model=AttendanceThresholdResponse, status_code=status.HTTP_201_CREATED)
async def create_attendance_threshold(
    threshold_data: AttendanceThresholdCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Create a band (Admin only), e.g. a tier between Good and At risk. Must keep the set valid."""
    require_admin(current_user)
    minimum = (await get_attendance_policy(db)).minimum_percentage
    rows = await _load_rows(db)
    data = threshold_data.model_dump()
    threshold = AttendanceThreshold(**data)
    threshold.is_active = True
    new_row = {"obj": threshold, "id": None, "name": data["name"], "min_percentage": float(data["min_percentage"]),
               "max_percentage": data.get("max_percentage"), "is_active": True}
    rows.append(new_row)
    error = band_validation_error(rows, minimum) or explicit_max_error(rows, new_row, data.get("max_percentage"))
    if error:
        raise _bad_request(error)
    db.add(threshold)
    _resync_max(rows)
    await db.commit()
    await db.refresh(threshold)
    return threshold


@router.delete("/attendance-thresholds/{threshold_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attendance_threshold(
    threshold_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Delete a band (Admin only); the remaining set must stay valid (400 otherwise)."""
    require_admin(current_user)
    minimum = (await get_attendance_policy(db)).minimum_percentage
    rows = await _load_rows(db)
    target = next((r for r in rows if r["id"] == threshold_id), None)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance threshold not found")
    remaining = [r for r in rows if r is not target]
    if target["is_active"]:
        error = band_validation_error(remaining, minimum)
        if error:
            raise _bad_request(error)
    await db.delete(target["obj"])
    _resync_max(remaining)
    await db.commit()


@router.post("/attendance-thresholds/reset", response_model=List[AttendanceThresholdResponse])
async def reset_attendance_thresholds(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Reset thresholds to the defaults (Admin only). The at-risk band starts at the current
    attendance minimum; higher default bands at or below it are omitted."""
    require_admin(current_user)
    minimum = float((await get_attendance_policy(db)).minimum_percentage)
    await db.execute(delete(AttendanceThreshold))

    defaults = [
        dict(name="excellent", min_percentage=90.0, color="blue", badge_style="bg-blue-500/20 text-blue-300 border-blue-400/30",
             label="Excellent", description="Outstanding attendance. Honor roll level performance.", order=1),
        dict(name="good", min_percentage=85.0, color="green", badge_style="bg-green-500/20 text-green-300 border-green-400/30",
             label="Good", description="Strong attendance. Well above the minimum requirement.", order=2),
        dict(name="warning", min_percentage=minimum, color="yellow", badge_style="bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
             label="At risk", description="Meeting the minimum requirement. Improvement recommended.", order=3),
        dict(name="critical", min_percentage=0.0, color="red", badge_style="bg-red-500/20 text-red-300 border-red-400/30",
             label="Critical", description="Below the minimum requirement. Immediate action required.", order=4),
    ]
    defaults = [d for d in defaults if d["name"] in ("warning", "critical") or d["min_percentage"] > minimum]
    rows = []
    for d in defaults:
        obj = AttendanceThreshold(max_percentage=None, is_active=True, **d)
        db.add(obj)
        rows.append({"obj": obj, "id": None, "name": d["name"], "min_percentage": d["min_percentage"], "is_active": True})
    _resync_max(rows)
    await db.commit()

    result = await db.execute(select(AttendanceThreshold).order_by(AttendanceThreshold.order))
    return result.scalars().all()


# === SYSTEM SETTINGS ENDPOINTS ===

@router.get("/settings", response_model=List[SystemSettingResponse])
async def get_system_settings(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all system settings, optionally filtered by category"""
    query = select(SystemSetting).where(SystemSetting.is_active.is_(True))
    if category:
        query = query.where(SystemSetting.category == category)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/settings/{key}", response_model=SystemSettingResponse)
async def get_system_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific system setting by key"""
    setting = (await db.execute(select(SystemSetting).where(SystemSetting.key == key))).scalars().first()
    if not setting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setting '{key}' not found")
    return setting


def _parse_minimum(value: Dict[str, Any]) -> float:
    raw = value.get("percentage")
    if raw is None or isinstance(raw, bool):
        raise _bad_request("attendance_minimum.percentage is required")
    try:
        pct = float(raw)
    except (TypeError, ValueError):
        raise _bad_request("attendance_minimum.percentage must be a number")
    if not (0.0 < pct <= 100.0):
        raise _bad_request("attendance_minimum.percentage must be greater than 0 and at most 100")
    return pct


@router.put("/settings/{key}", response_model=SystemSettingResponse)
async def update_system_setting(
    key: str,
    payload: SystemSettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Update a setting's JSON value (Admin only). ``attendance_minimum`` is validated and moves
    the at-risk/critical band boundary with it (Rule §13.12)."""
    require_admin(current_user)
    setting = (await db.execute(select(SystemSetting).where(SystemSetting.key == key))).scalars().first()
    if setting is None and key not in _UPSERTABLE_KEYS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setting '{key}' not found")

    value = dict(payload.value)
    if key == "attendance_policy":
        # Partial update: merge into the stored policy so omitted keys keep their values.
        # `tracking_start_date` marks where the new session regime begins (DOMAIN_RULES §13.1);
        # clearing or moving it would let the finalizer write retroactive absences into legacy
        # sessions, so it can never be changed through this endpoint.
        stored = dict(setting.value or {}) if setting is not None else {}
        locked = stored.get("tracking_start_date")
        requested = value.get("tracking_start_date", locked)
        if locked is not None and requested != locked:
            raise _bad_request("tracking_start_date cannot be changed; it marks when session-based tracking began")
        value = {**stored, **value}
        if locked is not None:
            value["tracking_start_date"] = locked
    if key == "face_verification":
        # Partial update merged into the stored policy (docs/system/face-verification.md §4);
        # every requested value is validated so a typo can't silently fall back to a default.
        errors = face_policy_validation_errors(value)
        if errors:
            raise _bad_request("; ".join(errors))
        stored = dict(setting.value or {}) if setting is not None else {}
        value = {**stored, **value}
        defaults = DEFAULT_FACE_POLICY.to_dict()
        eff = {**defaults, **{k: v for k, v in value.items() if k in defaults}}
        try:
            if eff["frames_max"] < eff["frames_min"]:
                raise _bad_request("frames_max must be at least frames_min")
            if eff["head_turn_min_yaw"] >= eff["max_turn_yaw"]:
                raise _bad_request("head_turn_min_yaw must be below max_turn_yaw")
            if eff["frontal_max_yaw"] >= eff["head_turn_min_yaw"]:
                raise _bad_request("frontal_max_yaw must be below head_turn_min_yaw")
            if eff["max_brightness"] <= eff["min_brightness"]:
                raise _bad_request("max_brightness must be above min_brightness")
        except TypeError:
            raise _bad_request("Stored face verification settings are invalid; send a full value")
    if key == "attendance_minimum":
        pct = _parse_minimum(value)
        value["percentage"] = pct
        rows = await _load_rows(db)
        if band_structure_error(rows) is None:
            ordered = _ordered(rows)
            if len(ordered) > 2 and pct >= float(ordered[-3]["min_percentage"]) - _EPS:
                raise _bad_request(
                    f"The attendance minimum must be below the '{ordered[-3]['name']}' band "
                    f"({float(ordered[-3]['min_percentage']):g}%); lower that band first")
            ordered[-2]["obj"].min_percentage = pct
            ordered[-2]["min_percentage"] = pct
            _resync_max(rows)

    if setting is None:
        category, description = _UPSERTABLE_KEYS[key]
        setting = SystemSetting(key=key, value=value, category=category, description=description,
                                data_type="json", is_active=True)
        db.add(setting)
    else:
        setting.value = value
    if payload.description is not None:
        setting.description = payload.description
    if payload.is_active is not None:
        setting.is_active = payload.is_active
    setting.updated_by = current_user.id
    await db.commit()
    await db.refresh(setting)
    return setting
