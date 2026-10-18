"""Instructional days & expected sessions (DOMAIN_RULES §4, §13.1 weekday mapper, §13.6)."""
from __future__ import annotations

from datetime import date, time

import pytest

from app.services.instructional_calendar import day_status, expected_sessions, weekday_to_day_of_week

from .conftest import FRI, MON, SAT, SUN, THU, TUE, WED, patch_policy, set_setting

pytestmark = pytest.mark.integration


async def _ids(db, d, **kw):
    return sorted(e.schedule_id for e in await expected_sessions(db, d, **kw))


@pytest.fixture
async def week(env, factory):
    """One schedule row per weekday Sun..Sat (09:00-10:00) for the reference cohort's subject2."""
    rows = {}
    for name in ("SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"):
        rows[name] = await factory.class_schedule(subject=env.subject2, faculty=env.faculty, day_of_week=name,
                                                  start_time="11:00", end_time="12:00", semester=1)
    return rows


def test_weekday_mapper_uses_names():
    from app.models.schedule import DayOfWeek

    assert weekday_to_day_of_week(SUN) == DayOfWeek.SUNDAY
    assert weekday_to_day_of_week(MON) == DayOfWeek.MONDAY
    assert weekday_to_day_of_week(SAT) == DayOfWeek.SATURDAY


class TestWeeklyOff:
    async def test_nepal_saturday_off_sunday_on(self, db, env, week):
        assert await _ids(db, SAT, subject_id=env.subject2.id) == []
        assert await _ids(db, SUN, subject_id=env.subject2.id) == [week["SUNDAY"].id]
        st = await day_status(db, SAT, env.faculty.id)
        assert st["instructional"] is False and st["reason"] == "weekly_off"
        assert (await day_status(db, SUN, env.faculty.id))["instructional"] is True

    async def test_international_weekend(self, db, env, week):
        await set_setting(db, "academic_calendar_type", {"type": "international"})
        assert await _ids(db, SAT, subject_id=env.subject2.id) == []
        assert await _ids(db, SUN, subject_id=env.subject2.id) == []
        assert await _ids(db, FRI, subject_id=env.subject2.id) == [week["FRIDAY"].id]

    async def test_only_matching_weekday(self, db, env):
        got = await expected_sessions(db, MON, faculty_id=env.faculty.id)
        assert [e.schedule_id for e in got] == [env.mon_schedule.id]
        assert [e.schedule_id for e in await expected_sessions(db, TUE, faculty_id=env.faculty.id)] == []

    async def test_inactive_schedule_yields_nothing(self, db, env):
        from sqlalchemy import text

        await db.execute(text("UPDATE class_schedules SET is_active = false WHERE id = :i"), {"i": env.mon_schedule.id})
        assert await expected_sessions(db, MON, faculty_id=env.faculty.id) == []

    async def test_expected_session_snapshot(self, db, env):
        (e,) = await expected_sessions(db, MON, faculty_id=env.faculty.id)
        assert (e.subject_id, e.faculty_id, e.semester, e.teacher_id, e.term_id) == (
            env.subject.id, env.faculty.id, 1, env.teacher.id, env.term.id)
        assert (e.start_time, e.end_time) == (time(9), time(10))


class TestHolidays:
    async def test_multi_day_holiday_covers_every_day(self, db, env, factory, week):
        await factory.holiday(start_date=MON, end_date=WED)
        for d in (MON, TUE, WED):
            assert await _ids(db, d, faculty_id=env.faculty.id) == [], d
            assert (await day_status(db, d, env.faculty.id))["reason"] == "holiday"
        assert await _ids(db, THU, subject_id=env.subject2.id) == [week["THURSDAY"].id]
        assert await _ids(db, SUN, subject_id=env.subject2.id) == [week["SUNDAY"].id]

    async def test_faculty_scoped_holiday_does_not_affect_other_faculties(self, db, env, factory):
        other_subject = await factory.subject(faculty=env.other_faculty)
        other_sched = await factory.class_schedule(subject=other_subject, faculty=env.other_faculty, day_of_week="MONDAY")
        await factory.holiday(start_date=MON, faculty=env.faculty)
        assert await _ids(db, MON, faculty_id=env.faculty.id) == []
        assert await _ids(db, MON, faculty_id=env.other_faculty.id) == [other_sched.id]
        assert (await day_status(db, MON, env.other_faculty.id))["instructional"] is True

    async def test_subject_scoped_holiday(self, db, env, factory):
        s2 = await factory.class_schedule(subject=env.subject2, faculty=env.faculty, day_of_week="MONDAY",
                                          start_time="11:00", end_time="12:00")
        await factory.holiday(start_date=MON, faculty=env.faculty, subject=env.subject)
        assert await _ids(db, MON, faculty_id=env.faculty.id) == [s2.id]

    async def test_timed_holiday_suppresses_only_overlapping_slots(self, db, env, factory):
        s10 = await factory.class_schedule(subject=env.subject2, faculty=env.faculty, day_of_week="MONDAY",
                                           start_time="10:00", end_time="11:00")
        s13 = await factory.class_schedule(subject=env.subject2, faculty=env.faculty, day_of_week="MONDAY",
                                           start_time="13:00", end_time="14:00")
        await factory.holiday(start_date=MON, start_time="08:00", end_time="10:00", holiday_type="HALF_DAY")
        # 09:00-10:00 overlaps; 10:00-11:00 only touches the boundary (half-open); 13:00 untouched
        assert await _ids(db, MON, faculty_id=env.faculty.id) == sorted([s10.id, s13.id])

    async def test_half_day_without_times_is_full_day(self, db, env, factory):
        await factory.class_schedule(subject=env.subject2, faculty=env.faculty, day_of_week="MONDAY",
                                     start_time="15:00", end_time="16:00")
        await factory.holiday(start_date=MON, holiday_type="HALF_DAY")
        assert await _ids(db, MON, faculty_id=env.faculty.id) == []

    async def test_two_holidays_same_day_do_not_crash(self, db, env, factory):
        await factory.holiday(start_date=MON)
        await factory.holiday(start_date=MON, end_date=TUE, faculty=env.faculty)
        assert await _ids(db, MON, faculty_id=env.faculty.id) == []
        st = await day_status(db, MON, env.faculty.id)
        assert st["reason"] == "holiday" and len(st["events"]) == 2

    async def test_inactive_holiday_ignored(self, db, env, factory):
        await factory.holiday(start_date=MON, is_active=False)
        assert await _ids(db, MON, faculty_id=env.faculty.id) == [env.mon_schedule.id]


class TestOtherEvents:
    async def test_class_markers_not_required(self, db, env):
        # no CLASS events exist at all
        assert await _ids(db, MON, faculty_id=env.faculty.id) == [env.mon_schedule.id]

    async def test_class_and_special_events_do_not_suppress(self, db, env, factory):
        await factory.academic_event(event_type="CLASS", start_date=MON, faculty=env.faculty)
        await factory.academic_event(event_type="SPECIAL_EVENT", start_date=MON)
        assert await _ids(db, MON, faculty_id=env.faculty.id) == [env.mon_schedule.id]

    async def test_exam_event_suppresses_unless_attendance_required(self, db, env, factory):
        await factory.exam(start_date=MON, faculty=env.faculty)
        assert await _ids(db, MON, faculty_id=env.faculty.id) == []
        await factory.exam(start_date=WED, faculty=env.faculty, attendance_required=True)
        assert await _ids(db, WED, faculty_id=env.faculty.id) == [env.wed_schedule.id]

    async def test_exam_event_ignored_when_suspension_disabled(self, db, env, factory):
        await patch_policy(db, exam_days_suspend_classes=False)
        await factory.exam(start_date=MON)
        assert await _ids(db, MON, faculty_id=env.faculty.id) == [env.mon_schedule.id]

    async def test_cancelled_class_event_materializes_cancelled(self, db, env, factory, frozen_now):
        from app.services.class_sessions import materialize_sessions

        from .conftest import at, sessions_on

        frozen_now(at(MON, 7))
        ev = await factory.cancelled_class(start_date=MON, faculty=env.faculty, subject=env.subject)
        await materialize_sessions(db, MON, MON)
        (s,) = await sessions_on(db, MON, faculty_id=env.faculty.id)
        assert s.status == "cancelled" and s.cancelled_by_event_id == ev.id
