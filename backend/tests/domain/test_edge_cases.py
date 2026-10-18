"""Edge cases from challenge-domain-rules.md and the less obvious corners of DOMAIN_RULES."""
from __future__ import annotations

import contextlib
from datetime import date, time, timedelta

import pytest
from sqlalchemy import text

from app.services import class_sessions as cs
from app.services.attendance_metrics import compute_student_day_statuses, compute_student_metrics
from app.services.attendance_policy import DEFAULT_BANDS, normalize_bands
from app.services.attendance_recording import Entry, record_attendance, student_self_checkin
from app.services.auto_absent_service import auto_absent_service
from app.services.domain_errors import DomainError

from .conftest import (
    MON,
    NEXT_MON,
    TUE,
    WED,
    at,
    get_session,
    insert_record,
    insert_session,
    patch_policy,
    records_for,
    sessions_on,
)

pytestmark = pytest.mark.integration


# ----------------------------------------------------------------------------- policy


def test_invalid_threshold_rows_fall_back_to_default_bands():
    gap = [{"name": "excellent", "min_percentage": 90}, {"name": "good", "min_percentage": 80}]  # no 0 band
    bands = normalize_bands(gap, 75.0)
    assert [b.name for b in bands] == [b.name for b in DEFAULT_BANDS]
    dup = [{"name": "a", "min_percentage": 50}, {"name": "a", "min_percentage": 0}]
    assert [b.name for b in normalize_bands(dup, 75.0)] == [b.name for b in DEFAULT_BANDS]


# ----------------------------------------------------------------------------- §8 overall eligibility


async def test_overall_eligibility_means_all_subjects_eligible(db, env, factory, frozen_now):
    frozen_now(at(date(2026, 3, 27), 12))
    subject1_days = [date(2026, 2, d) for d in (2, 4, 9, 11, 16, 18, 23, 25)] + [MON, WED]
    for d in subject1_days:  # 10/10 present
        s = await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=d, status="held")
        await insert_record(factory, student=env.s1, session=s, status="present")
    # subject2: 2/4 -> 50%; aggregate 12/14 = 85.7%
    for i, d in enumerate((MON, WED, NEXT_MON, date(2026, 3, 11))):
        s = await insert_session(factory, subject=env.subject2, faculty=env.faculty, session_date=d, status="held",
                                 start=time(11), end=time(12))
        await insert_record(factory, student=env.s1, session=s, status="present" if i < 2 else "absent")
    m = await compute_student_metrics(db, env.s1.id)
    subj2 = next(s for s in m.per_subject if s["subject_id"] == env.subject2.id)
    assert subj2["eligible"] is False
    assert m.overall["all_subjects_eligible"] is False
    d = m.to_dict()
    assert d["eligibility"]["eligible"] is False
    assert d["eligible"] is False


# ----------------------------------------------------------------------------- §13.1 tracking start


async def test_get_or_create_never_creates_before_tracking_start(db, env, frozen_now):
    from app.models import ClassSchedule

    await patch_policy(db, tracking_start_date=WED)
    frozen_now(at(WED, 12))
    sched = await db.get(ClassSchedule, env.mon_schedule.id)
    with contextlib.suppress(DomainError):
        await cs.get_or_create_session(db, schedule=sched, session_date=MON)
    assert await sessions_on(db, MON, faculty_id=env.faculty.id) == []


# ----------------------------------------------------------------------------- recording corners


async def test_admin_cannot_record_future_session(db, env, mon_session, frozen_now):
    frozen_now(at(MON, 8, 0))
    with pytest.raises(DomainError) as exc:
        await record_attendance(db, actor=env.admin.user, session=mon_session, entries=[Entry(env.s1.id, "present")],
                                reason="x")
    assert exc.value.code == "session_not_started"


async def test_teacher_cannot_mark_student_enrolled_after_session(db, env, factory, mon_session):
    joiner = await factory.student(faculty=env.faculty, semester=1, enrolled_on=TUE)
    with pytest.raises(DomainError) as exc:
        await record_attendance(db, actor=env.teacher.user, session=mon_session, entries=[Entry(joiner.id, "present")])
    assert exc.value.details["errors"][0]["code"] == "not_enrolled"


async def test_record_keeps_legacy_columns_populated(db, env, mon_session):
    await record_attendance(db, actor=env.teacher.user, session=mon_session, entries=[Entry(env.s1.id, "present")])
    row = (await db.execute(text("SELECT date, subject_id, time_slot, method::text FROM attendance_records "
                                 "WHERE session_id = :s"), {"s": mon_session.id})).one()
    assert tuple(row) == (MON, env.subject.id, "09:00-10:00", "manual")


async def test_checkin_uses_session_snapshot_after_same_day_time_edit(db, env, mon_session, frozen_now):
    await db.execute(text("UPDATE class_schedules SET start_time = '11:00', end_time = '12:00' WHERE id = :i"),
                     {"i": env.mon_schedule.id})
    frozen_now(at(MON, 9, 5))
    res = await student_self_checkin(db, student=env.s1, session=mon_session)
    assert res.statuses[env.s1.id] == "present"


async def test_excused_only_session_is_never_finalized(db, env, mon_session, frozen_now):
    clock = frozen_now(at(MON, 9, 30))
    await record_attendance(db, actor=env.admin.user, session=mon_session,
                            entries=[Entry(env.s1.id, "excused", "medical")])
    clock.set(at(MON, 18))
    await auto_absent_service.run(db)
    assert [(r["student_id"], r["status"]) for r in await records_for(db, mon_session.id)] == [(env.s1.id, "excused")]
    assert (await get_session(db, mon_session.id)).finalized_at is None


async def test_held_metrics_ignore_records_of_cancelled_session_after_finalization(db, env, factory, frozen_now):
    """§7: a session cancelled after finalization drops its system_auto absences from metrics."""
    clock = frozen_now(at(MON, 9, 5))
    (s,) = await cs.ensure_sessions_for(db, session_date=MON, faculty_id=env.faculty.id, semester=1)
    await record_attendance(db, actor=env.teacher.user, session=s, entries=[Entry(env.s1.id, "present")])
    clock.set(at(MON, 11))
    await auto_absent_service.run(db)
    assert (await compute_student_metrics(db, env.s2.id)).overall["considered"] == 1
    await cs.cancel_session(db, session=s, actor=env.admin.user, reason="class did not actually happen")
    m = await compute_student_metrics(db, env.s2.id)
    assert m.overall["considered"] == 0 and m.overall["percentage"] is None
    assert m.overall["cancelled_sessions"] == 1
    assert len(await records_for(db, s.id)) == 3  # nothing deleted


# ----------------------------------------------------------------------------- §13.6 event edits


async def test_event_date_edit_moves_its_effect(db, env, factory, frozen_now):
    from app.models import AcademicEvent

    frozen_now(at(MON, 7))
    await cs.materialize_sessions(db, MON, WED)
    ev = await factory.holiday(start_date=MON, faculty=env.faculty)
    orm = await db.get(AcademicEvent, ev.id)
    await cs.reconcile_sessions_for_event(db, orm, env.admin.user)
    assert [s.status for s in await sessions_on(db, MON, faculty_id=env.faculty.id)] == ["cancelled"]
    await db.execute(text("UPDATE academic_events SET start_date = :d WHERE id = :i"), {"d": WED, "i": ev.id})
    await db.refresh(orm)
    await cs.reconcile_sessions_for_event(db, orm, env.admin.user)
    assert [s.status for s in await sessions_on(db, MON, faculty_id=env.faculty.id)] == ["scheduled"]
    (wed,) = await sessions_on(db, WED, faculty_id=env.faculty.id)
    assert wed.status == "cancelled" and wed.cancelled_by_event_id == ev.id


async def test_exam_event_drives_sessions_only_when_suspending(db, env, factory, frozen_now):
    from app.models import AcademicEvent

    frozen_now(at(MON, 7))
    await cs.materialize_sessions(db, MON, WED)
    required = await factory.exam(start_date=MON, faculty=env.faculty, attendance_required=True)
    await cs.reconcile_sessions_for_event(db, await db.get(AcademicEvent, required.id), env.admin.user)
    assert [s.status for s in await sessions_on(db, MON, faculty_id=env.faculty.id)] == ["scheduled"]
    suspending = await factory.exam(start_date=WED, faculty=env.faculty)
    await cs.reconcile_sessions_for_event(db, await db.get(AcademicEvent, suspending.id), env.admin.user)
    assert [s.status for s in await sessions_on(db, WED, faculty_id=env.faculty.id)] == ["cancelled"]


async def test_cancelled_by_event_session_rejects_writes_until_restored(db, env, factory, frozen_now):
    from app.models import AcademicEvent

    frozen_now(at(MON, 9, 30))
    await cs.materialize_sessions(db, MON, MON)
    (s,) = await sessions_on(db, MON, faculty_id=env.faculty.id)
    ev = await factory.cancelled_class(start_date=MON, faculty=env.faculty)
    await cs.reconcile_sessions_for_event(db, await db.get(AcademicEvent, ev.id), env.admin.user)
    with pytest.raises(DomainError) as exc:
        await record_attendance(db, actor=env.teacher.user, session=s, entries=[Entry(env.s1.id, "present")])
    assert exc.value.code == "session_cancelled"
    with pytest.raises(DomainError) as exc:
        await student_self_checkin(db, student=env.s1, session=s)
    assert exc.value.code == "session_cancelled"


# ----------------------------------------------------------------------------- coordinator decisions (§8/§13.1/§13.3)


async def test_batch_overall_eligibility_means_all_subjects_eligible(db, env, factory, frozen_now):
    from app.services.attendance_metrics import compute_students_overall

    frozen_now(at(date(2026, 3, 27), 12))
    for d in (date(2026, 2, 2), date(2026, 2, 4), date(2026, 2, 9), date(2026, 2, 11), MON, WED):  # 6/6
        s = await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=d, status="held")
        await insert_record(factory, student=env.s1, session=s, status="present")
    for i, d in enumerate((MON, WED)):  # subject2: 1/2 -> 50%; aggregate 7/8 = 87.5%
        s = await insert_session(factory, subject=env.subject2, faculty=env.faculty, session_date=d, status="held",
                                 start=time(11), end=time(12))
        await insert_record(factory, student=env.s1, session=s, status="present" if i == 0 else "absent")
    batch = await compute_students_overall(db, [env.s1.id, env.s2.id])
    s1 = batch["students"][env.s1.id]
    assert s1["percentage"] == 87.5 and s1["eligible"] is False and s1["all_subjects_eligible"] is False
    assert batch["students"][env.s2.id]["eligible"] is None  # no countable data
    assert (await compute_student_metrics(db, env.s1.id)).overall["eligible"] is False


async def test_makeup_session_rejected_before_tracking_start(db, env):
    await patch_policy(db, tracking_start_date=WED)
    with pytest.raises(DomainError) as exc:
        await cs.create_makeup_session(db, actor=env.admin.user, subject_id=env.subject.id, faculty_id=env.faculty.id,
                                       semester=1, session_date=TUE, start_time=time(14), end_time=time(15),
                                       reason="catch-up")
    assert exc.value.code == "before_tracking_start" and exc.value.http_status == 404


async def test_day_status_session_before_end_plus_grace_is_future_not_unrecorded(db, env, mon_session, frozen_now):
    await patch_policy(db, finalize_grace_minutes=15)
    clock = frozen_now(at(MON, 9, 30))
    (day,) = await compute_student_day_statuses(db, env.s1.id, MON, MON)
    assert day["status"] == "future" and day["sessions"][0]["pending"] is True
    clock.set(at(MON, 10, 14, 59))  # 10:00 end + 15 min grace not reached yet
    assert (await compute_student_day_statuses(db, env.s1.id, MON, MON))[0]["status"] == "future"
    clock.set(at(MON, 10, 15))
    assert (await compute_student_day_statuses(db, env.s1.id, MON, MON))[0]["status"] == "unrecorded"


async def test_day_status_mixed_day_evaluates_only_ended_sessions(db, env, factory, mon_session, frozen_now):
    await patch_policy(db, finalize_grace_minutes=15)
    await insert_session(factory, subject=env.subject2, faculty=env.faculty, session_date=MON,
                         start=time(11), end=time(12))
    clock = frozen_now(at(MON, 9, 30))
    await record_attendance(db, actor=env.teacher.user, session=mon_session, entries=[Entry(env.s1.id, "absent")])
    clock.set(at(MON, 10, 30))  # 09:00 session ended + grace, 11:00 session still pending
    by_student = {s.id: (await compute_student_day_statuses(db, s.id, MON, MON))[0] for s in env.students}
    assert by_student[env.s1.id]["status"] == "absent"
    assert by_student[env.s2.id]["status"] == "unrecorded"  # held 09:00 session, no record yet
    assert [x["pending"] for x in by_student[env.s2.id]["sessions"]] == [False, True]
    clock.set(at(MON, 9, 45))
    assert (await compute_student_day_statuses(db, env.s3.id, MON, MON))[0]["status"] == "future"


async def test_day_status_uses_metrics_countable_definition(db, env, factory, frozen_now):
    late_joiner = await factory.student(faculty=env.faculty, semester=1, enrolled_on=WED)
    held = await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=MON, status="held")
    await insert_record(factory, student=late_joiner, session=held, status="absent")  # before enrollment
    await insert_record(factory, student=env.s1, session=held, status="absent", excluded_from_metrics=True,
                        exclusion_reason="legacy_unheld_session")
    frozen_now(at(TUE, 12))
    for student in (late_joiner, env.s1):
        assert (await compute_student_metrics(db, student.id)).overall["considered"] == 0
        (day,) = await compute_student_day_statuses(db, student.id, MON, MON)
        assert day["status"] == "no_class", day
        assert day["sessions"][0]["counts_in_metrics"] is False


async def test_finalizer_never_backfills_held_sessions_before_tracking_start(db, env, factory, frozen_now):
    await patch_policy(db, tracking_start_date=WED)
    legacy = await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=MON, status="held")
    await insert_record(factory, student=env.s1, session=legacy, status="present")
    current = await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=WED, status="held")
    await insert_record(factory, student=env.s1, session=current, status="present")
    frozen_now(at(WED, 12))
    assert legacy.id not in await auto_absent_service.candidate_session_ids(db, now=at_aware(WED, 12),
                                                                            policy=await _policy(db))
    result = await auto_absent_service.run(db)
    assert result["finalized_session_ids"] == [current.id]
    assert [r["student_id"] for r in await records_for(db, legacy.id)] == [env.s1.id]
    assert (await get_session(db, legacy.id)).finalized_at is None
    assert sorted(r["student_id"] for r in await records_for(db, current.id)) == sorted(s.id for s in env.students)
    detail = await auto_absent_service.finalize_session(db, legacy.id)
    assert detail["finalized"] is False and detail["skip_reason"] == "before_tracking_start"


def at_aware(d, hh, mm=0):
    from app.core.clock import combine_local

    return combine_local(d, time(hh, mm))


async def _policy(db):
    from app.services.attendance_policy import get_attendance_policy

    return await get_attendance_policy(db)


# ----------------------------------------------------------------------------- unrecorded = actionable only (amended §5.2/§13.4)


async def test_unrecorded_excludes_legacy_and_empty_cohort_sessions(db, env, factory, frozen_now):
    from app.services.attendance_metrics import compute_student_metrics as metrics

    await patch_policy(db, tracking_start_date=WED)
    legacy = await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=MON)  # pre-tracking
    actionable = await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=WED)
    empty = await insert_session(factory, subject=env.subject2, faculty=env.faculty, session_date=WED, semester=7)
    await db.execute(text("UPDATE users SET is_active = false WHERE id = :u"), {"u": env.outsider.user_id})
    inactive_only = await insert_session(factory, subject=env.subject2, faculty=env.faculty, session_date=WED, semester=2)
    frozen_now(at(date(2026, 3, 5), 12))
    page = await cs.list_unrecorded_sessions(db)
    assert [r["session_id"] for r in page] == [actionable.id] and page.total == 1 and page.has_more is False
    assert await cs.count_unrecorded_sessions(db) == 1
    assert (await auto_absent_service.get_status(db))["unrecorded_sessions"] == 1
    assert (await metrics(db, env.s1.id)).overall["unrecorded"] == 1
    assert cs.is_unrecorded("scheduled", MON, time(10), at_aware(THU_NOON_DATE, 12), 15, tracking_start_date=WED) is False
    assert cs.is_unrecorded("scheduled", WED, time(10), at_aware(THU_NOON_DATE, 12), 15, roster_size=0) is False
    assert {legacy.id, empty.id, inactive_only.id}.isdisjoint(r["session_id"] for r in page)


async def test_unrecorded_list_pagination_reports_true_total(db, env, factory, frozen_now):
    ids = [(await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=d)).id
           for d in (MON, WED, NEXT_MON)]
    frozen_now(at(date(2026, 3, 10), 12))
    first = await cs.list_unrecorded_sessions(db, limit=2)
    assert [r["session_id"] for r in first] == [ids[2], ids[1]] and first.total == 3 and first.has_more
    rest = await cs.list_unrecorded_sessions(db, limit=2, offset=2)
    assert [r["session_id"] for r in rest] == [ids[0]] and rest.total == 3 and not rest.has_more


async def test_bulk_materialization_skips_empty_cohorts(db, env, factory, frozen_now):
    await factory.class_schedule(subject=env.subject2, faculty=env.faculty, day_of_week="MONDAY", start_time="09:00",
                                 end_time="10:00", semester=7, academic_year=2025)
    frozen_now(at(MON, 12))
    result = await auto_absent_service.run(db)
    assert result["sessions_skipped_empty_cohort"] >= 1
    assert await sessions_on(db, MON, faculty_id=env.faculty.id, semester=7) == []
    assert len(await sessions_on(db, MON, faculty_id=env.faculty.id, semester=1)) == 1
    # an explicit request may still create it
    explicit = await cs.ensure_sessions_for(db, session_date=MON, faculty_id=env.faculty.id, semester=7)
    assert len(explicit) == 1


# ----------------------------------------------------------------------------- make-ups (regression review A, C)


async def test_student_checks_in_to_todays_makeup_by_session_id(db, env, frozen_now):
    from app.services.attendance_recording import find_checkin_session

    clock = frozen_now(at(TUE, 13, 0))
    mk = await cs.create_makeup_session(db, actor=env.admin.user, subject_id=env.subject.id, faculty_id=env.faculty.id,
                                        semester=1, session_date=TUE, start_time=time(14), end_time=time(15),
                                        reason="Lost Monday class")
    clock.set(at(TUE, 14, 5))
    found = await find_checkin_session(db, student=env.s1, subject_id=env.subject.id, session_id=mk.id,
                                       schedule_id=env.mon_schedule.id)  # schedule_id ignored
    assert found.id == mk.id
    assert (await find_checkin_session(db, student=env.s2, schedule_id=mk.id)).id == mk.id  # id in the schedule slot
    res = await student_self_checkin(db, student=env.s1, session=found)
    assert res.statuses[env.s1.id] == "present" and res.session_status == "held"


async def test_makeup_at_an_existing_slot_is_slot_taken(db, env, mon_session):
    await cs.cancel_session(db, session=mon_session, actor=env.admin.user, reason="teacher ill")
    with pytest.raises(DomainError) as exc:
        await cs.create_makeup_session(db, actor=env.admin.user, subject_id=env.subject.id, faculty_id=env.faculty.id,
                                       semester=1, session_date=MON, start_time=time(9), end_time=time(10),
                                       reason="re-run")
    assert exc.value.code == "slot_taken" and exc.value.http_status == 409
    assert exc.value.details["session_id"] == mon_session.id


THU_NOON_DATE = date(2026, 3, 5)
