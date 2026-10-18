"""Integration tests for the teacher routes (``/api/teacher/*`` and teacher assignment in
``/api/teachers``) wired to the attendance domain services (DOMAIN_RULES §5, §6, §8, §9, §13).

Clock: frozen at Monday 2026-03-02 09:30 Asia/Kathmandu, during the cohort's 09:00-10:00 class.
The term covers 2026-01-05 .. 2026-05-29; schedules carry academic_year 2025 on purpose (the
label must never be compared with the calendar year).
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import func, select

pytestmark = pytest.mark.integration

MONDAY = date(2026, 3, 2)
PREV_MONDAY = date(2026, 2, 23)
TUESDAY = date(2026, 3, 3)
ENROLLED_ON = date(2026, 1, 1)


async def _set_tracking_start(db, value: str) -> None:
    """The migration seeds tracking_start_date = migration day; move it before the test term."""
    from app.models import SystemSetting

    row = (await db.execute(select(SystemSetting).where(SystemSetting.key == "attendance_policy"))).scalars().first()
    if row is None:
        db.add(SystemSetting(key="attendance_policy", value={"tracking_start_date": value}, category="attendance",
                             data_type="json", is_active=True))
    else:
        data = dict(row.value or {})
        data["tracking_start_date"] = value
        row.value = data
    await db.flush()


@pytest.fixture
async def env(db, factory, frozen_now):
    clock = frozen_now(datetime(2026, 3, 2, 9, 30))
    await _set_tracking_start(db, "2026-01-01")
    faculty = await factory.faculty()
    subject = await factory.subject(faculty=faculty)
    teacher = await factory.teacher(faculty=faculty)
    other_teacher = await factory.teacher(faculty=faculty)
    students = [await factory.student(faculty=faculty, semester=1, enrolled_on=ENROLLED_ON) for _ in range(3)]
    schedule = await factory.class_schedule(subject=subject, faculty=faculty, day_of_week="MONDAY",
                                            start_time="09:00", end_time="10:00", semester=1,
                                            academic_year=2025, teacher=teacher)
    term = await factory.term(start_date=date(2026, 1, 5), end_date=date(2026, 5, 29), semester_number=1)
    await db.commit()  # release the savepoint so a route-level rollback never discards fixtures
    return SimpleNamespace(clock=clock, faculty=faculty, subject=subject, teacher=teacher,
                           other_teacher=other_teacher, students=students, schedule=schedule, term=term)


def _bulk_body(env, records, **extra):
    body = {
        "subject_id": env.subject.id,
        "semester": 1,
        "faculty_id": env.faculty.id,
        "date": MONDAY.isoformat(),
        "attendance_records": records,
    }
    body.update(extra)
    return body


async def _records(db, session_id):
    from app.models import AttendanceRecord

    rows = (await db.execute(
        select(AttendanceRecord).where(AttendanceRecord.session_id == session_id)
        .execution_options(populate_existing=True)
    )).scalars().all()
    return {r.student_id: r for r in rows}


async def _session(db, session_id):
    from app.models import ClassSession

    return (await db.execute(
        select(ClassSession).where(ClassSession.id == session_id).execution_options(populate_existing=True)
    )).scalars().first()


async def _today_session(db, env):
    from app.services.class_sessions import ensure_sessions_for

    sessions = await ensure_sessions_for(db, session_date=MONDAY, faculty_id=env.faculty.id, semester=1,
                                         subject_id=env.subject.id)
    assert len(sessions) == 1
    return sessions[0]


# --------------------------------------------------------------------------- recording


async def test_teacher_marks_own_session(client, db, env, auth_headers):
    s1, s2, _ = env.students
    resp = await client.post(
        "/api/teacher/attendance/bulk-mark",
        json=_bulk_body(env, [{"student_id": s1.id, "status": "present"}, {"student_id": s2.id, "status": "absent"}]),
        headers=auth_headers(env.teacher),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["success"] is True and body["failed_count"] == 0 and body["errors"] is None
    assert body["success_count"] == 2 and body["session_id"]
    assert {(r["student_id"], r["status"], r["outcome"]) for r in body["results"]} == {
        (s1.id, "present", "created"), (s2.id, "absent", "created")}

    recs = await _records(db, body["session_id"])
    assert set(recs) == {s1.id, s2.id}
    assert all(r.source == "teacher" and r.marked_by == env.teacher.user.id for r in recs.values())
    session = await _session(db, body["session_id"])
    assert session.status == "held" and session.submitted_at is not None

    # re-submitting the same values is a no-op
    again = await client.post(
        "/api/teacher/attendance/bulk-mark",
        json=_bulk_body(env, [{"student_id": s1.id, "status": "present"}], session_id=body["session_id"]),
        headers=auth_headers(env.teacher),
    )
    assert again.status_code == 200, again.text
    assert again.json()["results"][0]["outcome"] == "unchanged"


async def test_other_teachers_session_is_forbidden(client, db, env, auth_headers):
    s1 = env.students[0]
    resp = await client.post(
        "/api/teacher/attendance/bulk-mark",
        json=_bulk_body(env, [{"student_id": s1.id, "status": "present"}]),
        headers=auth_headers(env.other_teacher),
    )
    assert resp.status_code == 403, resp.text
    assert resp.json()["detail"]["code"] == "not_session_teacher"
    from app.models import AttendanceRecord

    assert (await db.execute(select(func.count(AttendanceRecord.id)))).scalar() == 0


async def test_non_enrolled_student_rejects_whole_batch(client, db, env, factory, auth_headers):
    outsider = await factory.student(semester=1, enrolled_on=ENROLLED_ON)  # different faculty
    await db.commit()
    s1 = env.students[0]
    resp = await client.post(
        "/api/teacher/attendance/bulk-mark",
        json=_bulk_body(env, [{"student_id": s1.id, "status": "present"},
                              {"student_id": outsider.id, "status": "present"}]),
        headers=auth_headers(env.teacher),
    )
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    assert detail["code"] == "invalid_entries"
    assert [(e["student_id"], e["code"]) for e in detail["errors"]] == [(outsider.id, "not_enrolled")]
    from app.models import AttendanceRecord

    assert (await db.execute(select(func.count(AttendanceRecord.id)))).scalar() == 0  # all-or-nothing


async def test_roster_shows_null_for_unmarked(client, db, env, auth_headers):
    s1, s2, s3 = env.students
    marked = await client.post("/api/teacher/attendance/bulk-mark",
                               json=_bulk_body(env, [{"student_id": s1.id, "status": "present"}]),
                               headers=auth_headers(env.teacher))
    assert marked.status_code == 200, marked.text

    resp = await client.get(f"/api/teacher/subjects/{env.subject.id}/students-with-attendance",
                            params={"semester": 1, "date": MONDAY.isoformat()}, headers=auth_headers(env.teacher))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    by_id = {s["id"]: s for s in body["students"]}
    assert by_id[s1.id]["attendance_status"] == "present" and by_id[s1.id]["source"] == "teacher"
    assert by_id[s1.id]["record_id"] is not None
    assert by_id[s2.id]["attendance_status"] is None and by_id[s3.id]["attendance_status"] is None
    assert body["unmarked_count"] == 2 and body["absent_count"] == 0
    assert body["session"]["id"] == marked.json()["session_id"]
    assert body["session"]["status"] == "held" and body["session"]["start_time"] == "09:00"
    assert body["is_cancelled"] is False and body["can_edit"] is True and body["term_state"] == "active"
    assert len(body["sessions"]) == 1

    # a past class nobody recorded stays unmarked (never defaulted to absent)
    past = await client.get(f"/api/teacher/subjects/{env.subject.id}/students-with-attendance",
                            params={"semester": 1, "date": PREV_MONDAY.isoformat()}, headers=auth_headers(env.teacher))
    assert past.status_code == 200, past.text
    assert [s["attendance_status"] for s in past.json()["students"]] == [None, None, None]
    assert past.json()["session"]["status"] == "scheduled"


async def test_override_student_face_record_requires_reason_and_is_audited(client, db, env, factory, auth_headers):
    from app.models import AttendanceAuditLog

    s1 = env.students[0]
    session = await _today_session(db, env)
    session.status = "held"
    session_id = session.id  # ORM objects expire when a failing request rolls back
    face = await factory.attendance_record(student=s1, subject=env.subject, date=MONDAY, status="present",
                                           method="face", marked_by=s1, session_id=session_id, source="student_face",
                                           time_slot="09:00-10:00")
    await db.commit()

    no_reason = await client.post("/api/teacher/attendance/mark", json={
        "student_id": s1.id, "subject_id": env.subject.id, "date": MONDAY.isoformat(), "status": "absent",
    }, headers=auth_headers(env.teacher))
    assert no_reason.status_code == 400, no_reason.text
    detail = no_reason.json()["detail"]
    assert detail["code"] == "invalid_entries" and detail["errors"][0]["code"] == "reason_required"
    assert (await _records(db, session_id))[s1.id].status.value == "present"

    with_reason = await client.post(
        "/api/teacher/attendance/bulk-mark",
        json=_bulk_body(env, [{"student_id": s1.id, "status": "absent"}], reason="Left right after roll call"),
        headers=auth_headers(env.teacher),
    )
    assert with_reason.status_code == 200, with_reason.text
    assert with_reason.json()["results"][0]["outcome"] == "updated"
    rec = (await _records(db, session_id))[s1.id]
    assert rec.id == face.id and rec.status.value == "absent" and rec.source == "teacher"

    audit = (await db.execute(
        select(AttendanceAuditLog).where(AttendanceAuditLog.attendance_record_id == face.id)
    )).scalars().all()
    assert len(audit) == 1
    row = audit[0]
    assert (row.action, row.old_status, row.new_status, row.old_source, row.new_source) == (
        "update", "present", "absent", "student_face", "teacher")
    assert row.reason == "Left right after roll call" and row.changed_by == env.teacher.user.id


async def test_single_mark_after_class_requires_confirm_held(client, db, env, auth_headers):
    env.clock.set(datetime(2026, 3, 2, 12, 0))  # class ended 10:00, grace 15 min
    s1 = env.students[0]
    body = {"student_id": s1.id, "subject_id": env.subject.id, "date": MONDAY.isoformat(), "status": "present"}
    first = await client.post("/api/teacher/attendance/mark", json=body, headers=auth_headers(env.teacher))
    assert first.status_code == 409, first.text
    assert first.json()["detail"]["code"] == "confirm_held"
    assert first.json()["detail"]["students_without_record"] == 2  # roster minus the student being written

    confirmed = await client.post("/api/teacher/attendance/mark", json={**body, "confirm_held": True},
                                  headers=auth_headers(env.teacher))
    assert confirmed.status_code == 200, confirmed.text
    data = confirmed.json()
    assert data["success"] is True and data["updated"] is False and data["attendance_id"]
    assert data["session_status"] == "held" and data["outcome"] == "created"


# --------------------------------------------------------------------------- cancellation


async def test_cancel_then_uncancel_round_trip(client, db, env, auth_headers):
    from app.models import AttendanceAuditLog, EnhancedNotification

    headers = auth_headers(env.teacher)
    wrong_day = await client.post("/api/teacher/classes/cancel", json={
        "schedule_id": env.schedule.id, "date": TUESDAY.isoformat(), "reason": "Sick"}, headers=headers)
    assert wrong_day.status_code == 422, wrong_day.text
    assert wrong_day.json()["detail"]["code"] == "not_expected"

    resp = await client.post("/api/teacher/classes/cancel", json={
        "schedule_id": env.schedule.id, "date": MONDAY.isoformat(), "reason": "Sick", "notify_students": True,
    }, headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    session_id = body["session_id"]
    assert body["success"] is True and body["session_status"] == "cancelled"
    assert body["notification_id"] is not None and body["students_notified"] == 3
    note = (await db.execute(select(EnhancedNotification).where(EnhancedNotification.id == body["notification_id"]))).scalars().first()
    assert note.payload["session_id"] == session_id and note.payload["class_cancelled"] is True

    again = await client.post("/api/teacher/classes/cancel", json={"session_id": session_id, "reason": "Sick"},
                              headers=headers)
    assert again.status_code == 409 and again.json()["detail"]["code"] == "already_cancelled"

    roster = await client.get(f"/api/teacher/subjects/{env.subject.id}/students-with-attendance",
                              params={"semester": 1, "date": MONDAY.isoformat()}, headers=headers)
    assert roster.json()["is_cancelled"] is True and roster.json()["cancellation_reason"] == "Sick"
    assert roster.json()["can_edit"] is False

    blocked = await client.post("/api/teacher/attendance/bulk-mark",
                                json=_bulk_body(env, [{"student_id": env.students[0].id, "status": "present"}]),
                                headers=headers)
    assert blocked.status_code == 409 and blocked.json()["detail"]["code"] == "session_cancelled"

    dash = await client.get("/api/teacher/dashboard", headers=headers)
    assert dash.status_code == 200, dash.text
    item = dash.json()["today_schedule"][0]
    assert item["session_id"] == session_id and item["is_cancelled"] is True and item["session_status"] == "cancelled"

    no_reason = await client.post("/api/teacher/classes/uncancel", json={"session_id": session_id}, headers=headers)
    assert no_reason.status_code == 422 and no_reason.json()["detail"]["code"] == "reason_required"
    restored = await client.post("/api/teacher/classes/uncancel", json={
        "subject_id": env.subject.id, "date": MONDAY.isoformat(), "reason": "Recovered", "notify_students": False,
    }, headers=headers)
    assert restored.status_code == 200, restored.text
    assert restored.json()["session_id"] == session_id and restored.json()["session_status"] == "scheduled"

    actions = (await db.execute(
        select(AttendanceAuditLog.action).where(AttendanceAuditLog.session_id == session_id).order_by(AttendanceAuditLog.id)
    )).scalars().all()
    assert actions == ["session_cancelled", "session_uncancelled"]

    marked = await client.post("/api/teacher/attendance/bulk-mark",
                               json=_bulk_body(env, [{"student_id": env.students[0].id, "status": "present"}]),
                               headers=headers)
    assert marked.status_code == 200, marked.text


async def test_cancel_excludes_existing_absences_from_cohort_metrics(client, db, env, auth_headers):
    s1, s2, s3 = env.students
    headers = auth_headers(env.teacher)
    marked = await client.post("/api/teacher/attendance/bulk-mark", json=_bulk_body(env, [
        {"student_id": s1.id, "status": "present"},
        {"student_id": s2.id, "status": "absent"},
        {"student_id": s3.id, "status": "absent"},
    ]), headers=headers)
    assert marked.status_code == 200, marked.text
    session_id = marked.json()["session_id"]

    before = (await client.get(f"/api/teacher/subjects/{env.subject.id}/analytics", params={"semester": 1},
                               headers=headers)).json()
    assert before["considered"] == 3 and before["attended"] == 1 and before["overall_stats"]["absent"] == 2
    row = next(s for s in before["student_attendance"] if s["id"] == s2.id)
    assert row["absent"] == 1 and row["attendance_percentage"] == 0.0 and row["percentage"] == 0.0
    assert row["eligible"] is False and before["term_state"] == "active"

    cancel = await client.post("/api/teacher/classes/cancel", json={
        "session_id": session_id, "reason": "Room flooded", "notify_students": False}, headers=headers)
    assert cancel.status_code == 200, cancel.text

    after = (await client.get(f"/api/teacher/subjects/{env.subject.id}/analytics", params={"semester": 1},
                              headers=headers)).json()
    assert after["considered"] == 0 and after["percentage"] is None and after["has_data"] is False
    assert after["overall_stats"] == {"present": 0, "absent": 0, "late": 0, "excused": 0}
    assert after["sessions"]["cancelled"] == 1
    row = next(s for s in after["student_attendance"] if s["id"] == s2.id)
    assert row["absent"] == 0 and row["percentage"] is None and row["attendance_percentage"] == 0
    assert row["eligible"] is None and row["cancelled_sessions"] == 1
    assert len(await _records(db, session_id)) == 3  # records kept, only excluded


async def test_dashboard_today_schedule_from_sessions(client, db, env, auth_headers):
    resp = await client.get("/api/teacher/dashboard", headers=auth_headers(env.teacher))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["term_state"] == "active" and body["date"] == MONDAY.isoformat()
    assert body["stats"]["classes_today"] == 1 and body["stats"]["total_students"] == 3
    item = body["today_schedule"][0]
    assert item["id"] == env.schedule.id and item["session_id"] and item["session_status"] == "scheduled"
    assert item["recorded_count"] == 0 and item["roster_size"] == 3 and item["is_cancelled"] is False

    env.clock.set(datetime(2026, 6, 15, 9, 30))  # a Monday after the term ended
    between = await client.get("/api/teacher/dashboard", headers=auth_headers(env.teacher))
    assert between.status_code == 200, between.text
    assert between.json()["today_schedule"] == [] and between.json()["term_state"] == "between_terms"


# --------------------------------------------------------------------------- assignment


async def test_teacher_double_booking_assignment_rejected(client, db, env, factory, auth_headers):
    admin = await factory.admin()
    other_subject = await factory.subject(faculty=env.faculty)
    overlapping = await factory.class_schedule(subject=other_subject, faculty=env.faculty, day_of_week="MONDAY",
                                               start_time="09:30", end_time="10:30", semester=3)
    adjacent = await factory.class_schedule(subject=other_subject, faculty=env.faculty, day_of_week="MONDAY",
                                            start_time="10:00", end_time="11:00", semester=5)
    await db.commit()
    headers = auth_headers(admin)

    clash = await client.post(f"/api/teachers/{env.teacher.id}/assignments", json={"schedule_id": overlapping.id},
                              headers=headers)
    assert clash.status_code == 409, clash.text
    assert "overlaps" in clash.json()["detail"]
    from app.models import ClassSchedule

    teacher_of = (await db.execute(select(ClassSchedule.teacher_id).where(ClassSchedule.id == overlapping.id))).scalar()
    assert teacher_of is None

    ok = await client.post(f"/api/teachers/{env.teacher.id}/assignments", json={"schedule_id": adjacent.id},
                           headers=headers)
    assert ok.status_code == 200, ok.text
    assert ok.json()["id"] == adjacent.id


async def test_cancel_never_materializes_before_tracking_start(client, db, env, auth_headers):
    from app.models import ClassSession

    await _set_tracking_start(db, "2026-02-25")
    await db.commit()
    resp = await client.post("/api/teacher/classes/cancel", json={
        "schedule_id": env.schedule.id, "date": PREV_MONDAY.isoformat(), "reason": "Sick"},
        headers=auth_headers(env.teacher))
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"]["code"] == "before_tracking_start"
    count = (await db.execute(select(func.count(ClassSession.id)).where(ClassSession.session_date == PREV_MONDAY))).scalar()
    assert count == 0


async def test_teacher_calendar_lists_cancelled_sessions_and_events(client, db, env, factory, auth_headers):
    """Session-level cancellations no longer create calendar events, so /teacher/calendar
    must surface them itself; multi-day / university-wide events overlapping the window show too."""
    headers = auth_headers(env.teacher)
    resp = await client.post("/api/teacher/classes/cancel", json={
        "schedule_id": env.schedule.id, "date": MONDAY.isoformat(), "reason": "Sick"}, headers=headers)
    assert resp.status_code == 200, resp.text
    session_id = resp.json()["session_id"]

    await factory.holiday(start_date=MONDAY - timedelta(days=3), end_date=MONDAY + timedelta(days=1),
                          title="Festival break")

    cal = await client.get("/api/teacher/calendar", params={
        "start_date": MONDAY.isoformat(), "end_date": MONDAY.isoformat()}, headers=headers)
    assert cal.status_code == 200, cal.text
    items = cal.json()
    cancelled = [i for i in items if i.get("session_id") == session_id]
    assert len(cancelled) == 1 and cancelled[0]["event_type"] == "cancelled_class"
    assert cancelled[0]["description"] == "Sick"
    assert any(i["title"] == "Festival break" and i["is_holiday"] for i in items)
