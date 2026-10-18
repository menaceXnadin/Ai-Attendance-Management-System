"""Attendance policy loader (DOMAIN_RULES §2, amended by §13.9 and §13.12).

One frozen :class:`AttendancePolicy` built from ``system_settings`` + ``attendance_thresholds``
with safe defaults for missing/invalid values. Pure helpers (``build_policy``,
``normalize_bands``, ``band_for``, ``band_for_fraction``, ``eligible``, ``percentage``) carry
the decision logic; ``get_attendance_policy(db)`` is the thin async loader.

Transactions: read-only; never flushes or commits.

Settings read (all optional):

* ``attendance_minimum``      -> ``{"percentage": 75.0}``
* ``academic_calendar_type``  -> ``{"type": "nepal"|"international", "weekly_off_days": ["saturday", ...]}``
* ``attendance_policy``       -> ``{"checkin_opens_minutes_before": 10, "checkin_closes_after_minutes": 20,
  "late_after_minutes": 10, "finalize_grace_minutes": 15, "teacher_edit_window_days": 7,
  "late_counts_as_attended": true, "auto_absent_lookback_days": 7,
  "exam_days_suspend_classes": true, "tracking_start_date": "YYYY-MM-DD"}``
* ``attendance_thresholds`` table (active rows) -> bands.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field, replace
from datetime import date
from fractions import Fraction
from typing import Any, Iterable, Mapping, Optional, Sequence, Union

logger = logging.getLogger(__name__)

Number = Union[int, float, Fraction]

# ----------------------------------------------------------------------------- bands


@dataclass(frozen=True)
class Band:
    """A half-open percentage band ``[min_percentage, next_band.min_percentage)`` (Rule §2)."""

    name: str
    min_percentage: float
    label: str = ""
    color: str = ""
    order: int = 0

    def to_dict(self, max_percentage: Optional[float] = None) -> dict[str, Any]:
        return {
            "name": self.name,
            "label": self.label or self.name.capitalize(),
            "min_percentage": self.min_percentage,
            "max_percentage_exclusive": max_percentage,
            "color": self.color,
            "order": self.order,
        }


DEFAULT_BANDS: tuple[Band, ...] = (
    Band("excellent", 90.0, "Excellent", "blue", 1),
    Band("good", 85.0, "Good", "green", 2),
    Band("warning", 75.0, "At risk", "yellow", 3),
    Band("critical", 0.0, "Critical", "red", 4),
)

DEFAULT_MINIMUM_PERCENTAGE = 75.0

_WEEKDAY_NAMES = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1, "tues": 1,
    "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3, "thur": 3, "thurs": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6,
}

# ----------------------------------------------------------------------------- policy


@dataclass(frozen=True)
class AttendancePolicy:
    """Frozen attendance policy (Rule §2 table + §13.9 ``checkin_closes_after_minutes`` +
    §13.1 ``tracking_start_date``). Weekday ints use Python's convention (Mon=0 .. Sun=6)."""

    minimum_percentage: float = DEFAULT_MINIMUM_PERCENTAGE
    weekly_off_days: frozenset = frozenset({5})
    checkin_opens_minutes_before: int = 10
    checkin_closes_after_minutes: int = 20
    late_after_minutes: int = 10
    finalize_grace_minutes: int = 15
    teacher_edit_window_days: int = 7
    late_counts_as_attended: bool = True
    auto_absent_lookback_days: int = 7
    exam_days_suspend_classes: bool = True
    tracking_start_date: Optional[date] = None
    calendar_type: str = "nepal"
    bands: tuple = field(default=DEFAULT_BANDS)

    def to_dict(self) -> dict[str, Any]:
        """Public representation (``GET /api/attendance-policy``)."""
        bands = list(self.bands)
        out_bands = []
        for i, b in enumerate(bands):
            upper = bands[i - 1].min_percentage if i > 0 else None
            out_bands.append(b.to_dict(upper))
        data = {k: v for k, v in asdict(self).items() if k not in ("bands", "weekly_off_days", "tracking_start_date")}
        data["weekly_off_days"] = sorted(self.weekly_off_days)
        data["weekly_off_day_names"] = [_weekday_name(d) for d in sorted(self.weekly_off_days)]
        data["tracking_start_date"] = self.tracking_start_date.isoformat() if self.tracking_start_date else None
        data["bands"] = out_bands
        return data


def _weekday_name(d: int) -> str:
    return ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][d]


# ----------------------------------------------------------------------------- pure helpers


def percentage(attended: int, considered: int) -> Optional[float]:
    """Exact (unrounded) percentage, or ``None`` when nothing is considered (Rule §8).

    Never returns 0 for "no data" and never divides by zero.
    """
    if not considered:
        return None
    return attended * 100.0 / considered


def display_percentage(attended: int, considered: int) -> Optional[float]:
    """``percentage`` rounded to 2 decimals for API output (Rule §8: rounding is display-only)."""
    pct = percentage(attended, considered)
    return None if pct is None else round(pct, 2)


def _to_fraction(value: Number) -> Fraction:
    if isinstance(value, Fraction):
        return value
    if isinstance(value, int):
        return Fraction(value)
    # repr() gives the shortest decimal that round-trips, so 66.67 -> 6667/100 exactly.
    return Fraction(repr(float(value)))


def eligible(attended: int, considered: int, minimum_percentage: Number) -> Optional[bool]:
    """Exam eligibility on the exact fraction (Rule §8, §13.12).

    ``attended / considered >= minimum / 100`` with no rounding; ``None`` when considered == 0.
    """
    if not considered:
        return None
    return Fraction(attended * 100, considered) >= _to_fraction(minimum_percentage)


def band_for(pct: Optional[Number], bands: Sequence[Band] = DEFAULT_BANDS) -> Optional[Band]:
    """The band whose half-open interval contains ``pct`` (Rule §2). ``None`` for ``None``.

    ``bands`` must be sorted by ``min_percentage`` descending (as produced by ``normalize_bands``).
    Values below every band fall into the lowest band.
    """
    if pct is None or not bands:
        return None
    value = _to_fraction(pct)
    for band in bands:
        if value >= _to_fraction(band.min_percentage):
            return band
    return bands[-1]


def band_for_fraction(attended: int, considered: int, bands: Sequence[Band] = DEFAULT_BANDS) -> Optional[Band]:
    """``band_for`` applied to the exact fraction ``attended/considered`` (Rule §8)."""
    if not considered:
        return None
    return band_for(Fraction(attended * 100, considered), bands)


def parse_weekly_off_days(calendar_value: Any) -> frozenset:
    """Weekly off days from the ``academic_calendar_type`` setting (Rule §2).

    ``nepal`` -> {Sat}; ``international``/other -> {Sat, Sun}; an explicit ``weekly_off_days``
    list (names, abbreviations or 0..6 ints) overrides. Missing/invalid -> {Sat}.
    """
    if not isinstance(calendar_value, Mapping):
        return frozenset({5})
    explicit = calendar_value.get("weekly_off_days")
    if isinstance(explicit, (list, tuple)):
        days: set[int] = set()
        valid = True
        for item in explicit:
            if isinstance(item, bool):
                valid = False
                break
            if isinstance(item, int) and 0 <= item <= 6:
                days.add(item)
            elif isinstance(item, str) and item.strip().lower() in _WEEKDAY_NAMES:
                days.add(_WEEKDAY_NAMES[item.strip().lower()])
            else:
                valid = False
                break
        if valid and len(days) < 7:
            return frozenset(days)
        logger.warning("Ignoring invalid academic_calendar_type.weekly_off_days=%r", explicit)
    cal_type = str(calendar_value.get("type") or "nepal").strip().lower()
    if cal_type == "nepal":
        return frozenset({5})
    return frozenset({5, 6})


def normalize_bands(rows: Iterable[Mapping[str, Any]], minimum_percentage: float) -> tuple[Band, ...]:
    """Validate threshold rows into contiguous half-open bands (Rule §2, §13.12).

    Rules: active rows only; numeric ``min_percentage`` in [0, 100]; unique names; distinct
    minimums; the lowest band starts at 0 (so the bands are contiguous over [0, 100]). Otherwise
    the defaults are used. Then the boundary between the at-risk band (second lowest) and the
    critical band (lowest) is forced to ``minimum_percentage``; bands above it whose interval
    would become empty (``min <= minimum``) are dropped.
    """
    active_rows = [row for row in rows if row.get("is_active") is not False]
    bands: list[Band] = []
    try:
        if not active_rows:
            raise LookupError("no threshold rows")
        for row in active_rows:
            name = str(row.get("name") or "").strip().lower()
            raw_min = row.get("min_percentage")
            if not name or isinstance(raw_min, bool) or raw_min is None:
                raise ValueError("band without name/min")
            mn = float(raw_min)
            if not (0.0 <= mn <= 100.0):
                raise ValueError(f"band {name} min out of range")
            bands.append(Band(
                name=name,
                min_percentage=mn,
                label=str(row.get("label") or name.capitalize()),
                color=str(row.get("color") or ""),
                order=int(row.get("order") or 0),
            ))
        bands.sort(key=lambda b: b.min_percentage, reverse=True)
        names = [b.name for b in bands]
        mins = [b.min_percentage for b in bands]
        if len(bands) < 2 or len(set(names)) != len(names) or len(set(mins)) != len(mins) or mins[-1] != 0.0:
            raise ValueError("bands not contiguous/unique")
    except LookupError:
        bands = list(DEFAULT_BANDS)
    except (TypeError, ValueError) as exc:
        logger.warning("Invalid attendance_thresholds (%s); using default bands", exc)
        bands = list(DEFAULT_BANDS)

    return _enforce_minimum_boundary(bands, minimum_percentage)


def _enforce_minimum_boundary(bands: list[Band], minimum_percentage: float) -> tuple[Band, ...]:
    """Force the at-risk/critical boundary to ``minimum_percentage`` (Rule §13.12)."""
    if len(bands) < 2:
        bands = list(DEFAULT_BANDS)
    critical = bands[-1]
    at_risk = replace(bands[-2], min_percentage=float(minimum_percentage))
    upper = [b for b in bands[:-2] if b.min_percentage > minimum_percentage]
    return tuple(upper + [at_risk, critical])


def _as_int(value: Any, default: int, *, lo: int = 0, hi: int = 10_000) -> int:
    if isinstance(value, bool) or value is None:
        return default
    if isinstance(value, float) and not value.is_integer():
        return default
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return number if lo <= number <= hi else default


def _as_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str) and value.strip().lower() in ("true", "false", "1", "0", "yes", "no"):
        return value.strip().lower() in ("true", "1", "yes")
    return default


def _as_date(value: Any) -> Optional[date]:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value.strip()[:10])
        except ValueError:
            return None
    return None


def build_policy(settings_map: Mapping[str, Any], threshold_rows: Iterable[Mapping[str, Any]] = ()) -> AttendancePolicy:
    """Pure constructor: ``settings_map`` maps setting key -> JSON value (Rule §2)."""
    defaults = AttendancePolicy()

    minimum = defaults.minimum_percentage
    min_value = settings_map.get("attendance_minimum")
    raw_min = min_value.get("percentage") if isinstance(min_value, Mapping) else min_value
    if raw_min is not None and not isinstance(raw_min, bool):
        try:
            candidate = float(raw_min)
            if 0.0 < candidate <= 100.0:
                minimum = candidate
            else:
                logger.warning("attendance_minimum %r out of range; using %s", raw_min, minimum)
        except (TypeError, ValueError):
            logger.warning("attendance_minimum %r invalid; using %s", raw_min, minimum)

    calendar_value = settings_map.get("academic_calendar_type")
    weekly_off = parse_weekly_off_days(calendar_value)
    cal_type = "nepal"
    if isinstance(calendar_value, Mapping) and calendar_value.get("type"):
        cal_type = str(calendar_value.get("type")).strip().lower()

    p = settings_map.get("attendance_policy")
    p = p if isinstance(p, Mapping) else {}

    return AttendancePolicy(
        minimum_percentage=minimum,
        weekly_off_days=weekly_off,
        checkin_opens_minutes_before=_as_int(p.get("checkin_opens_minutes_before"), defaults.checkin_opens_minutes_before, hi=240),
        checkin_closes_after_minutes=_as_int(p.get("checkin_closes_after_minutes"), defaults.checkin_closes_after_minutes, lo=1, hi=600),
        late_after_minutes=_as_int(p.get("late_after_minutes"), defaults.late_after_minutes, hi=600),
        finalize_grace_minutes=_as_int(p.get("finalize_grace_minutes"), defaults.finalize_grace_minutes, hi=24 * 60),
        teacher_edit_window_days=_as_int(p.get("teacher_edit_window_days"), defaults.teacher_edit_window_days, hi=366),
        late_counts_as_attended=_as_bool(p.get("late_counts_as_attended"), defaults.late_counts_as_attended),
        auto_absent_lookback_days=_as_int(p.get("auto_absent_lookback_days"), defaults.auto_absent_lookback_days, hi=366),
        exam_days_suspend_classes=_as_bool(p.get("exam_days_suspend_classes"), defaults.exam_days_suspend_classes),
        tracking_start_date=_as_date(p.get("tracking_start_date")),
        calendar_type=cal_type,
        bands=normalize_bands(list(threshold_rows), minimum),
    )


# ----------------------------------------------------------------------------- async loader

POLICY_SETTING_KEYS = ("attendance_minimum", "academic_calendar_type", "attendance_policy")


async def get_attendance_policy(db) -> AttendancePolicy:
    """Load the policy from ``system_settings`` + active ``attendance_thresholds`` (Rule §2).

    Inactive/missing settings fall back to defaults. Read-only.
    """
    from sqlalchemy import select

    from app.models import AttendanceThreshold, SystemSetting

    result = await db.execute(
        select(SystemSetting.key, SystemSetting.value, SystemSetting.is_active).where(
            SystemSetting.key.in_(POLICY_SETTING_KEYS)
        )
    )
    settings_map: dict[str, Any] = {}
    for key, value, is_active in result.all():
        if is_active is False:
            continue
        settings_map[key] = value

    rows = await db.execute(
        select(
            AttendanceThreshold.name,
            AttendanceThreshold.min_percentage,
            AttendanceThreshold.label,
            AttendanceThreshold.color,
            AttendanceThreshold.order,
            AttendanceThreshold.is_active,
        )
    )
    threshold_rows = [
        {"name": n, "min_percentage": mn, "label": lb, "color": c, "order": o, "is_active": a}
        for n, mn, lb, c, o, a in rows.all()
        if a is not False
    ]
    return build_policy(settings_map, threshold_rows)


__all__ = [
    "Band",
    "DEFAULT_BANDS",
    "DEFAULT_MINIMUM_PERCENTAGE",
    "AttendancePolicy",
    "percentage",
    "display_percentage",
    "eligible",
    "band_for",
    "band_for_fraction",
    "parse_weekly_off_days",
    "normalize_bands",
    "build_policy",
    "get_attendance_policy",
]
