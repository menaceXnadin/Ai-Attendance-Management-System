"""Automatic absence finalizer (DOMAIN_RULES §7, §0.2, §13.1, §13.3, §13.7, §13.11)."""
from __future__ import annotations

from datetime import date, time, timedelta

import pytest
from sqlalchemy import text

from app.services.attendance_policy import AttendancePolicy
from app.services.auto_absent_service import (
    AUTO_ABSENT_LOCK_KEY,
    auto_absent_service,
    materialization_window,
    validate_manual_target_date,
)
from app.services.domain_errors import DomainError
from app.services.term_service import Term

from .conftest import (
    MON,
    TUE,
    WED,
    at,
    audit_rows,
    count,
    get_session,
    insert_record,
    insert_session,
    patch_policy,
    records_for,
)

pytestmark = pytest.mark.integration


async def _held(factory, env, d=MON, **kw):
    return await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=d, status="held",
                                teacher=env.teacher, term=env.term, **kw)


async def _job_runs(db) -> int:
    return await count(db, "SELECT count(*) FROM job_runs WHERE job_name = 'auto_absent'")


def _by_student(recs):
    return {r["student_id"]: (r["status"], r["source"]) for r in recs}


# ============================================================================ pure helpers


class TestPureHelpers:
    def test_materialization_window(self):
        p = AttendancePolicy(auto_absent_lookback_days=7, tracking_start_date=date(2026, 3, 1))
        assert materialization_window(date(2026, 3, 20), p) == (date(2026, 3, 13), date(2026, 3, 20))
        assert materialization_window(date(2026, 3, 4), p) == (date(2026, 3, 1), date(2026, 3, 4))
        # a manual target date extends the window but never before tracking_start_date
        assert materialization_window(date(2026, 3, 20), p, date(2026, 2, 20)) == (date(2026, 3, 1), date(2026, 3, 20))

    def test_manual_target_date_rules(self):
        terms = [Term(id=1, name="T", start_date=date(2026, 1, 5), end_date=date(2026, 5, 29))]
        validate_manual_target_date(date(2026, 3, 1), date(2026, 3, 20), terms)
        for bad in (date(2026, 3, 21), date(2026, 2, 17), ):
            with pytest.raises(DomainError):
                validate_manual_target_date(bad, date(2026, 3, 20), terms)
        with pytest.raises(DomainError):
            validate_manual_target_date(date(2026, 1, 4), date(2026, 1, 20), terms)  # outside term


# ============================================================================ who gets absences


class TestFinalizeScope:
    async def test_only_held_sessions_get_absences(self, db, env, factory, frozen_now):
        held = await _held(factory, env)
        unrecorded = await insert_session(factory, subject=env.subject2, faculty=env.faculty, session_date=MON,
                                          start=time(11), end=time(12), teacher=env.teacher, term=env.term)
        await insert_record(factory, student=env.s1, session=held, status="present")
        frozen_now(at(WED, 18))
        result = await auto_absent_service.run(db)
        assert result["lock_acquired"] is True and result["sessions_finalized"] == 1
        assert _by_student(await records_for(db, held.id)) == {
            env.s1.id: ("present", "teacher"), env.s2.id: ("absent", "system_auto"), env.s3.id: ("absent", "system_auto")}
        assert await records_for(db, unrecorded.id) == [], "an unrecorded (scheduled) session must never be auto-absented"
        assert (await get_session(db, unrecorded.id)).finalized_at is None
        assert (await get_session(db, held.id)).finalized_at is not None

    async def test_unrecorded_sessions_never_absented_even_after_many_runs(self, db, env, frozen_now):
        clock = frozen_now(at(MON, 18))
        await auto_absent_service.run(db)  # materializes Mon as scheduled
        clock.set(at(WED, 18))
        r = await auto_absent_service.run(db)
        assert r["unrecorded_sessions"] == 4  # Feb 23, Feb 25, Mar 2, Mar 4 (7-day lookback)
        assert await count(db, "SELECT count(*) FROM attendance_records ar JOIN class_sessions cs ON cs.id = ar.session_id "
                               "WHERE cs.faculty_id = :f", f=env.faculty.id) == 0

    async def test_absence_row_shape(self, db, env, factory, frozen_now):
        held = await _held(factory, env)
        await insert_record(factory, student=env.s1, session=held)
        frozen_now(at(MON, 11))
        await auto_absent_service.run(db)
        auto = [r for r in await records_for(db, held.id) if r["source"] == "system_auto"]
        assert len(auto) == 2
        for r in auto:
            assert (r["status"], r["method"], r["location"], r["marked_by"]) == ("absent", "other", "AUTO_ABSENT_SYSTEM", None)
            assert r["excluded_from_metrics"] is False
        (fin,) = await audit_rows(db, session_id=held.id, action="finalize")
        assert fin["changed_by"] is None and fin["context"]["absent_created"] == 2

    async def test_never_updates_existing_records(self, db, env, factory, frozen_now):
        held = await _held(factory, env)
        await insert_record(factory, student=env.s1, session=held, status="late", source="student_face")
        await insert_record(factory, student=env.s2, session=held, status="excused", source="admin")
        frozen_now(at(MON, 11))
        await auto_absent_service.run(db)
        assert _by_student(await records_for(db, held.id)) == {
            env.s1.id: ("late", "student_face"), env.s2.id: ("excused", "admin"), env.s3.id: ("absent", "system_auto")}

    async def test_idempotent_rerun(self, db, env, factory, frozen_now):
        held = await _held(factory, env)
        await insert_record(factory, student=env.s1, session=held)
        clock = frozen_now(at(MON, 11))
        first = await auto_absent_service.run(db)
        finalized_at = (await get_session(db, held.id)).finalized_at
        clock.advance(minutes=10)
        second = await auto_absent_service.run(db)
        assert first["new_records_created"] == 2 and second["new_records_created"] == 0
        assert second["sessions_finalized"] == 0
        assert len(await records_for(db, held.id)) == 3
        assert (await get_session(db, held.id)).finalized_at == finalized_at
        assert len(await audit_rows(db, session_id=held.id, action="finalize")) == 1

    async def test_respects_enrollment_start(self, db, env, factory, frozen_now):
        late_joiner = await factory.student(faculty=env.faculty, semester=1, enrolled_on=TUE)
        held = await _held(factory, env)
        await insert_record(factory, student=env.s1, session=held)
        frozen_now(at(MON, 11))
        await auto_absent_service.run(db)
        assert late_joiner.id not in {r["student_id"] for r in await records_for(db, held.id)}

    async def test_enrollment_start_falls_back_to_created_at(self, db, env, factory, frozen_now):
        # no enrolled_on; created "now" (2026-10 in real time) -> after the session date
        newbie = await factory.student(faculty=env.faculty, semester=1)
        held = await _held(factory, env)
        await insert_record(factory, student=env.s1, session=held)
        frozen_now(at(MON, 11))
        await auto_absent_service.run(db)
        assert newbie.id not in {r["student_id"] for r in await records_for(db, held.id)}

    async def test_respects_cohort_since(self, db, env, factory, frozen_now):
        mover = await factory.student(faculty=env.faculty, semester=1, enrolled_on=date(2025, 1, 1), cohort_since=TUE)
        held = await _held(factory, env)
        await insert_record(factory, student=env.s1, session=held)
        frozen_now(at(MON, 11))
        await auto_absent_service.run(db)
        assert mover.id not in {r["student_id"] for r in await records_for(db, held.id)}

    async def test_inactive_users_and_other_cohorts_excluded(self, db, env, factory, frozen_now):
        await db.execute(text("UPDATE users SET is_active = false WHERE id = :u"), {"u": env.s3.user_id})
        held = await _held(factory, env)
        await insert_record(factory, student=env.s1, session=held)
        frozen_now(at(MON, 11))
        await auto_absent_service.run(db)
        ids = {r["student_id"] for r in await records_for(db, held.id)}
        assert ids == {env.s1.id, env.s2.id}  # s3 inactive, outsider is semester 2


# ============================================================================ eligibility of a session


class TestFinalizeEligibility:
    async def test_grace_boundary(self, db, env, factory, frozen_now):
        held = await _held(factory, env)
        await insert_record(factory, student=env.s1, session=held)
        clock = frozen_now(at(MON, 10, 14, 59))
        await auto_absent_service.run(db)
        assert len(await records_for(db, held.id)) == 1
        clock.set(at(MON, 10, 15))  # end + grace <= now
        await auto_absent_service.run(db)
        assert len(await records_for(db, held.id)) == 3

    async def test_skips_cancelled(self, db, env, factory, frozen_now):
        s = await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=MON, status="cancelled",
                                 term=env.term, cancellation_reason="strike")
        await insert_record(factory, student=env.s1, session=s)
        frozen_now(at(MON, 18))
        await auto_absent_service.run(db)
        assert len(await records_for(db, s.id)) == 1
        assert (await get_session(db, s.id)).finalized_at is None

    async def test_skips_review_required(self, db, env, factory, frozen_now):
        held = await _held(factory, env, review_required=True, review_reason="Calendar event #1: x")
        await insert_record(factory, student=env.s1, session=held)
        frozen_now(at(MON, 18))
        result = await auto_absent_service.run(db)
        assert len(await records_for(db, held.id)) == 1
        assert {"session_id": held.id, "reason": "review_required", "event_id": None} in result["sessions_skipped"]

    async def test_skips_held_session_now_covered_by_holiday(self, db, env, factory, frozen_now):
        held = await _held(factory, env)
        await insert_record(factory, student=env.s1, session=held)
        await factory.holiday(start_date=MON, faculty=env.faculty)
        frozen_now(at(MON, 18))
        await auto_absent_service.run(db)
        assert len(await records_for(db, held.id)) == 1

    async def test_skips_session_outside_active_term(self, db, env, factory, frozen_now):
        await db.execute(text("UPDATE semester_configurations SET is_active = false WHERE id = :i"), {"i": env.term.id})
        held = await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=MON, status="held")
        await insert_record(factory, student=env.s1, session=held)
        frozen_now(at(MON, 18))
        await auto_absent_service.run(db)
        assert len(await records_for(db, held.id)) == 1

    async def test_finalizes_held_sessions_older_than_lookback(self, db, env, factory, frozen_now):
        old_day = MON - timedelta(days=21)
        held = await _held(factory, env, d=old_day)
        await insert_record(factory, student=env.s1, session=held)
        frozen_now(at(MON, 18))  # lookback = 7 days
        result = await auto_absent_service.run(db)
        assert held.id in result["finalized_session_ids"]
        assert len(await records_for(db, held.id)) == 3

    async def test_materializes_within_lookback_and_after_tracking_start(self, db, env, frozen_now):
        await patch_policy(db, tracking_start_date=WED)
        frozen_now(at(date(2026, 3, 11), 18))  # Wed; window Mar 4..Mar 11 but tracking from Mar 4
        result = await auto_absent_service.run(db)
        dates = [r[0] for r in (await db.execute(text(
            "SELECT session_date FROM class_sessions WHERE faculty_id = :f ORDER BY session_date"),
            {"f": env.faculty.id})).all()]
        assert dates == [WED, date(2026, 3, 9), date(2026, 3, 11)]
        assert result["sessions_materialized"] == 3


# ============================================================================ lock + job_runs (§13.11)


class TestLockAndJobRuns:
    async def test_job_run_written_when_lock_acquired(self, db, env, frozen_now):
        frozen_now(at(MON, 18))
        before = await _job_runs(db)
        result = await auto_absent_service.run(db, triggered_by=env.admin.user)
        assert await _job_runs(db) == before + 1
        row = (await db.execute(text("SELECT status, triggered_by FROM job_runs WHERE id = :i"),
                                {"i": result["job_run_id"]})).first()
        assert row == ("success", env.admin.user.id)

    async def test_lock_contention_returns_skipped_and_writes_nothing(self, db, db_engine, env, factory, frozen_now):
        held = await _held(factory, env)
        await insert_record(factory, student=env.s1, session=held)
        frozen_now(at(MON, 18))
        before = await _job_runs(db)
        async with db_engine.connect() as other:
            assert (await other.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": AUTO_ABSENT_LOCK_KEY})).scalar()
            await other.commit()
            try:
                result = await auto_absent_service.run(db)
            finally:
                await other.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": AUTO_ABSENT_LOCK_KEY})
                await other.commit()
        assert result["skipped"] and result["lock_acquired"] is False
        assert await _job_runs(db) == before, "skipped runs are logged, not stored (§13.11)"
        assert len(await records_for(db, held.id)) == 1
        assert (await get_session(db, held.id)).finalized_at is None

    async def test_lock_released_after_run(self, db, db_engine, env, frozen_now):
        frozen_now(at(MON, 18))
        await auto_absent_service.run(db)
        async with db_engine.connect() as other:
            got = (await other.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": AUTO_ABSENT_LOCK_KEY})).scalar()
            if got:
                await other.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": AUTO_ABSENT_LOCK_KEY})
            await other.commit()
        assert got is True

    async def test_failed_run_records_job_and_releases_lock(self, db, db_engine, env, frozen_now, monkeypatch):
        import app.services.auto_absent_service as svc

        async def boom(*a, **k):
            raise RuntimeError("materialization exploded")

        monkeypatch.setattr(svc, "materialize_sessions", boom)
        frozen_now(at(MON, 18))
        with pytest.raises(RuntimeError):
            await auto_absent_service.run(db)
        row = (await db.execute(text("SELECT status, error FROM job_runs WHERE job_name = 'auto_absent' "
                                     "ORDER BY id DESC LIMIT 1"))).first()
        assert row[0] == "failed" and "exploded" in row[1]
        async with db_engine.connect() as other:
            got = (await other.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": AUTO_ABSENT_LOCK_KEY})).scalar()
            if got:
                await other.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": AUTO_ABSENT_LOCK_KEY})
            await other.commit()
        assert got is True
