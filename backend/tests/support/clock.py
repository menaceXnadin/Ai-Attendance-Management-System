"""Frozen-clock support built on ``app.core.clock.set_now_provider`` (DOMAIN_RULES §1).

The clock module is written by another agent; until it exists, ``clock_module()`` returns
None and the ``frozen_now`` fixture skips the test.
"""
from __future__ import annotations

import importlib
from datetime import datetime, timedelta, timezone, tzinfo
from types import ModuleType

from .testenv import APP_TIMEZONE


def clock_module() -> ModuleType | None:
    try:
        module = importlib.import_module("app.core.clock")
    except ModuleNotFoundError as exc:
        if exc.name in ("app.core.clock",):
            return None
        raise
    return module if hasattr(module, "set_now_provider") else None


def app_tz() -> tzinfo:
    """Asia/Kathmandu. Windows has no system tz database and ``tzdata`` is not installed,
    so fall back to dateutil's bundled zoneinfo, then to the fixed +05:45 offset (no DST)."""
    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo(APP_TIMEZONE)
    except Exception:
        pass
    try:
        from dateutil import tz

        found = tz.gettz(APP_TIMEZONE)
        if found is not None:
            return found
    except Exception:
        pass
    return timezone(timedelta(hours=5, minutes=45), "Asia/Kathmandu")


def reset_clock() -> None:
    module = clock_module()
    if module is None:
        return
    if hasattr(module, "reset_now_provider"):
        module.reset_now_provider()
    else:
        module.set_now_provider(None)


class FrozenClock:
    """Holds the frozen instant; ``app_now()`` returns ``clock.now`` until changed."""

    def __init__(self, module: ModuleType, dt: datetime):
        self._module = module
        self.now = self._aware(dt)
        module.set_now_provider(self._provide)

    @staticmethod
    def _aware(dt: datetime) -> datetime:
        return dt.replace(tzinfo=app_tz()) if dt.tzinfo is None else dt

    def _provide(self) -> datetime:
        return self.now

    def set(self, dt: datetime) -> "FrozenClock":
        self.now = self._aware(dt)
        return self

    def advance(self, **delta: float) -> "FrozenClock":
        self.now = self.now + timedelta(**delta)
        return self

    def today(self):
        return self.now.date()
