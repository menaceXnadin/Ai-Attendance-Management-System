"""Class sessions (DOMAIN_RULES §5, §13.1 materialization, §13.2 make-ups, §13.4 unrecorded,
§13.6 calendar events drive sessions)."""
from __future__ import annotations

from datetime import date, time, timedelta

import pytest
from sqlalchemy import text

from app.services import class_sessions as cs
from app.services.attendance_recording import Entry, record_attendance
from app.services.domain_errors import DomainError

from .conftest import (
    MON,
    NEXT_MON,
    SAT,
    TUE,
    WED,
    at,
    audit_rows,
    count,
    get_session,
    insert_record,
    patch_policy,
    records_for,
    sessions_on,
)

pytestmark = pytest.mark.integration


async def _n_sessions(db, faculty_id) -> int:
    return await count(db, "SELECT count(*) FROM class_sessions WHERE faculty_id = :f", f=faculty_id)


# ============================================================================ materialization


class TestMaterialization:
    async def test_idempotent(self, db, env, frozen_now):
        frozen_now(at(NEXT_MON, 7))
        first = await cs.materialize_sessions(db, MON, NEXT_MON)
        n = await _n_sessions(db, env.faculty.id)
        assert first.created == 3 and n == 3  # Mon, Wed, next Mon
        rows_before = await db.execute(text("SELECT id, session_date, start_time, status FROM class_sessions "
                                            "WHERE faculty_id = :f ORDER BY id"), {"f": env.faculty.id})
        rows_before = rows_before.all()
        second = await cs.materialize_sessions(db, MON, NEXT_MON)
        assert second.created == 0
        rows_after = (await db.execute(text("SELECT id, session_date, start_time, status FROM class_sessions "
                                            "WHERE faculty_id = :f ORDER BY id"), {"f": env.faculty.id})).all()
        assert rows_after == rows_before

    async def test_ensure_sessions_for_is_idempotent(self, db, env, frozen_now):
        frozen_now(at(MON, 8))
        a = await cs.ensure_sessions_for(db, session_date=MON, faculty_id=env.faculty.id, semester=1)
        b = await cs.ensure_sessions_for(db, session_date=MON, faculty_id=env.faculty.id, semester=1)
        assert [s.id for s in a] == [s.id for s in b] and len(a) == 1
        assert a[0].status == "scheduled" and a[0].kind == "regular" and a[0].term_id == env.term.id

    async def test_never_before_tracking_start_date(self, db, env, frozen_now):
        await patch_policy(db, tracking_start_date=WED)
        frozen_now(at(NEXT_MON, 7))
        res = await cs.materialize_sessions(db, MON, NEXT_MON)
        dates = sorted(s.session_date for s in await sessions_on(db, MON) + await sessions_on(db, WED)
                       + await sessions_on(db, NEXT_MON))
        assert dates == [WED, NEXT_MON]
        assert res.skipped_before_tracking == 1
        # on-demand materialization also respects it
        assert await cs.ensure_sessions_for(db, session_date=MON, faculty_id=env.faculty.id, semester=1) == []

    async def test_same_day_schedule_time_edit_does_not_duplicate(self, db, env, frozen_now):
        frozen_now(at(MON, 7))
        (orig,) = await cs.ensure_sessions_for(db, session_date=MON, faculty_id=env.faculty.id, semester=1)
        await db.execute(text("UPDATE class_schedules SET start_time = '11:00', end_time = '12:00' WHERE id = :i"),
                         {"i": env.mon_schedule.id})
        await cs.materialize_sessions(db, MON, MON)
        after = await cs.ensure_sessions_for(db, session_date=MON, faculty_id=env.faculty.id, semester=1)
        assert [s.id for s in after] == [orig.id]
        assert after[0].start_time == time(9)  # time edits apply from the next materialization day
        # the next Monday picks up the new time
        nxt = await cs.ensure_sessions_for(db, session_date=NEXT_MON, faculty_id=env.faculty.id, semester=1)
        assert [s.start_time for s in nxt] == [time(11)]

    async def test_get_or_create_rejects_unexpected_date(self, db, env, frozen_now):
        from app.models import ClassSchedule

        frozen_now(at(MON, 7))
        sched = await db.get(ClassSchedule, env.mon_schedule.id)
        with pytest.raises(DomainError) as exc:
            await cs.get_or_create_session(db, schedule=sched, session_date=TUE)
        assert exc.value.code == "not_expected"
        s = await cs.get_or_create_session(db, schedule=sched, session_date=MON)
        assert s.session_date == MON and s.schedule_id == sched.id

    async def test_resolve_never_guesses_between_two_slots(self, db, env, factory, frozen_now):
        await factory.class_schedule(subject=env.subject, faculty=env.faculty, day_of_week="MONDAY",
                                     start_time="13:00", end_time="14:00", semester=1, teacher=env.teacher)
        frozen_now(at(MON, 7))
        with pytest.raises(DomainError) as exc:
            await cs.resolve_session_for(db, subject_id=env.subject.id, faculty_id=env.faculty.id, semester=1,
                                         session_date=MON)
        assert exc.value.code == "ambiguous_session" and len(exc.value.details["slots"]) == 2
        s = await cs.resolve_session_for(db, subject_id=env.subject.id, faculty_id=env.faculty.id, semester=1,
                                         session_date=MON, start_time=time(13))
        assert s.start_time == time(13)


# ============================================================================ make-up sessions


class TestMakeup:
    async def test_makeup_on_weekly_off_day_is_finalizable(self, db, env, frozen_now):
        from app.services.auto_absent_service import auto_absent_service

        clock = frozen_now(at(SAT, 8))
        mk = await cs.create_makeup_session(db, actor=env.admin.user, subject_id=env.subject.id,
                                            faculty_id=env.faculty.id, semester=1, session_date=SAT,
                                            start_time=time(9), end_time=time(10), teacher_id=env.teacher.id,
                                            reason="Make up for strike day")
        assert mk.kind == "makeup" and mk.status == "scheduled" and mk.term_id == env.term.id
        clock.set(at(SAT, 9, 5))
        await record_attendance(db, actor=env.teacher.user, session=mk, entries=[Entry(env.s1.id, "present")])
        assert (await get_session(db, mk.id)).status == "held"
        clock.set(at(SAT, 10, 30))
        result = await auto_absent_service.run(db)
        assert mk.id in result["finalized_session_ids"]
        statuses = {r["student_id"]: (r["status"], r["source"]) for r in await records_for(db, mk.id)}
        assert statuses == {env.s1.id: ("present", "teacher"), env.s2.id: ("absent", "system_auto"),
                            env.s3.id: ("absent", "system_auto")}

    async def test_teacher_of_cohort_may_create_makeup_others_may_not(self, db, env, frozen_now):
        frozen_now(at(MON, 7))
        mk = await cs.create_makeup_session(db, actor=env.teacher.user, subject_id=env.subject.id,
                                            faculty_id=env.faculty.id, semester=1, session_date=TUE,
                                            start_time=time(14), end_time=time(15), reason="extra")
        assert mk.teacher_id == env.teacher.id
        with pytest.raises(DomainError) as exc:
            await cs.create_makeup_session(db, actor=env.other_teacher.user, subject_id=env.subject.id,
                                           faculty_id=env.faculty.id, semester=1, session_date=TUE,
                                           start_time=time(16), end_time=time(17), reason="extra")
        assert exc.value.code == "not_subject_teacher"

    async def test_makeup_rejected_on_holiday_and_between_terms(self, db, env, factory, frozen_now):
        frozen_now(at(MON, 7))
        await factory.holiday(start_date=TUE, faculty=env.faculty)
        with pytest.raises(DomainError) as exc:
            await cs.create_makeup_session(db, actor=env.admin.user, subject_id=env.subject.id,
                                           faculty_id=env.faculty.id, semester=1, session_date=TUE,
                                           start_time=time(14), end_time=time(15), reason="extra")
        assert exc.value.code == "blocked_by_event"
        with pytest.raises(DomainError) as exc:
            await cs.create_makeup_session(db, actor=env.admin.user, subject_id=env.subject.id,
                                           faculty_id=env.faculty.id, semester=1, session_date=date(2026, 7, 7),
                                           start_time=time(14), end_time=time(15), reason="extra")
        assert exc.value.code == "between_terms"

    async def test_makeup_requires_reason(self, db, env, frozen_now):
        frozen_now(at(MON, 7))
        with pytest.raises(DomainError) as exc:
            await cs.create_makeup_session(db, actor=env.admin.user, subject_id=env.subject.id,
                                           faculty_id=env.faculty.id, semester=1, session_date=TUE,
                                           start_time=time(14), end_time=time(15), reason="  ")
        assert exc.value.code == "reason_required"

    async def test_held_session_finalized_even_if_schedule_deactivated(self, db, env, frozen_now):
        from app.services.auto_absent_service import auto_absent_service

        clock = frozen_now(at(MON, 9, 5))
        (s,) = await cs.ensure_sessions_for(db, session_date=MON, faculty_id=env.faculty.id, semester=1)
        await record_attendance(db, actor=env.teacher.user, session=s, entries=[Entry(env.s1.id, "present")])
        await db.execute(text("UPDATE class_schedules SET is_active = false WHERE id = :i"), {"i": env.mon_schedule.id})
        clock.set(at(MON, 11))
        result = await auto_absent_service.run(db)
        assert s.id in result["finalized_session_ids"]
        assert len(await records_for(db, s.id)) == 3


# ============================================================================ cancel / uncancel


class TestCancel:
    async def test_cancel_keeps_records_and_uncancel_restores_held(self, db, env, mon_session):
        await record_attendance(db, actor=env.teacher.user, session=mon_session, entries=[Entry(env.s1.id, "present")])
        with pytest.raises(DomainError) as exc:
            await cs.cancel_session(db, session=mon_session, actor=env.teacher.user, reason="")
        assert exc.value.code == "reason_required"
        await cs.cancel_session(db, session=mon_session, actor=env.teacher.user, reason="Teacher ill")
        s = await get_session(db, mon_session.id)
        assert s.status == "cancelled"
        assert [r["status"] for r in await records_for(db, s.id)] == ["present"]  # kept, untouched
        assert await audit_rows(db, session_id=s.id, action="session_cancelled")
        await cs.uncancel_session(db, session=s, actor=env.admin.user, reason="Class did happen")
        assert (await get_session(db, s.id)).status == "held"
        assert await audit_rows(db, session_id=s.id, action="session_uncancelled")

    async def test_uncancel_without_records_returns_to_scheduled(self, db, env, mon_session):
        await cs.cancel_session(db, session=mon_session, actor=env.admin.user, reason="x")
        await cs.uncancel_session(db, session=mon_session, actor=env.admin.user, reason="y")
        assert (await get_session(db, mon_session.id)).status == "scheduled"

    async def test_other_teacher_cannot_cancel(self, db, env, mon_session):
        with pytest.raises(DomainError) as exc:
            await cs.cancel_session(db, session=mon_session, actor=env.other_teacher.user, reason="x")
        assert exc.value.http_status == 403

    async def test_teacher_cannot_cancel_after_edit_window_admin_can(self, db, env, mon_session, frozen_now):
        frozen_now(at(MON + timedelta(days=8), 9))
        with pytest.raises(DomainError) as exc:
            await cs.cancel_session(db, session=mon_session, actor=env.teacher.user, reason="x")
        assert exc.value.code == "edit_window_closed"
        await cs.cancel_session(db, session=mon_session, actor=env.admin.user, reason="x")


# ============================================================================ unrecorded (§13.4)


class TestUnrecorded:
    async def test_lists_past_scheduled_sessions_only(self, db, env, factory, frozen_now):
        from .conftest import insert_session

        held = await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=MON, status="held",
                                    teacher=env.teacher)
        sched = await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=WED,
                                     teacher=env.teacher)
        later = await insert_session(factory, subject=env.subject2, faculty=env.faculty, session_date=WED,
                                     start=time(11), end=time(12))
        frozen_now(at(WED, 10, 15))  # Wed 09-10 ends + grace exactly now -> not yet unrecorded
        assert [r["session_id"] for r in await cs.list_unrecorded_sessions(db)] == []
        frozen_now(at(WED, 10, 16))
        ids = [r["session_id"] for r in await cs.list_unrecorded_sessions(db)]
        assert ids == [sched.id] and held.id not in ids and later.id not in ids
        assert await cs.count_unrecorded_sessions(db) == 1
        assert [r["session_id"] for r in await cs.list_unrecorded_sessions(db, teacher_id=env.other_teacher.id)] == []
        assert [r["session_id"] for r in await cs.list_unrecorded_sessions(db, teacher_id=env.teacher.id)] == [sched.id]

    async def test_schedules_without_teacher_counted(self, db, env, factory):
        before = await cs.count_schedules_without_teacher(db)
        await factory.class_schedule(subject=env.subject2, faculty=env.faculty, day_of_week="TUESDAY", teacher=None)
        assert await cs.count_schedules_without_teacher(db) == before + 1


# ============================================================================ calendar events (§13.6)


class TestEventReconcile:
    async def test_holiday_cancels_unrecorded_and_flags_recorded_then_restore(self, db, env, factory, frozen_now):
        from app.models import AcademicEvent

        clock = frozen_now(at(MON, 9, 5))
        await cs.materialize_sessions(db, MON, WED)
        (mon,) = await sessions_on(db, MON, faculty_id=env.faculty.id)
        (wed,) = await sessions_on(db, WED, faculty_id=env.faculty.id)
        await record_attendance(db, actor=env.teacher.user, session=mon, entries=[Entry(env.s1.id, "present")])
        clock.set(at(MON, 18))

        ev = await factory.holiday(start_date=MON, end_date=WED, title="Bandh")
        ev_orm = await db.get(AcademicEvent, ev.id)
        res = await cs.reconcile_sessions_for_event(db, ev_orm, env.admin.user)
        mon, wed = await get_session(db, mon.id), await get_session(db, wed.id)
        assert wed.status == "cancelled" and wed.cancelled_by_event_id == ev.id
        assert "Bandh" in (wed.cancellation_reason or "")
        assert mon.status == "held" and mon.review_required is True and mon.review_reason
        assert res["cancelled"] == 1 and res["review_required"] == 1
        assert any((r["context"] or {}).get("event_id") == ev.id
                   for r in await audit_rows(db, session_id=wed.id, action="session_cancelled"))
        # the review-flagged session shows up for admin decision
        listed = {r["session_id"]: r for r in await cs.list_unrecorded_sessions(db)}
        assert listed[mon.id]["review_required"] is True

        # idempotent re-reconcile
        again = await cs.reconcile_sessions_for_event(db, ev_orm, env.admin.user)
        assert again["cancelled"] == 0 and again["review_required"] == 0

        # deactivate -> restore
        await db.execute(text("UPDATE academic_events SET is_active = false WHERE id = :i"), {"i": ev.id})
        ev_orm = await db.get(AcademicEvent, ev.id)
        await db.refresh(ev_orm)
        await cs.restore_sessions_for_event(db, ev_orm, env.admin.user)
        mon, wed = await get_session(db, mon.id), await get_session(db, wed.id)
        assert wed.status == "scheduled" and wed.cancelled_by_event_id is None
        assert mon.status == "held" and mon.review_required is False and mon.review_reason is None
        assert any((r["context"] or {}).get("event_id") == ev.id
                   for r in await audit_rows(db, session_id=wed.id, action="session_uncancelled"))

    async def test_system_auto_records_do_not_count_as_real(self, db, env, factory, frozen_now):
        """Rule §13.6: only teacher/admin/student_face records keep a session alive."""
        from app.models import AcademicEvent

        frozen_now(at(MON, 18))
        await cs.materialize_sessions(db, MON, MON)
        (mon,) = await sessions_on(db, MON, faculty_id=env.faculty.id)
        await insert_record(factory, student=env.s1, session=mon, status="absent", source="system_auto")
        ev = await factory.holiday(start_date=MON)
        await cs.reconcile_sessions_for_event(db, await db.get(AcademicEvent, ev.id), env.admin.user)
        assert (await get_session(db, mon.id)).status == "cancelled"

    async def test_faculty_scoped_event_leaves_other_faculty_alone(self, db, env, factory, frozen_now):
        from app.models import AcademicEvent

        frozen_now(at(MON, 7))
        other_subject = await factory.subject(faculty=env.other_faculty)
        await factory.class_schedule(subject=other_subject, faculty=env.other_faculty, day_of_week="MONDAY")
        await cs.materialize_sessions(db, MON, MON)
        ev = await factory.holiday(start_date=MON, faculty=env.faculty)
        await cs.reconcile_sessions_for_event(db, await db.get(AcademicEvent, ev.id), env.admin.user)
        assert [s.status for s in await sessions_on(db, MON, faculty_id=env.faculty.id)] == ["cancelled"]
        assert [s.status for s in await sessions_on(db, MON, faculty_id=env.other_faculty.id)] == ["scheduled"]

    async def test_restore_keeps_session_cancelled_if_another_event_still_covers(self, db, env, factory, frozen_now):
        from app.models import AcademicEvent

        frozen_now(at(MON, 7))
        await cs.materialize_sessions(db, MON, MON)
        ev1 = await factory.holiday(start_date=MON)
        ev2 = await factory.holiday(start_date=MON, faculty=env.faculty)
        await cs.reconcile_sessions_for_event(db, await db.get(AcademicEvent, ev1.id), env.admin.user)
        await cs.reconcile_sessions_for_event(db, await db.get(AcademicEvent, ev2.id), env.admin.user)
        await db.execute(text("UPDATE academic_events SET is_active = false WHERE id = :i"), {"i": ev1.id})
        ev1_orm = await db.get(AcademicEvent, ev1.id)
        await db.refresh(ev1_orm)
        await cs.restore_sessions_for_event(db, ev1_orm, env.admin.user)
        (mon,) = await sessions_on(db, MON, faculty_id=env.faculty.id)
        assert mon.status == "cancelled"
