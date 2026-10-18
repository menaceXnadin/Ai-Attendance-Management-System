"""Integration tests: student face check-in, student "today", timetable integrity, student metrics.

Rules under test: DOMAIN_RULES §6.3, §9, §13.1, §13.9, §13.12. Time is frozen with
``frozen_now`` (naive = Asia/Kathmandu). The face matcher is the harness fake
(``tests/support/fake_face.py``): the route compares the registered embedding with the fake's
current face, so a student registered with ``unit_embedding(1)`` matches by default.
"""
from __future__ import annotations

import json
from datetime import date, datetime

import pytest
from sqlalchemy import func, select, text

from tests.support.fake_face import RELAXED_FACE_POLICY, unit_embedding

MONDAY = date(2025, 3, 3)  # inside the default term 2025-01-06 .. 2025-05-30
IMAGE = "data:image/jpeg;base64,AAAA"


async def _clear_tracking_start(db):
    """The migration sets tracking_start_date to the day the test DB was built; these tests use
    fixed 2025 dates, so sessions must be materializable for them."""
    await db.execute(text(
        "UPDATE system_settings SET value = value - 'tracking_start_date' WHERE key = 'attendance_policy'"))


@pytest.fixture
async def world(db, factory, face_policy):
    """Faculty F (semester 1) with Alpha 09:00-10:00 and Beta 10:00-11:00 on Mondays, one teacher,
    two students (face registered), an active term, and another faculty G with its own subject.

    The face policy is relaxed (no presence code, head turn or passive liveness) because these
    tests are about the attendance rules behind the check-in; the biometric layer in front of
    them is covered by tests/test_face_checkin.py, which also checks in with the full contract
    (burst + challenge + presence code)."""
    await _clear_tracking_start(db)
    await face_policy(**RELAXED_FACE_POLICY)
    fac = await factory.faculty(name="Faculty F")
    teacher = await factory.teacher(faculty=fac)
    alpha = await factory.subject(faculty=fac, name="Alpha")
    beta = await factory.subject(faculty=fac, name="Beta")
    sched_a = await factory.class_schedule(subject=alpha, faculty=fac, day_of_week="MONDAY", start_time="09:00",
                                           end_time="10:00", semester=1, teacher=teacher, classroom="R1")
    sched_b = await factory.class_schedule(subject=beta, faculty=fac, day_of_week="MONDAY", start_time="10:00",
                                           end_time="11:00", semester=1, teacher=teacher)
    term = await factory.term(start_date=date(2025, 1, 6), end_date=date(2025, 5, 30))
    face = json.dumps(unit_embedding(1))
    student = await factory.student(faculty=fac, semester=1, face_encoding=face, enrolled_on=date(2025, 1, 1))
    other = await factory.student(faculty=fac, semester=1, face_encoding=face, enrolled_on=date(2025, 1, 1))
    fac_g = await factory.faculty(name="Faculty G")
    gamma = await factory.subject(faculty=fac_g, name="Gamma")
    await factory.class_schedule(subject=gamma, faculty=fac_g, day_of_week="MONDAY", start_time="09:00",
                                 end_time="10:00", semester=3)
    admin = await factory.admin()
    await db.commit()  # release the savepoint so route rollbacks keep the seed rows

    class W:
        pass

    w = W()
    w.__dict__.update(fac=fac, teacher=teacher, alpha=alpha, beta=beta, sched_a=sched_a, sched_b=sched_b, term=term,
                      student=student, other=other, fac_g=fac_g, gamma=gamma, admin=admin)
    return w


async def _checkin(client, auth_headers, student, **body):
    payload = {"image_data": IMAGE, **body}
    res = await client.post("/api/face-recognition/mark-attendance", json=payload, headers=auth_headers(student))
    assert res.status_code == 200, res.text
    return res.json()


async def _records(db, student_id):
    rows = (await db.execute(text(
        "SELECT r.subject_id, r.status::text AS status, r.source, r.session_id "
        "FROM attendance_records r WHERE r.student_id = :s ORDER BY r.id"), {"s": student_id})).mappings().all()
    return [dict(r) for r in rows]


# ============================================================================ face check-in


async def test_checkin_inside_window_is_present(client, db, world, auth_headers, frozen_now, fake_face):
    frozen_now(datetime(2025, 3, 3, 9, 5))
    body = await _checkin(client, auth_headers, world.student, subject_id=world.alpha.id)
    assert body["success"] is True and body["attendance_marked"] is True
    assert body["status"] == "present"
    assert body["session_id"]
    recs = await _records(db, world.student.id)
    assert recs == [{"subject_id": world.alpha.id, "status": "present", "source": "student_face",
                     "session_id": body["session_id"]}]
    session_status = (await db.execute(text("SELECT status FROM class_sessions WHERE id = :i"),
                                       {"i": body["session_id"]})).scalar()
    assert session_status == "held"


async def test_checkin_after_late_threshold_is_late(client, db, world, auth_headers, frozen_now, fake_face):
    frozen_now(datetime(2025, 3, 3, 9, 15))
    body = await _checkin(client, auth_headers, world.student, subject_id=world.alpha.id)
    assert body["success"] is True
    assert body["status"] == "late"
    assert (await _records(db, world.student.id))[0]["status"] == "late"


async def test_checkin_after_close_is_rejected(client, db, world, auth_headers, frozen_now, fake_face):
    frozen_now(datetime(2025, 3, 3, 9, 25))  # closes at min(end, start + 20 min) = 09:20
    body = await _checkin(client, auth_headers, world.student, subject_id=world.alpha.id)
    assert body["success"] is False and body["attendance_marked"] is False
    assert body["code"] == "window_closed"
    assert body["window_state"] == "closed"
    assert await _records(db, world.student.id) == []


async def test_second_checkin_is_already_recorded(client, db, world, auth_headers, frozen_now, fake_face):
    clock = frozen_now(datetime(2025, 3, 3, 9, 2))
    first = await _checkin(client, auth_headers, world.student, subject_id=world.alpha.id)
    assert first["success"] is True
    clock.advance(minutes=10)
    second = await _checkin(client, auth_headers, world.student, subject_id=world.alpha.id)
    assert second["success"] is False
    assert second["code"] == "already_recorded"
    assert second["current_status"] == "present"
    assert len(await _records(db, world.student.id)) == 1


async def test_checkin_cancelled_session(client, db, factory, world, auth_headers, frozen_now, fake_face):
    await factory.cancelled_class(start_date=MONDAY, faculty=world.fac, subject=world.alpha, title="Teacher away")
    await db.commit()
    frozen_now(datetime(2025, 3, 3, 9, 5))
    body = await _checkin(client, auth_headers, world.student, subject_id=world.alpha.id)
    assert body["success"] is False
    assert body["code"] == "session_cancelled"
    assert await _records(db, world.student.id) == []


async def test_checkin_subject_of_other_cohort_is_not_enrolled(client, db, world, auth_headers, frozen_now, fake_face):
    frozen_now(datetime(2025, 3, 3, 9, 5))
    body = await _checkin(client, auth_headers, world.student, subject_id=world.gamma.id)
    assert body["success"] is False
    assert body["code"] == "not_enrolled"
    assert await _records(db, world.student.id) == []


async def test_checkin_between_terms(client, db, world, auth_headers, frozen_now, fake_face):
    frozen_now(datetime(2025, 7, 7, 9, 5))  # a Monday after the term ended
    body = await _checkin(client, auth_headers, world.student, subject_id=world.alpha.id)
    assert body["success"] is False
    assert body["code"] == "between_terms"
    count = (await db.execute(text("SELECT count(*) FROM class_sessions WHERE session_date = '2025-07-07'"))).scalar()
    assert count == 0


async def test_checkin_face_mismatch_keeps_matching_rules(client, db, world, auth_headers, frozen_now, fake_face):
    frozen_now(datetime(2025, 3, 3, 9, 5))
    fake_face.set_face(embedding=unit_embedding(42))
    body = await _checkin(client, auth_headers, world.student, subject_id=world.alpha.id)
    assert body["success"] is False and body["code"] == "face_mismatch"
    assert await _records(db, world.student.id) == []


async def test_checkin_has_no_auto_absent_side_effects(client, db, world, auth_headers, frozen_now, fake_face):
    # Alpha ended at 10:00 (+15 min grace passed); Beta's window is open until 10:20.
    frozen_now(datetime(2025, 3, 3, 10, 16))
    body = await _checkin(client, auth_headers, world.student, subject_id=world.beta.id)
    assert body["success"] is True and body["status"] == "late"
    recs = await _records(db, world.student.id)
    assert [(r["subject_id"], r["status"]) for r in recs] == [(world.beta.id, "late")]
    assert await _records(db, world.other.id) == []
    total = (await db.execute(text("SELECT count(*) FROM attendance_records"))).scalar()
    assert total == 1


async def test_checkin_without_subject_picks_open_session(client, db, world, auth_headers, frozen_now, fake_face):
    frozen_now(datetime(2025, 3, 3, 9, 55))  # Beta opens at 09:50; Alpha closed at 09:20
    body = await _checkin(client, auth_headers, world.student)
    assert body["success"] is True and body["status"] == "present"
    assert body["subject_id"] == world.beta.id


# ============================================================================ student today


async def test_student_today_lists_sessions_with_window_states(client, db, world, auth_headers, frozen_now, fake_face):
    frozen_now(datetime(2025, 3, 3, 9, 5))
    res = await client.get("/api/schedules/student/today", headers=auth_headers(world.student))
    assert res.status_code == 200, res.text
    items = res.json()
    assert [i["subject_id"] for i in items] == [world.alpha.id, world.beta.id]
    alpha, beta = items
    assert alpha["checkin_window"]["state"] == "open"
    assert alpha["checkin_allowed"] is True
    assert beta["checkin_window"]["state"] == "not_open"
    assert alpha["session_status"] == "scheduled" and alpha["my_status"] is None
    assert alpha["checkin_window"]["opens_at"].startswith("2025-03-03T08:50")
    assert alpha["checkin_window"]["late_after"].startswith("2025-03-03T09:10")
    assert alpha["checkin_window"]["closes_at"].startswith("2025-03-03T09:20")
    assert alpha["term_state"] == "active" and alpha["day_status"] == "instructional"
    assert alpha["id"] == world.sched_a.id and alpha["session_id"]
    assert res.headers["X-Term-State"] == "active"

    await _checkin(client, auth_headers, world.student, subject_id=world.alpha.id)
    res = await client.get("/api/schedules/student/today?envelope=true", headers=auth_headers(world.student))
    data = res.json()
    assert data["term_state"] == "active" and data["day_status"] == "instructional"
    alpha = data["items"][0]
    assert alpha["my_status"] == "present" and alpha["session_status"] == "held"
    assert alpha["checkin_allowed"] is False


async def test_student_today_empty_between_terms_and_on_holiday(client, db, factory, world, auth_headers, frozen_now):
    frozen_now(datetime(2025, 7, 7, 9, 5))
    res = await client.get("/api/schedules/student/today?envelope=true", headers=auth_headers(world.student))
    data = res.json()
    assert data["items"] == [] and data["term_state"] == "between_terms" and data["day_status"] == "between_terms"

    await factory.holiday(start_date=date(2025, 3, 10), title="Festival")
    await db.commit()
    frozen_now(datetime(2025, 3, 10, 9, 5))
    res = await client.get("/api/schedules/student/today?envelope=true", headers=auth_headers(world.student))
    data = res.json()
    assert data["items"] == [] and data["day_status"] == "holiday" and data["term_state"] == "active"
    res = await client.get("/api/schedules/student/today", headers=auth_headers(world.student))
    assert res.json() == []


async def test_student_today_ignores_academic_year_label(client, db, factory, world, auth_headers, frozen_now):
    # Schedules are labelled 2025; a term in 2026 must still produce today's sessions (Rule §3.2).
    await factory.term(start_date=date(2026, 1, 5), end_date=date(2026, 5, 29))
    await db.commit()
    frozen_now(datetime(2026, 3, 2, 9, 5))  # Monday
    res = await client.get("/api/schedules/student/today", headers=auth_headers(world.student))
    assert [i["subject_id"] for i in res.json()] == [world.alpha.id, world.beta.id]


# ============================================================================ timetable integrity


async def test_schedule_update_rejects_cohort_overlap(client, db, world, auth_headers):
    res = await client.put(f"/api/schedules/{world.sched_b.id}", json={"start_time": "09:30"},
                           headers=auth_headers(world.admin))
    assert res.status_code == 409, res.text
    res = await client.put(f"/api/schedules/{world.sched_b.id}", json={"start_time": "11:00", "end_time": "10:30"},
                           headers=auth_headers(world.admin))
    assert res.status_code == 400
    start = (await db.execute(text("SELECT start_time::text FROM class_schedules WHERE id = :i"),
                              {"i": world.sched_b.id})).scalar()
    assert start == "10:00:00"


async def test_schedule_update_rejects_teacher_double_booking(client, db, factory, world, auth_headers):
    other_subject = await factory.subject(faculty=world.fac_g, name="Delta")
    y = await factory.class_schedule(subject=other_subject, faculty=world.fac_g, day_of_week="MONDAY",
                                     start_time="11:00", end_time="12:00", semester=4, teacher=world.teacher)
    z = await factory.class_schedule(subject=other_subject, faculty=world.fac_g, day_of_week="MONDAY",
                                     start_time="09:00", end_time="09:45", semester=5)
    await db.commit()
    res = await client.put(f"/api/schedules/{y.id}", json={"start_time": "09:30", "end_time": "10:30"},
                           headers=auth_headers(world.admin))
    assert res.status_code == 409 and "Teacher" in res.json()["detail"]
    res = await client.put(f"/api/schedules/{z.id}", json={"teacher_id": world.teacher.id},
                           headers=auth_headers(world.admin))
    assert res.status_code == 409
    res = await client.put(f"/api/schedules/{y.id}", json={"start_time": "11:15"}, headers=auth_headers(world.admin))
    assert res.status_code == 200 and res.json()["start_time"] == "11:15"


async def test_schedule_toggle_rejects_overlapping_activation(client, db, factory, world, auth_headers):
    other_subject = await factory.subject(faculty=world.fac_g, name="Epsilon")
    inactive = await factory.class_schedule(subject=other_subject, faculty=world.fac_g, day_of_week="MONDAY",
                                            start_time="09:15", end_time="09:50", semester=5, teacher=world.teacher,
                                            is_active=False)
    await db.commit()
    res = await client.post(f"/api/schedules/{inactive.id}/toggle", headers=auth_headers(world.admin))
    assert res.status_code == 409
    active = (await db.execute(text("SELECT is_active FROM class_schedules WHERE id = :i"), {"i": inactive.id})).scalar()
    assert active is False
    # deactivating an active row is always allowed
    res = await client.post(f"/api/schedules/{world.sched_a.id}/toggle", headers=auth_headers(world.admin))
    assert res.status_code == 200 and res.json()["is_active"] is False
    res = await client.post(f"/api/schedules/{inactive.id}/toggle", headers=auth_headers(world.admin))
    assert res.status_code == 200 and res.json()["is_active"] is True


async def test_schedule_create_rejects_teacher_and_room_conflicts(client, db, world, auth_headers):
    base = {"subject_id": world.gamma.id, "faculty_id": world.fac_g.id, "day_of_week": "monday",
            "start_time": "09:30", "end_time": "10:30", "semester": 7, "academic_year": 2025}
    res = await client.post("/api/schedules", json={**base, "teacher_id": world.teacher.id},
                            headers=auth_headers(world.admin))
    assert res.status_code == 409
    res = await client.post("/api/schedules", json={**base, "classroom": "r1 "}, headers=auth_headers(world.admin))
    assert res.status_code == 409
    res = await client.post("/api/schedules", json={**base, "start_time": "10:30", "end_time": "10:00"},
                            headers=auth_headers(world.admin))
    assert res.status_code == 400
    res = await client.post("/api/schedules", json=base, headers=auth_headers(world.admin))
    assert res.status_code == 200, res.text


async def test_schedule_delete_soft_deactivates_when_sessions_exist(client, db, world, auth_headers, frozen_now):
    frozen_now(datetime(2025, 3, 3, 9, 5))
    res = await client.get("/api/schedules/student/today", headers=auth_headers(world.student))
    assert res.status_code == 200 and len(res.json()) == 2  # materializes today's sessions
    res = await client.delete(f"/api/schedules/{world.sched_a.id}", headers=auth_headers(world.admin))
    assert res.status_code == 200 and res.json()["deactivated"] is True
    row = (await db.execute(text("SELECT is_active FROM class_schedules WHERE id = :i"), {"i": world.sched_a.id})).first()
    assert row is not None and row[0] is False


async def test_schedule_delete_hard_deletes_without_history(client, db, factory, world, auth_headers):
    lone_subject = await factory.subject(faculty=world.fac_g, name="Zeta")
    lone = await factory.class_schedule(subject=lone_subject, faculty=world.fac_g, day_of_week="TUESDAY",
                                        start_time="14:00", end_time="15:00", semester=2)
    await db.commit()
    res = await client.delete(f"/api/schedules/{lone.id}", headers=auth_headers(world.admin))
    assert res.status_code == 200 and res.json()["deleted"] is True
    gone = (await db.execute(text("SELECT count(*) FROM class_schedules WHERE id = :i"), {"i": lone.id})).scalar()
    assert gone == 0


# ============================================================================ student metrics


async def _held_session(factory, w, subject, schedule, d, start="09:00", end="10:00"):
    return await factory.insert("class_sessions", {
        "schedule_id": schedule.id, "kind": "regular", "subject_id": subject.id, "faculty_id": w.fac.id,
        "semester": 1, "term_id": w.term.id, "session_date": d,
        "start_time": datetime.strptime(start, "%H:%M").time(), "end_time": datetime.strptime(end, "%H:%M").time(),
        "teacher_id": w.teacher.id, "status": "held",
    })


async def test_student_summary_without_data(client, db, world, auth_headers, frozen_now):
    frozen_now(datetime(2025, 3, 4, 12, 0))
    res = await client.get("/api/student-attendance/summary", headers=auth_headers(world.student))
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["percentage"] is None and data["has_data"] is False
    assert data["percentage_present"] == 0 and data["attendance_percentage"] == 0
    assert data["total_classes"] == 0 and data["considered"] == 0
    assert data["eligible"] is None
    assert data["term_state"] == "active" and data["term"]["id"] == world.term.id
    assert data["total_academic_days"] > 0 and data["total_periods"] > 0

    for path in ("/api/student-attendance/goals", "/api/student-attendance/analytics",
                 "/api/student-attendance/subject-breakdown?envelope=true", "/api/student-attendance/records"):
        res = await client.get(path, headers=auth_headers(world.student))
        assert res.status_code == 200, (path, res.text)
    breakdown = (await client.get("/api/student-attendance/subject-breakdown?envelope=true", headers=auth_headers(world.student))).json()
    assert {s["subject_id"] for s in breakdown["subjects"]} == {world.alpha.id, world.beta.id}
    assert all(s["percentage"] is None and s["percentage_present"] == 0 for s in breakdown["subjects"])
    # Legacy contract: without ?envelope the endpoint still returns a bare list.
    legacy = (await client.get("/api/student-attendance/subject-breakdown", headers=auth_headers(world.student))).json()
    assert isinstance(legacy, list)
    assert {s["subject_id"] for s in legacy} == {world.alpha.id, world.beta.id}


async def test_student_summary_with_data(client, db, factory, world, auth_headers, frozen_now):
    statuses = {date(2025, 2, 3): "present", date(2025, 2, 10): "late", date(2025, 2, 17): "absent",
                date(2025, 2, 24): "present"}
    for d, st in statuses.items():
        s = await _held_session(factory, world, world.alpha, world.sched_a, d)
        await factory.attendance_record(student=world.student, subject=world.alpha, date=d, status=st,
                                        session_id=s.id, source="teacher", marked_by=world.teacher)
    s = await _held_session(factory, world, world.beta, world.sched_b, date(2025, 2, 3), "10:00", "11:00")
    await factory.attendance_record(student=world.student, subject=world.beta, date=date(2025, 2, 3),
                                    status="excused", session_id=s.id, source="admin", marked_by=world.admin)
    # a legacy record without a session never counts
    await factory.attendance_record(student=world.student, subject=world.beta, date=date(2025, 2, 10),
                                    status="absent", source="legacy")
    await db.commit()
    frozen_now(datetime(2025, 3, 4, 12, 0))

    data = (await client.get("/api/student-attendance/summary", headers=auth_headers(world.student))).json()
    assert data["percentage"] == 75.0 and data["percentage_present"] == 75.0
    assert data["has_data"] is True
    assert (data["considered"], data["attended"], data["excused"]) == (4, 3, 1)
    assert (data["present"], data["late"], data["absent"]) == (2, 1, 1)
    assert data["total_classes"] == 5
    assert data["percentage_absent"] == 25.0 and data["percentage_late"] == 25.0
    assert data["eligible"] is True and data["band"] == "warning"

    breakdown = (await client.get("/api/student-attendance/subject-breakdown?envelope=true",
                                  headers=auth_headers(world.student))).json()
    by_id = {s["subject_id"]: s for s in breakdown["subjects"]}
    assert by_id[world.alpha.id]["percentage"] == 75.0
    assert by_id[world.alpha.id]["total_classes"] == 4 and by_id[world.alpha.id]["absent_classes"] == 1
    assert by_id[world.alpha.id]["last_attendance"] == "2025-02-24"
    assert by_id[world.alpha.id]["streak"] == 1
    assert by_id[world.beta.id]["percentage"] is None and by_id[world.beta.id]["excused"] == 1

    goals = (await client.get("/api/student-attendance/goals", headers=auth_headers(world.student)))
    assert goals.status_code == 200, goals.text
    g = {x["target_percentage"]: x for x in goals.json()["goals"]}
    assert g[75]["classes_needed"] >= 0 and goals.json()["current_status"]["percentage"] == 75.0

    analytics = await client.get("/api/student-attendance/analytics", headers=auth_headers(world.student))
    assert analytics.status_code == 200, analytics.text
    a = analytics.json()
    assert a["total_records"] == 4 and a["daily_breakdown"]["Monday"]["total"] == 4
    assert a["daily_breakdown"]["Monday"]["percentage"] == 75.0
    assert a["period_summary"]["percentage"] == 75.0

    records = (await client.get("/api/student-attendance/records", headers=auth_headers(world.student))).json()
    assert records["total"] == 6
