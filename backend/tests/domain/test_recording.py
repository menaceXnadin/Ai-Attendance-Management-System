"""Recording attendance (DOMAIN_RULES §6, §13.3 held transition / confirm_held, §13.8 reasons,
§13.9 self check-in, §13.10 cancelled sessions & serialization)."""
from __future__ import annotations

from datetime import date, time, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.services.attendance_recording import (
    Entry,
    find_checkin_session,
    record_attendance,
    set_metrics_exclusion,
    student_self_checkin,
)
from app.services.class_sessions import cancel_session, ensure_sessions_for
from app.services.domain_errors import DomainError

from .conftest import MON, NEXT_MON, WED, at, audit_rows, count, get_session, insert_record, records_for

pytestmark = pytest.mark.integration


async def _write(db, actor, session, *entries, **kw):
    return await record_attendance(db, actor=actor, session=session,
                                   entries=[Entry(sid, st, *rest) for sid, st, *rest in entries], **kw)


async def _audit_count(db, session_id) -> int:
    return await count(db, "SELECT count(*) FROM attendance_audit_log WHERE session_id = :s "
                           "AND action IN ('create', 'update')", s=session_id)


# ============================================================================ student self check-in


class TestSelfCheckin:
    async def test_present_then_already_recorded(self, db, env, mon_session, frozen_now):
        frozen_now(at(MON, 8, 55))
        res = await student_self_checkin(db, student=env.s1, session=mon_session, confidence=0.93)
        assert res.statuses[env.s1.id] == "present"
        (rec,) = await records_for(db, mon_session.id)
        assert (rec["source"], rec["method"], rec["marked_by"]) == ("student_face", "face", env.s1.user_id)
        assert (await get_session(db, mon_session.id)).status == "held"
        with pytest.raises(DomainError) as exc:
            await student_self_checkin(db, student=env.s1, session=mon_session, confidence=0.9)
        assert exc.value.code == "already_recorded" and exc.value.details["current_status"] == "present"
        assert len(await records_for(db, mon_session.id)) == 1

    @pytest.mark.parametrize("hh,mm,expected", [(8, 50, "present"), (9, 10, "present"), (9, 10, "present"),
                                                (9, 11, "late"), (9, 19, "late")])
    async def test_status_computed_by_server(self, db, env, mon_session, frozen_now, hh, mm, expected):
        frozen_now(at(MON, hh, mm))
        res = await student_self_checkin(db, student=env.s1, session=mon_session)
        assert res.statuses[env.s1.id] == expected

    @pytest.mark.parametrize("hh,mm,state", [(8, 49, "not_open"), (9, 20, "closed"), (9, 59, "closed"), (10, 5, "closed")])
    async def test_outside_window_rejected(self, db, env, mon_session, frozen_now, hh, mm, state):
        frozen_now(at(MON, hh, mm))
        with pytest.raises(DomainError) as exc:
            await student_self_checkin(db, student=env.s1, session=mon_session)
        assert exc.value.code == "window_closed" and exc.value.details["window_state"] == state
        assert await records_for(db, mon_session.id) == []
        assert (await get_session(db, mon_session.id)).status == "scheduled"

    async def test_other_cohort_not_enrolled(self, db, env, mon_session, frozen_now):
        frozen_now(at(MON, 9))
        with pytest.raises(DomainError) as exc:
            await student_self_checkin(db, student=env.outsider, session=mon_session)
        assert exc.value.code == "not_enrolled"

    async def test_enrolled_after_session_date_not_enrolled(self, db, env, factory, mon_session, frozen_now):
        late_joiner = await factory.student(faculty=env.faculty, semester=1, enrolled_on=MON + timedelta(days=1))
        frozen_now(at(MON, 9))
        with pytest.raises(DomainError) as exc:
            await student_self_checkin(db, student=late_joiner, session=mon_session)
        assert exc.value.code == "not_enrolled"

    async def test_cohort_since_after_session_not_enrolled(self, db, env, factory, mon_session, frozen_now):
        mover = await factory.student(faculty=env.faculty, semester=1, enrolled_on=date(2025, 1, 1),
                                      cohort_since=MON + timedelta(days=1))
        frozen_now(at(MON, 9))
        with pytest.raises(DomainError) as exc:
            await student_self_checkin(db, student=mover, session=mon_session)
        assert exc.value.code == "not_enrolled"

    async def test_inactive_user_not_enrolled(self, db, env, mon_session, frozen_now):
        await db.execute(text("UPDATE users SET is_active = false WHERE id = :u"), {"u": env.s1.user_id})
        frozen_now(at(MON, 9))
        with pytest.raises(DomainError) as exc:
            await student_self_checkin(db, student=env.s1, session=mon_session)
        assert exc.value.code == "not_enrolled"

    async def test_cancelled_session_rejected(self, db, env, mon_session, frozen_now):
        await cancel_session(db, session=mon_session, actor=env.admin.user, reason="strike")
        frozen_now(at(MON, 9))
        with pytest.raises(DomainError) as exc:
            await student_self_checkin(db, student=env.s1, session=mon_session)
        assert exc.value.code == "session_cancelled"

    async def test_only_today(self, db, env, mon_session, frozen_now):
        frozen_now(at(MON + timedelta(days=1), 9))
        with pytest.raises(DomainError) as exc:
            await student_self_checkin(db, student=env.s1, session=mon_session)
        assert exc.value.code == "no_session_today"

    async def test_find_checkin_session_picks_slot_whose_window_contains_now(self, db, env, factory, frozen_now):
        await factory.class_schedule(subject=env.subject, faculty=env.faculty, day_of_week="MONDAY",
                                     start_time="13:00", end_time="14:00", semester=1, teacher=env.teacher)
        frozen_now(at(MON, 12, 55))
        s = await find_checkin_session(db, student=env.s1, subject_id=env.subject.id)
        assert s.start_time == time(13)
        frozen_now(at(MON, 9, 5))
        s = await find_checkin_session(db, student=env.s1, subject_id=env.subject.id)
        assert s.start_time == time(9)
        frozen_now(at(MON, 11))
        with pytest.raises(DomainError) as exc:
            await find_checkin_session(db, student=env.s1, subject_id=env.subject.id)
        assert exc.value.code == "window_closed"

    async def test_find_checkin_between_terms(self, db, env, frozen_now):
        frozen_now(at(date(2026, 7, 6), 9))
        with pytest.raises(DomainError) as exc:
            await find_checkin_session(db, student=env.s1, subject_id=env.subject.id)
        assert exc.value.code == "between_terms"

    async def test_find_checkin_no_session_today(self, db, env, frozen_now):
        frozen_now(at(MON + timedelta(days=1), 9))  # Tuesday: no class
        with pytest.raises(DomainError) as exc:
            await find_checkin_session(db, student=env.s1, subject_id=env.subject.id)
        assert exc.value.code == "no_session_today"


# ============================================================================ teacher / admin writes


class TestTeacherWrites:
    async def test_owner_teacher_can_record(self, db, env, mon_session):
        res = await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"), (env.s2.id, "late"))
        assert (res.created, res.updated, res.unchanged) == (2, 0, 0)
        recs = await records_for(db, mon_session.id)
        assert {r["source"] for r in recs} == {"teacher"}
        assert all(r["marked_by"] == env.teacher.user.id for r in recs)
        s = await get_session(db, mon_session.id)
        assert s.status == "held" and s.attendance_taken_at is not None
        assert await _audit_count(db, mon_session.id) == 2

    async def test_other_teacher_rejected(self, db, env, mon_session):
        with pytest.raises(DomainError) as exc:
            await _write(db, env.other_teacher.user, mon_session, (env.s1.id, "present"))
        assert exc.value.code == "not_session_teacher"
        assert await records_for(db, mon_session.id) == []

    async def test_schedule_teacher_owns_session_without_snapshot_teacher(self, db, env, mon_session):
        await db.execute(text("UPDATE class_sessions SET teacher_id = NULL WHERE id = :i"), {"i": mon_session.id})
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"))
        assert len(await records_for(db, mon_session.id)) == 1

    async def test_future_session_rejected(self, db, env, mon_session, frozen_now):
        frozen_now(at(MON, 8, 49))  # before start - opens_before
        with pytest.raises(DomainError) as exc:
            await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"))
        assert exc.value.code == "session_not_started"
        frozen_now(at(MON, 8, 50))
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"))

    async def test_not_enrolled_student_rejected(self, db, env, mon_session):
        with pytest.raises(DomainError) as exc:
            await _write(db, env.teacher.user, mon_session, (env.outsider.id, "present"))
        assert exc.value.details["errors"][0]["code"] == "not_enrolled"

    async def test_teacher_edit_window(self, db, env, mon_session, frozen_now):
        frozen_now(at(MON + timedelta(days=7), 12))  # last day of the window
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"), submit=True, confirm_held=True)
        frozen_now(at(MON + timedelta(days=8), 12))
        with pytest.raises(DomainError) as exc:
            await _write(db, env.teacher.user, mon_session, (env.s2.id, "present"))
        assert exc.value.code == "edit_window_closed"
        # admin after the window needs a reason
        with pytest.raises(DomainError) as exc:
            await _write(db, env.admin.user, mon_session, (env.s2.id, "present"))
        assert exc.value.details["errors"][0]["code"] == "reason_required"
        await _write(db, env.admin.user, mon_session, (env.s2.id, "present"), reason="late paperwork")

    async def test_teacher_cannot_excuse(self, db, env, mon_session):
        with pytest.raises(DomainError) as exc:
            await _write(db, env.teacher.user, mon_session, (env.s1.id, "excused", "medical"))
        assert exc.value.details["errors"][0]["code"] == "excused_admin_only"

    async def test_teacher_overrides_own_record_without_reason(self, db, env, mon_session):
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"))
        res = await _write(db, env.teacher.user, mon_session, (env.s1.id, "late"))
        assert res.updated == 1

    async def test_face_record_override_requires_reason(self, db, env, mon_session, frozen_now):
        frozen_now(at(MON, 9))
        await student_self_checkin(db, student=env.s1, session=mon_session)
        frozen_now(at(MON, 9, 30))
        with pytest.raises(DomainError) as exc:
            await _write(db, env.teacher.user, mon_session, (env.s1.id, "absent"))
        assert exc.value.details["errors"][0]["code"] == "reason_required"
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "absent", "proxy attendance"))
        (rec,) = await records_for(db, mon_session.id)
        assert (rec["status"], rec["source"]) == ("absent", "teacher")

    async def test_batch_reason_fills_entries_that_need_one(self, db, env, mon_session, frozen_now):
        frozen_now(at(MON, 9))
        await student_self_checkin(db, student=env.s1, session=mon_session)
        frozen_now(at(MON, 9, 30))
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "absent"), (env.s2.id, "present"),
                     reason="face spoof detected")
        upd = [r for r in await audit_rows(db, session_id=mon_session.id, action="update")]
        assert len(upd) == 1 and upd[0]["reason"] == "face spoof detected"


class TestAdminWrites:
    async def test_admin_override_of_teacher_record_needs_reason(self, db, env, mon_session):
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "absent"))
        with pytest.raises(DomainError) as exc:
            await _write(db, env.admin.user, mon_session, (env.s1.id, "present"))
        assert exc.value.details["errors"][0]["code"] == "reason_required"
        await _write(db, env.admin.user, mon_session, (env.s1.id, "present", "doctor's note"))
        (rec,) = await records_for(db, mon_session.id)
        assert (rec["status"], rec["source"]) == ("present", "admin")
        (row,) = await audit_rows(db, session_id=mon_session.id, action="update")
        assert (row["old_status"], row["new_status"], row["old_source"], row["new_source"]) == (
            "absent", "present", "teacher", "admin")
        assert row["reason"] == "doctor's note" and row["changed_by"] == env.admin.user.id

    async def test_admin_overrides_system_auto_without_reason(self, db, env, factory, mon_session):
        await insert_record(factory, student=env.s1, session=mon_session, status="absent", source="system_auto")
        await db.execute(text("UPDATE class_sessions SET status = 'held' WHERE id = :i"), {"i": mon_session.id})
        await _write(db, env.admin.user, mon_session, (env.s1.id, "present"))

    async def test_excused_admin_only_needs_reason_and_does_not_hold_session(self, db, env, mon_session):
        with pytest.raises(DomainError):
            await _write(db, env.admin.user, mon_session, (env.s1.id, "excused"))
        res = await _write(db, env.admin.user, mon_session, (env.s1.id, "excused", "medical leave"))
        assert res.created == 1
        s = await get_session(db, mon_session.id)
        assert s.status == "scheduled", "an excused write must never move a session to held (§13.3)"


# ============================================================================ provenance / audit / no-op


class TestProvenance:
    async def test_overriding_system_auto_updates_provenance_and_audits(self, db, env, factory, mon_session):
        await db.execute(text("UPDATE class_sessions SET status = 'held' WHERE id = :i"), {"i": mon_session.id})
        auto = await insert_record(factory, student=env.s1, session=mon_session, status="absent", source="system_auto",
                                   notes="Auto-marked absent: no check-in recorded for a held session")
        res = await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"))  # no reason needed
        assert res.updated == 1
        (rec,) = await records_for(db, mon_session.id)
        assert rec["id"] == auto.id
        assert rec["status"] == "present" and rec["source"] == "teacher" and rec["method"] == "manual"
        assert rec["location"] != "AUTO_ABSENT_SYSTEM" and rec["marked_by"] == env.teacher.user.id
        assert "Auto-marked" not in (rec["notes"] or "")
        (row,) = await audit_rows(db, attendance_record_id=auto.id, action="update")
        assert (row["old_status"], row["new_status"], row["old_source"], row["new_source"]) == (
            "absent", "present", "system_auto", "teacher")

    async def test_same_value_write_is_noop_without_audit(self, db, env, mon_session):
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"))
        n_audit = await _audit_count(db, mon_session.id)
        res = await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"))
        assert (res.created, res.updated, res.unchanged) == (0, 0, 1)
        assert await _audit_count(db, mon_session.id) == n_audit
        assert len(await records_for(db, mon_session.id)) == 1

    async def test_every_change_writes_audit(self, db, env, mon_session):
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"))
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "late"))
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "absent"))
        rows = await audit_rows(db, session_id=mon_session.id, student_id=env.s1.id)
        assert [(r["action"], r["old_status"], r["new_status"]) for r in rows] == [
            ("create", None, "present"), ("update", "present", "late"), ("update", "late", "absent")]


# ============================================================================ atomicity / duplicates


class TestAtomicity:
    async def test_batch_is_all_or_nothing(self, db, env, mon_session):
        with pytest.raises(DomainError) as exc:
            await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"), (env.s2.id, "present"),
                         (env.outsider.id, "present"))
        assert exc.value.code == "validation_failed"
        assert [e["student_id"] for e in exc.value.details["errors"]] == [env.outsider.id]
        assert await records_for(db, mon_session.id) == []
        assert await _audit_count(db, mon_session.id) == 0
        assert (await get_session(db, mon_session.id)).status == "scheduled"

    async def test_invalid_status_rejects_whole_batch(self, db, env, mon_session):
        with pytest.raises(DomainError):
            await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"), (env.s2.id, "cancelled"))
        assert await records_for(db, mon_session.id) == []

    async def test_duplicate_student_in_batch_rejected(self, db, env, mon_session):
        with pytest.raises(DomainError) as exc:
            await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"), (env.s1.id, "absent"))
        assert exc.value.details["errors"][0]["code"] == "duplicate_entry"
        assert await records_for(db, mon_session.id) == []

    async def test_sequential_double_write_never_duplicates(self, db, env, mon_session, frozen_now):
        frozen_now(at(MON, 9, 1))
        await student_self_checkin(db, student=env.s1, session=mon_session)
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"))
        await _write(db, env.teacher.user, mon_session, (env.s2.id, "present"))
        await _write(db, env.teacher.user, mon_session, (env.s2.id, "late"))
        await _write(db, env.admin.user, mon_session, (env.s2.id, "late"))
        recs = await records_for(db, mon_session.id)
        assert sorted(r["student_id"] for r in recs) == [env.s1.id, env.s2.id]

    async def test_db_enforces_one_record_per_student_per_session(self, db, env, factory, mon_session):
        await insert_record(factory, student=env.s1, session=mon_session)
        with pytest.raises(IntegrityError):
            async with db.begin_nested():
                await insert_record(factory, student=env.s1, session=mon_session, status="absent")

    async def test_two_sessions_same_subject_same_day_allowed(self, db, env, factory, frozen_now):
        from app.services.class_sessions import ensure_sessions_for

        await factory.class_schedule(subject=env.subject, faculty=env.faculty, day_of_week="MONDAY",
                                     start_time="13:00", end_time="14:00", semester=1, teacher=env.teacher)
        frozen_now(at(MON, 14, 5))
        a, b = await ensure_sessions_for(db, session_date=MON, faculty_id=env.faculty.id, semester=1)
        await _write(db, env.teacher.user, a, (env.s1.id, "present"), submit=True, confirm_held=True)  # past grace
        await _write(db, env.teacher.user, b, (env.s1.id, "absent"), submit=True)  # 14:05 < 14:00 + grace
        assert len(await records_for(db, a.id)) == 1 and len(await records_for(db, b.id)) == 1


# ============================================================================ cancelled sessions (§13.10)


class TestCancelledSessions:
    async def test_all_writers_reject_cancelled_session(self, db, env, mon_session):
        await cancel_session(db, session=mon_session, actor=env.admin.user, reason="strike")
        for actor in (env.teacher.user, env.admin.user):
            with pytest.raises(DomainError) as exc:
                await _write(db, actor, mon_session, (env.s1.id, "present"), reason="r")
            assert exc.value.code == "session_cancelled"
        assert await records_for(db, mon_session.id) == []


# ============================================================================ held transition / confirm_held (§13.3)


class TestHeldTransition:
    async def test_single_write_after_grace_needs_confirm_held(self, db, env, mon_session, frozen_now):
        frozen_now(at(MON, 10, 15))  # end + grace
        with pytest.raises(DomainError) as exc:
            await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"))
        assert exc.value.code == "confirm_held"
        assert exc.value.details["students_without_record"] == 2
        assert await records_for(db, mon_session.id) == []
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"), confirm_held=True)
        assert (await get_session(db, mon_session.id)).status == "held"

    async def test_no_confirm_needed_before_grace_late_submission_needs_it(self, db, env, mon_session, frozen_now):
        """§13.3 as amended: submissions before end + grace need no confirmation; a submission on an
        unrecorded past class does (the finalizer would mark everyone else absent)."""
        frozen_now(at(MON, 10, 14))
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"))
        frozen_now(at(WED, 9, 30))
        (wed,) = await ensure_sessions_for(db, session_date=WED, faculty_id=env.faculty.id, semester=1)
        res = await _write(db, env.teacher.user, wed, (env.s1.id, "present"), submit=True)
        assert res.submitted and (await get_session(db, wed.id)).submitted_at is not None
        frozen_now(at(NEXT_MON, 18))
        (late,) = await ensure_sessions_for(db, session_date=NEXT_MON, faculty_id=env.faculty.id, semester=1)
        with pytest.raises(DomainError) as exc:
            await _write(db, env.teacher.user, late, (env.s1.id, "present"), submit=True)
        assert exc.value.code == "confirm_held" and exc.value.details["students_without_record"] == 2
        assert await records_for(db, late.id) == []
        res = await _write(db, env.teacher.user, late, (env.s1.id, "present"), submit=True, confirm_held=True)
        assert res.submitted and (await get_session(db, late.id)).status == "held"

    async def test_excused_after_grace_needs_no_confirm(self, db, env, mon_session, frozen_now):
        frozen_now(at(MON, 18))
        await _write(db, env.admin.user, mon_session, (env.s1.id, "excused", "medical"))
        assert (await get_session(db, mon_session.id)).status == "scheduled"

    async def test_submit_marks_held_and_mark_remaining_absent_is_a_teacher_write(self, db, env, mon_session, frozen_now):
        frozen_now(at(MON, 9, 40))
        res = await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"), mark_remaining_absent=True)
        s = await get_session(db, mon_session.id)
        assert s.status == "held" and s.submitted_at is not None and res.submitted
        recs = {r["student_id"]: (r["status"], r["source"]) for r in await records_for(db, mon_session.id)}
        assert recs == {env.s1.id: ("present", "teacher"), env.s2.id: ("absent", "teacher"),
                        env.s3.id: ("absent", "teacher")}
        assert await audit_rows(db, session_id=mon_session.id, action="session_submitted")

    async def test_empty_submit_holds_session(self, db, env, mon_session, frozen_now):
        frozen_now(at(MON, 9, 40))
        await _write(db, env.teacher.user, mon_session, submit=True)
        assert (await get_session(db, mon_session.id)).status == "held"


# ============================================================================ metrics exclusion (§13.5)


class TestMetricsExclusion:
    async def test_admin_only_reason_required_audited(self, db, env, mon_session):
        await _write(db, env.teacher.user, mon_session, (env.s1.id, "present"))
        (rec,) = await records_for(db, mon_session.id)
        with pytest.raises(DomainError):
            await set_metrics_exclusion(db, actor=env.teacher.user, record_id=rec["id"], excluded=True, reason="x")
        with pytest.raises(DomainError):
            await set_metrics_exclusion(db, actor=env.admin.user, record_id=rec["id"], excluded=True, reason="")
        await set_metrics_exclusion(db, actor=env.admin.user, record_id=rec["id"], excluded=True, reason="dup")
        (rec,) = await records_for(db, mon_session.id)
        assert rec["excluded_from_metrics"] is True and rec["status"] == "present"
        assert await audit_rows(db, attendance_record_id=rec["id"], action="metrics_exclusion")
