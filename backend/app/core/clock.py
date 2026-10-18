"""Single application clock (DOMAIN_RULES §1).

Every "today/now" business decision goes through this module so that

* all decisions use ``settings.app_timezone`` (default ``Asia/Kathmandu``), never the host's
  local time (a UTC container would otherwise shift every class boundary by 5h45m), and
* tests can freeze time through ONE injectable hook (``set_now_provider`` /
  ``reset_now_provider``) instead of monkeypatching ``datetime``.

Schedule times (``class_schedules.start_time/end_time``, ``class_sessions.*_time``) are local
wall-clock times in APP_TIMEZONE; ``combine_local`` turns (date, time) into an aware instant.

Timezone lookup (no extra dependencies): ``zoneinfo`` -> ``dateutil.tz`` -> fixed offset for
Asia/Kathmandu (+05:45, Nepal has no DST) -> UTC (logged once).
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from typing import Callable, Optional

logger = logging.getLogger(__name__)

DEFAULT_APP_TIMEZONE = "Asia/Kathmandu"

#: Fixed offsets used only when no tz database is available at all.
_FIXED_OFFSETS = {
    "Asia/Kathmandu": timedelta(hours=5, minutes=45),
    "Asia/Katmandu": timedelta(hours=5, minutes=45),
    "UTC": timedelta(0),
    "Etc/UTC": timedelta(0),
}

_tz_cache: dict[str, tzinfo] = {}
_now_provider: Optional[Callable[[], datetime]] = None


def app_timezone_name() -> str:
    """The configured timezone name (``settings.app_timezone``; env ``APP_TIMEZONE``)."""
    try:
        from app.core.config import settings

        name = getattr(settings, "app_timezone", None)
        if name:
            return str(name)
    except Exception:  # pragma: no cover - settings unavailable (e.g. isolated unit tests)
        pass
    return os.environ.get("APP_TIMEZONE") or DEFAULT_APP_TIMEZONE


def resolve_timezone(name: str) -> tzinfo:
    """Return a tzinfo for ``name`` (cached). See module docstring for the fallback order."""
    cached = _tz_cache.get(name)
    if cached is not None:
        return cached
    tz: Optional[tzinfo] = None
    try:
        from zoneinfo import ZoneInfo

        tz = ZoneInfo(name)
    except Exception:
        tz = None
    if tz is None:
        try:
            from dateutil import tz as dateutil_tz

            tz = dateutil_tz.gettz(name)
        except Exception:
            tz = None
    if tz is None:
        offset = _FIXED_OFFSETS.get(name)
        if offset is not None:
            tz = timezone(offset, name)
            logger.warning("No tz database entry for %r; using fixed offset %s", name, offset)
        else:
            tz = timezone.utc
            logger.warning("Unknown timezone %r and no tz database; falling back to UTC", name)
    _tz_cache[name] = tz
    return tz


def get_app_tz() -> tzinfo:
    """The application timezone object (cached)."""
    return resolve_timezone(app_timezone_name())


# --------------------------------------------------------------------------- test hook
def set_now_provider(fn: Optional[Callable[[], datetime]]) -> None:
    """Install a callable returning "now" (tests). ``None`` restores the real clock.

    The provider may return a naive datetime (interpreted as APP_TIMEZONE wall-clock time) or
    an aware datetime in any zone (converted to APP_TIMEZONE).
    """
    global _now_provider
    _now_provider = fn


def reset_now_provider() -> None:
    """Restore the real clock."""
    set_now_provider(None)


# --------------------------------------------------------------------------- public API
def to_app_tz(dt: datetime, *, assume_tz: tzinfo = timezone.utc) -> datetime:
    """Convert ``dt`` to APP_TIMEZONE. Naive values are interpreted in ``assume_tz``
    (default UTC, matching the ``datetime.utcnow`` defaults used by several legacy models)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=assume_tz)
    return dt.astimezone(get_app_tz())


def app_now() -> datetime:
    """Current instant, tz-aware, in APP_TIMEZONE (Rule §1)."""
    if _now_provider is not None:
        value = _now_provider()
        if value.tzinfo is None:
            return value.replace(tzinfo=get_app_tz())
        return value.astimezone(get_app_tz())
    return datetime.now(timezone.utc).astimezone(get_app_tz())


def app_today() -> date:
    """Today's date in APP_TIMEZONE (Rule §1). Never use ``date.today()`` for business dates."""
    return app_now().date()


def utc_now() -> datetime:
    """``app_now()`` expressed in UTC (convenient for timestamptz columns)."""
    return app_now().astimezone(timezone.utc)


def combine_local(d: date, t: time) -> datetime:
    """Aware datetime for local wall-clock ``t`` on date ``d`` in APP_TIMEZONE (Rule §1)."""
    tz = get_app_tz()
    naive = datetime.combine(d, t.replace(tzinfo=None))
    try:
        return naive.replace(tzinfo=tz)
    except Exception:  # pragma: no cover - defensive
        return naive.replace(tzinfo=timezone.utc).astimezone(tz)


def local_naive(dt: datetime) -> datetime:
    """APP_TIMEZONE wall-clock time of ``dt`` without tzinfo.

    Used to compare with SQL expressions such as ``session_date + end_time`` (a ``timestamp
    without time zone`` holding local wall-clock time) without relying on the DB session TZ.
    """
    return to_app_tz(dt).replace(tzinfo=None)


__all__ = [
    "DEFAULT_APP_TIMEZONE",
    "app_timezone_name",
    "resolve_timezone",
    "get_app_tz",
    "set_now_provider",
    "reset_now_provider",
    "to_app_tz",
    "app_now",
    "app_today",
    "utc_now",
    "combine_local",
    "local_naive",
]
