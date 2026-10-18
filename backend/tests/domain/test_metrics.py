"""Metrics — the only percentage implementation (DOMAIN_RULES §8, §13.4, §13.5, §13.7, §13.12)."""
from __future__ import annotations

from datetime import date, time, timedelta

import pytest

from app.services.attendance_metrics import (
    compute_cohort_subject_metrics,
    compute_student_day_statuses,
    compute_student_metrics,
    compute_students_overall,
)

from .conftest import (
    FRI,
    MON,
    NEXT_MON,
    SAT,
    SUN,
    THU,
    TUE,
    WED,
    at,
    insert_record,
    insert_session,
    patch_policy,
)

pytestmark = pytest.mark.integration

REPORT_NOW = at(date(2026, 3, 20), 12)  # Friday, inside the reference term


def _subject(m, subject_id):
    return next(s for s in m.per_subject if s["subject_id"] == subject_id)


async def _sess(factory, env, d, *, subject=None, status="held", start=time(9), end=time(10), **kw):
    return await insert_session(factory, subject=subject or env.subject, faculty=env.faculty, session_date=d,
                                status=status, start=start, end=end, teacher=env.teacher, term=env.term, **kw)


class TestCountable:
    async def test_only_held_non_excluded_present_late_absent_count(self, db, env, factory, frozen_now):
        frozen_now(REPORT_NOW)
        held1 = await _sess(factory, env, MON)
        held2 = await _sess(factory, env, WED)
        held3 = await _sess(factory, env, NEXT_MON)
        held4 = await _sess(factory, env, date(2026, 3, 11))
        scheduled = await _sess(factory, env, date(2026, 3, 16), status="scheduled")
        cancelled = await _sess(factory, env, date(2026, 3, 18), status="cancelled", cancellation_reason="x")
        await insert_record(factory, student=env.s1, session=held1, status="present")
        await insert_record(factory, student=env.s1, session=held2, status="absent", source="system_auto")
        await insert_record(factory, student=env.s1, session=held3, status="excused", source="admin")
        await insert_record(factory, student=env.s1, session=held4, status="present",
                            excluded_from_metrics=True, exclusion_reason="admin")
        await insert_record(factory, student=env.s1, session=scheduled, status="present")  # session not held
        await insert_record(factory, student=env.s1, session=cancelled, status="absent")  # session cancelled
        # legacy record without a session is history only
        await factory.attendance_record(student=env.s1, subject=env.subject, date=date(2026, 3, 13), status="absent",
                                        source="legacy")

        m = await compute_student_metrics(db, env.s1.id)
        o = m.overall
        assert (o["present"], o["late"], o["absent"]) == (1, 0, 1)
        assert o["considered"] == 2 and o["attended"] == 1 and o["percentage"] == 50.0
        assert o["excused"] == 1 and o["total_classes"] == 3  # considered + excused
        assert o["cancelled_sessions"] == 1
        assert o["unrecorded"] == 1  # the scheduled Mar 16 session
        assert o["eligibility_provisional"] is True

    async def test_no_data_is_null(self, db, env, frozen_now):
        frozen_now(REPORT_NOW)
        m = await compute_student_metrics(db, env.s1.id)
        o = m.overall
        assert o["percentage"] is None and o["has_data"] is False and o["eligible"] is None and o["band"] is None
        assert o["percentage_present"] == 0 and o["attendance_rate"] == 0 and o["total_classes"] == 0
        d = m.to_dict()
        assert d["percentage"] is None and d["percentage_present"] == 0 and d["term_state"] == "active"
        assert d["term"]["id"] == env.term.id

    async def test_session_weighted_overall_not_average_of_subjects(self, db, env, factory, frozen_now):
        frozen_now(REPORT_NOW)
        a = await _sess(factory, env, MON)
        await insert_record(factory, student=env.s1, session=a, status="present")
        for i, d in enumerate((MON, WED, NEXT_MON)):
            s = await _sess(factory, env, d, subject=env.subject2, start=time(11), end=time(12))
            await insert_record(factory, student=env.s1, session=s, status="present" if i == 0 else "absent")
        m = await compute_student_metrics(db, env.s1.id)
        assert _subject(m, env.subject.id)["percentage"] == 100.0
        assert _subject(m, env.subject2.id)["percentage"] == 33.33
        assert m.overall["percentage"] == 50.0  # 2/4, not (100 + 33.33) / 2
        assert m.overall["eligible"] is False and m.overall["all_subjects_eligible"] is False

    async def test_eligibility_exact_fraction_per_subject(self, db, env, factory, frozen_now):
        frozen_now(REPORT_NOW)
        for i, d in enumerate((MON, WED, NEXT_MON, date(2026, 3, 11))):
            s = await _sess(factory, env, d)
            await insert_record(factory, student=env.s1, session=s, status="absent" if i == 0 else "present")
        m = await compute_student_metrics(db, env.s1.id)
        sub = _subject(m, env.subject.id)
        assert sub["percentage"] == 75.0 and sub["eligible"] is True and sub["band"] == "warning"


class TestPolicyEffects:
    async def _setup(self, factory, env):
        statuses = ["present", "late", "absent", "absent"]
        for d, st in zip((MON, WED, NEXT_MON, date(2026, 3, 11)), statuses):
            s = await _sess(factory, env, d)
            await insert_record(factory, student=env.s1, session=s, status=st)

    async def test_late_counts(self, db, env, factory, frozen_now):
        frozen_now(REPORT_NOW)
        await self._setup(factory, env)
        assert (await compute_student_metrics(db, env.s1.id)).overall["percentage"] == 50.0

    async def test_late_does_not_count(self, db, env, factory, frozen_now):
        frozen_now(REPORT_NOW)
        await patch_policy(db, late_counts_as_attended=False)
        await self._setup(factory, env)
        o = (await compute_student_metrics(db, env.s1.id)).overall
        assert o["percentage"] == 25.0 and o["considered"] == 4 and o["late"] == 1

    async def test_minimum_from_settings(self, db, env, factory, frozen_now):
        from .conftest import set_setting

        frozen_now(REPORT_NOW)
        await set_setting(db, "attendance_minimum", {"percentage": 50})
        await self._setup(factory, env)
        o = (await compute_student_metrics(db, env.s1.id)).overall
        assert o["eligible"] is True and o["band"] != "critical"


class TestWindow:
    async def test_enrollment_window_clips_records(self, db, env, factory, frozen_now):
        frozen_now(REPORT_NOW)
        joiner = await factory.student(faculty=env.faculty, semester=1, enrolled_on=WED)
        mon = await _sess(factory, env, MON)
        wed = await _sess(factory, env, WED)
        await insert_record(factory, student=joiner, session=mon, status="absent", source="system_auto")
        await insert_record(factory, student=joiner, session=wed, status="present")
        o = (await compute_student_metrics(db, joiner.id)).overall
        assert o["considered"] == 1 and o["percentage"] == 100.0
        batch = await compute_students_overall(db, [joiner.id])
        assert batch["students"][joiner.id]["considered"] == 1

    async def test_unrecorded_counts_only_from_roster_start_and_past_grace(self, db, env, factory, frozen_now):
        frozen_now(at(WED, 10, 20))
        joiner = await factory.student(faculty=env.faculty, semester=1, enrolled_on=TUE)
        await _sess(factory, env, MON, status="scheduled")  # before joiner's enrollment
        await _sess(factory, env, WED, status="scheduled")  # ended 10:00, grace 15 -> unrecorded at 10:20
        await _sess(factory, env, WED, subject=env.subject2, status="scheduled", start=time(11), end=time(12))  # not yet
        o = (await compute_student_metrics(db, joiner.id)).overall
        assert o["unrecorded"] == 1 and o["eligibility_provisional"] is True
        o_old = (await compute_student_metrics(db, env.s1.id)).overall
        assert o_old["unrecorded"] == 2

    async def test_records_outside_term_not_counted(self, db, env, factory, frozen_now):
        frozen_now(REPORT_NOW)
        before_term = await _sess(factory, env, date(2025, 12, 15))
        await insert_record(factory, student=env.s1, session=before_term, status="absent")
        assert (await compute_student_metrics(db, env.s1.id)).overall["considered"] == 0

    async def test_future_dated_sessions_ignored(self, db, env, factory, frozen_now):
        frozen_now(at(MON, 12))
        future = await _sess(factory, env, WED)
        await insert_record(factory, student=env.s1, session=future, status="absent")
        assert (await compute_student_metrics(db, env.s1.id)).overall["considered"] == 0


class TestTermSelection:
    async def test_term_id_selection_and_default(self, db, env, factory, frozen_now):
        frozen_now(REPORT_NOW)
        old_term = await factory.term(start_date=date(2025, 8, 4), end_date=date(2025, 12, 19), academic_year=2025)
        old = await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=date(2025, 12, 15),
                                   status="held", term=old_term)
        await insert_record(factory, student=env.s1, session=old, status="absent")
        cur = await _sess(factory, env, MON)
        await insert_record(factory, student=env.s1, session=cur, status="present")

        default = await compute_student_metrics(db, env.s1.id)
        assert default.term_context.term.id == env.term.id and default.overall["percentage"] == 100.0
        picked = await compute_student_metrics(db, env.s1.id, term_id=old_term.id)
        assert picked.term_context.term.id == old_term.id and picked.overall["percentage"] == 0.0
        batch = await compute_students_overall(db, [env.s1.id], term_id=old_term.id)
        assert batch["students"][env.s1.id]["percentage"] == 0.0

    async def test_between_terms_reports_last_term(self, db, env, factory, frozen_now):
        cur = await _sess(factory, env, MON)
        await insert_record(factory, student=env.s1, session=cur, status="present")
        frozen_now(at(date(2026, 7, 1), 12))
        m = await compute_student_metrics(db, env.s1.id)
        assert m.term_state == "between_terms" and m.term_context.term.id == env.term.id
        assert m.overall["percentage"] == 100.0

    async def test_no_terms(self, db, env, factory, frozen_now):
        from sqlalchemy import text

        await db.execute(text("UPDATE semester_configurations SET is_active = false"))
        frozen_now(REPORT_NOW)
        m = await compute_student_metrics(db, env.s1.id)
        assert m.term_state == "no_terms" and m.overall["percentage"] is None


class TestBatchAndCohort:
    async def test_batch_matches_single(self, db, env, factory, frozen_now):
        frozen_now(REPORT_NOW)
        for d, sts in ((MON, ("present", "absent", "late")), (WED, ("absent", "absent", "present"))):
            s = await _sess(factory, env, d)
            for stu, st in zip(env.students, sts):
                await insert_record(factory, student=stu, session=s, status=st)
        await _sess(factory, env, NEXT_MON, status="scheduled")
        batch = await compute_students_overall(db, faculty_id=env.faculty.id, semester=1)
        for stu in env.students:
            single = (await compute_student_metrics(db, stu.id)).overall
            got = batch["students"][stu.id]
            for k in ("percentage", "considered", "attended", "unrecorded", "eligible", "band", "total_classes"):
                assert got[k] == single[k], (stu.id, k)
        assert batch["aggregate"]["considered"] == 6 and batch["aggregate"]["attended"] == 3

    async def test_cohort_subject_metrics(self, db, env, factory, frozen_now):
        frozen_now(REPORT_NOW)
        s = await _sess(factory, env, MON)
        await insert_record(factory, student=env.s1, session=s, status="present")
        await insert_record(factory, student=env.s2, session=s, status="absent")
        await _sess(factory, env, WED, status="scheduled")
        await _sess(factory, env, NEXT_MON, status="cancelled", cancellation_reason="x")
        await _sess(factory, env, date(2026, 3, 25), status="scheduled")  # upcoming
        res = await compute_cohort_subject_metrics(db, env.subject.id, env.faculty.id, 1)
        assert res["sessions"] == {"held": 1, "unrecorded": 1, "cancelled": 1, "upcoming": 0}
        by_id = {r["student_id"]: r for r in res["students"]}
        assert by_id[env.s1.id]["percentage"] == 100.0 and by_id[env.s2.id]["percentage"] == 0.0
        assert by_id[env.s3.id]["percentage"] is None and by_id[env.s3.id]["unrecorded"] == 1
        assert res["aggregate"]["considered"] == 2


class TestDayStatuses:
    async def test_week_of_statuses(self, db, env, factory, frozen_now):
        frozen_now(REPORT_NOW)
        mon = await _sess(factory, env, MON)
        await insert_record(factory, student=env.s1, session=mon, status="present")
        await factory.holiday(start_date=TUE, faculty=env.faculty)
        await _sess(factory, env, WED, status="scheduled")
        await _sess(factory, env, FRI, subject=env.subject2, status="cancelled", start=time(11), end=time(12),
                    cancellation_reason="x")
        days = {d["date"]: d["status"] for d in await compute_student_day_statuses(db, env.s1.id, SUN, SAT)}
        assert days == {
            SUN.isoformat(): "no_class",
            MON.isoformat(): "present",
            TUE.isoformat(): "holiday",
            WED.isoformat(): "unrecorded",
            THU.isoformat(): "no_class",
            FRI.isoformat(): "cancelled",
            SAT.isoformat(): "weekly_off",
        }

    async def test_absent_partial_excused_future(self, db, env, factory, frozen_now):
        frozen_now(at(THU, 12))
        a = await _sess(factory, env, MON)
        b = await _sess(factory, env, MON, subject=env.subject2, start=time(11), end=time(12))
        await insert_record(factory, student=env.s1, session=a, status="present")
        await insert_record(factory, student=env.s1, session=b, status="absent")
        c = await _sess(factory, env, TUE, subject=env.subject2, start=time(11), end=time(12))
        await insert_record(factory, student=env.s1, session=c, status="absent")
        d = await _sess(factory, env, WED)
        await insert_record(factory, student=env.s1, session=d, status="excused", source="admin")
        await _sess(factory, env, FRI, subject=env.subject2, status="scheduled", start=time(11), end=time(12))
        days = {x["date"]: x["status"] for x in await compute_student_day_statuses(db, env.s1.id, MON, FRI)}
        assert days[MON.isoformat()] == "partial"
        assert days[TUE.isoformat()] == "absent"
        assert days[WED.isoformat()] == "excused"
        assert days[FRI.isoformat()] == "future"

    async def test_between_terms_day(self, db, env, frozen_now):
        frozen_now(at(date(2026, 7, 10), 12))
        (day,) = await compute_student_day_statuses(db, env.s1.id, date(2026, 7, 6), date(2026, 7, 6))
        assert day["status"] == "between_terms"


class TestStreakFromRecords:
    async def test_streak_ignores_non_class_days_and_counts_late(self, db, env, factory, frozen_now):
        frozen_now(REPORT_NOW)
        plan = [(MON, "absent"), (WED, "present"), (NEXT_MON, "late"), (date(2026, 3, 11), "present")]
        for d, st in plan:
            s = await _sess(factory, env, d)
            await insert_record(factory, student=env.s1, session=s, status=st)
        m = await compute_student_metrics(db, env.s1.id)
        assert m.streak == {"current": 3, "longest": 3}
        await patch_policy(db, late_counts_as_attended=False)
        m = await compute_student_metrics(db, env.s1.id)
        assert m.streak == {"current": 1, "longest": 1}
