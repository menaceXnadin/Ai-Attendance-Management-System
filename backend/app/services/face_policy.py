"""Face verification policy loader (docs/system/face-verification.md §4).

One frozen :class:`FacePolicy` built from the ``system_settings`` key ``face_verification``.
Missing or invalid values fall back to the defaults below, so a broken setting can never
disable a check by accident (an invalid boolean keeps the secure default).

Transactions: read-only; never flushes or commits.
"""
from __future__ import annotations

import logging
import math
from dataclasses import asdict, dataclass, fields
from typing import Any, Mapping, Optional

from sqlalchemy import select

logger = logging.getLogger(__name__)

SETTING_KEY = "face_verification"


@dataclass(frozen=True)
class FacePolicy:
    match_threshold: float = 0.45
    consistency_threshold: float = 0.30
    duplicate_threshold: float = 0.45
    require_liveness: bool = True
    antispoof_threshold: float = 0.70
    require_head_turn: bool = True
    head_turn_min_yaw: float = 0.18
    frontal_max_yaw: float = 0.12
    challenge_ttl_seconds: int = 90
    frames_min: int = 3
    frames_max: int = 8
    require_presence_code: bool = True
    presence_code_period_seconds: int = 30
    max_failed_attempts: int = 5
    failed_attempt_window_minutes: int = 10
    min_detection_score: float = 0.60
    enrolment_min_detection_score: float = 0.70
    min_face_size_px: int = 80
    min_sharpness: float = 20.0
    min_brightness: float = 40.0
    max_brightness: float = 220.0
    enrolment_min_images: int = 3

    # -- derived -----------------------------------------------------------------
    @property
    def effective_frames_min(self) -> int:
        """Burst size floor: ``frames_min`` with a head turn, else 1."""
        return self.frames_min if self.require_head_turn else 1

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def public_dict(self) -> dict[str, Any]:
        """Subset served to every logged-in user (``GET /face-recognition/policy``)."""
        return {
            "require_liveness": self.require_liveness,
            "require_head_turn": self.require_head_turn,
            "require_presence_code": self.require_presence_code,
            "frames_min": self.effective_frames_min,
            "frames_max": self.frames_max,
            "challenge_ttl_seconds": self.challenge_ttl_seconds,
            "presence_code_period_seconds": self.presence_code_period_seconds,
            "enrolment_min_images": self.enrolment_min_images,
        }


DEFAULT_FACE_POLICY = FacePolicy()

# (min, max) inclusive bounds; values outside fall back to the default.
_BOUNDS: dict[str, tuple[float, float]] = {
    "match_threshold": (0.10, 0.95),
    "consistency_threshold": (0.0, 0.95),
    "duplicate_threshold": (0.10, 0.99),
    "antispoof_threshold": (0.0, 1.0),
    "head_turn_min_yaw": (0.05, 1.0),
    "frontal_max_yaw": (0.01, 0.5),
    "challenge_ttl_seconds": (15, 600),
    "frames_min": (1, 8),
    "frames_max": (1, 12),
    "presence_code_period_seconds": (10, 300),
    "max_failed_attempts": (1, 100),
    "failed_attempt_window_minutes": (1, 1440),
    "min_detection_score": (0.0, 1.0),
    "enrolment_min_detection_score": (0.0, 1.0),
    "min_face_size_px": (16, 1000),
    "min_sharpness": (0.0, 10000.0),
    "min_brightness": (0.0, 255.0),
    "max_brightness": (0.0, 255.0),
    "enrolment_min_images": (1, 8),
}


def _coerce(name: str, default: Any, raw: Any) -> Any:
    if isinstance(default, bool):
        return raw if isinstance(raw, bool) else default
    if isinstance(raw, bool) or not isinstance(raw, (int, float)):
        return default
    if isinstance(raw, float) and not math.isfinite(raw):  # json accepts Infinity/NaN
        return default
    value = int(raw) if isinstance(default, int) else float(raw)
    if isinstance(default, int) and float(raw) != int(raw):
        return default
    lo, hi = _BOUNDS.get(name, (float("-inf"), float("inf")))
    return value if lo <= value <= hi else default


def build_face_policy(raw: Optional[Mapping[str, Any]]) -> FacePolicy:
    """Pure: ``FacePolicy`` from a stored setting value (unknown keys ignored)."""
    if not isinstance(raw, Mapping):
        return DEFAULT_FACE_POLICY
    values: dict[str, Any] = {}
    for f in fields(FacePolicy):
        default = getattr(DEFAULT_FACE_POLICY, f.name)
        values[f.name] = _coerce(f.name, default, raw[f.name]) if f.name in raw else default
    # Cross-field consistency: fall back as a pair rather than produce a contradictory policy.
    if values["frames_max"] < values["frames_min"]:
        values["frames_min"], values["frames_max"] = DEFAULT_FACE_POLICY.frames_min, DEFAULT_FACE_POLICY.frames_max
    if values["max_brightness"] <= values["min_brightness"]:
        values["min_brightness"], values["max_brightness"] = DEFAULT_FACE_POLICY.min_brightness, DEFAULT_FACE_POLICY.max_brightness
    if values["frontal_max_yaw"] >= values["head_turn_min_yaw"]:
        values["frontal_max_yaw"], values["head_turn_min_yaw"] = DEFAULT_FACE_POLICY.frontal_max_yaw, DEFAULT_FACE_POLICY.head_turn_min_yaw
    return FacePolicy(**values)


def validation_errors(raw: Mapping[str, Any]) -> list[str]:
    """Human-readable problems with a requested (partial) policy value, for the settings PUT."""
    errors: list[str] = []
    known = {f.name for f in fields(FacePolicy)}
    for key, value in raw.items():
        if key not in known:
            errors.append(f"Unknown face verification setting '{key}'")
            continue
        default = getattr(DEFAULT_FACE_POLICY, key)
        if _coerce(key, default, value) != value or (isinstance(default, bool) != isinstance(value, bool)):
            lo, hi = _BOUNDS.get(key, (None, None))
            kind = "true/false" if isinstance(default, bool) else (f"a number between {lo:g} and {hi:g}" if lo is not None else "a number")
            errors.append(f"'{key}' must be {kind}")
    return errors


async def get_face_policy(db) -> FacePolicy:
    """Load the active ``face_verification`` setting (defaults when absent or inactive)."""
    from app.models.system_settings import SystemSetting

    row = (await db.execute(
        select(SystemSetting.value).where(SystemSetting.key == SETTING_KEY, SystemSetting.is_active.is_(True))
    )).first()
    return build_face_policy(row[0] if row else None)
