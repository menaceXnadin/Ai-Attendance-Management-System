"""One clock (DOMAIN_RULES §1): every business decision uses Asia/Kathmandu, whatever zone "now" is in."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

import pytest

from app.core import clock

from .conftest import MON


def test_app_today_uses_kathmandu_not_utc(frozen_now):
    frozen_now(datetime(2026, 3, 1, 18, 30, tzinfo=timezone.utc))  # 00:15 on Mar 2 in Kathmandu
    assert clock.app_today() == date(2026, 3, 2)
    assert clock.app_now().utcoffset() == timedelta(hours=5, minutes=45)


def test_combine_local_is_kathmandu_wall_clock():
    dt = clock.combine_local(MON, time(9, 0))
    assert dt.utcoffset() == timedelta(hours=5, minutes=45)
    assert dt.astimezone(timezone.utc) == datetime(2026, 3, 2, 3, 15, tzinfo=timezone.utc)


def test_reset_restores_real_clock(frozen_now):
    frozen_now(datetime(2001, 1, 1, 12, 0))
    assert clock.app_today() == date(2001, 1, 1)
    clock.reset_now_provider()
    assert clock.app_today().year >= 2025


@pytest.mark.integration
async def test_checkin_decision_with_utc_now(db, env, mon_session, frozen_now):
    from app.services.attendance_recording import student_self_checkin

    frozen_now(datetime(2026, 3, 2, 3, 20, tzinfo=timezone.utc))  # 09:05 Kathmandu
    res = await student_self_checkin(db, student=env.s1, session=mon_session)
    assert res.statuses[env.s1.id] == "present"
