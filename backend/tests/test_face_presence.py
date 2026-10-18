"""Proof of presence (docs/system/face-verification.md §9): the staff endpoints
``GET /api/attendance/sessions/{id}/presence-code`` and ``.../face-attempts``.

Guard: admin, or the teacher who owns the session (``actor_owns_session``); other teachers get
403 ``not_session_teacher``; students 403. Time is frozen (naive = Asia/Kathmandu).
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import text

from app.services import presence_code
from app.services.face_attempts import record_attempt
from tests.support.fake_face import checkin_burst, unit_embedding

MONDAY = date(2025, 3, 3)
FRAME = "data:image/jpeg;base64,AAAA"
EMB = unit_embedding(1)


@pytest.fixture
async def world(db, factory, frozen_now):
    """Faculty F: Alpha 09:00-10:00 (owned by `teacher`) and Beta 10:00-11:00 (no teacher) on
    Mondays; an active term; an enrolled student with EMB registered; another teacher; an admin."""
    await db.execute(text(
        "UPDATE system_settings SET value = value - 'tracking_start_date' WHERE key = 'attendance_policy'"))
    fac = await factory.faculty(name="Faculty F")
    teacher = await factory.teacher(faculty=fac)
    stranger = await factory.teacher(faculty=fac)
    alpha = await factory.subject(faculty=fac, name="Alpha")
    beta = await factory.subject(faculty=fac, name="Beta")
    await factory.class_schedule(subject=alpha, faculty=fac, day_of_week="MONDAY", start_time="09:00",
                                 end_time="10:00", semester=1, teacher=teacher)
    await factory.class_schedule(subject=beta, faculty=fac, day_of_week="MONDAY", start_time="10:00",
                                 end_time="11:00", semester=1)
    await factory.term(start_date=date(2025, 1, 6), end_date=date(2025, 5, 30))
    student = await factory.student(faculty=fac, semester=1, face_encoding=json.dumps(EMB),
                                    enrolled_on=date(2025, 1, 1), full_name="Asha Rai", student_id="ROLL-001")
    admin = await factory.admin()
    await db.commit()
    clock = frozen_now(datetime(2025, 3, 3, 9, 5))

    from app.services.class_sessions import ensure_sessions_for

    sessions = await ensure_sessions_for(db, session_date=MONDAY, faculty_id=fac.id, semester=1)
    await db.commit()

    class W:
        pass

    w = W()
    w.__dict__.update(fac=fac, teacher=teacher, stranger=stranger, alpha=alpha, beta=beta, student=student,
                      admin=admin, clock=clock,
                      alpha_sid=next(s.id for s in sessions if s.subject_id == alpha.id),
                      beta_sid=next(s.id for s in sessions if s.subject_id == beta.id))
    return w


def _url(session_id: int, what: str = "presence-code") -> str:
    return f"/api/attendance/sessions/{session_id}/{what}"


# ============================================================================ presence-code


async def test_presence_code_for_admin(client, world, auth_headers):
    res = await client.get(_url(world.alpha_sid), headers=auth_headers(world.admin))
    assert res.status_code == 200, res.text
    body = res.json()
    now = world.clock.now
    assert body["session_id"] == world.alpha_sid and body["digits"] == 6 and len(body["code"]) == 6
    assert body["code"] == presence_code.code_for(world.alpha_sid, now, 30)
    assert presence_code.verify_code(world.alpha_sid, body["code"], now, 30)
    assert body["period_seconds"] == 30 and 1 <= body["expires_in_seconds"] <= 30
    assert body["expires_in_seconds"] == presence_code.seconds_until_rotation(now, 30)
    assert body["required"] is True
    assert body["checkin_path"] == f"/student/attendance/mark?session={world.alpha_sid}&code={body['code']}"
    assert body["window"]["state"] == "open"
    assert body["window"]["opens_at"].startswith("2025-03-03T08:50")
    assert body["window"]["closes_at"].startswith("2025-03-03T09:20")
    assert body["subject_name"] == "Alpha" and body["start_time"] == "09:00" and body["end_time"] == "10:00"
    assert datetime.fromisoformat(body["server_time"]) == now

    beta = (await client.get(_url(world.beta_sid), headers=auth_headers(world.admin))).json()
    assert beta["window"]["state"] == "not_open"


async def test_presence_code_rotates_and_follows_policy(client, world, auth_headers, face_policy):
    first = (await client.get(_url(world.alpha_sid), headers=auth_headers(world.admin))).json()
    world.clock.advance(seconds=first["expires_in_seconds"])
    second = (await client.get(_url(world.alpha_sid), headers=auth_headers(world.admin))).json()
    assert second["expires_in_seconds"] == 30
    assert presence_code.verify_code(world.alpha_sid, first["code"], world.clock.now, 30)  # previous step still valid

    await face_policy(require_presence_code=False, presence_code_period_seconds=60)
    body = (await client.get(_url(world.alpha_sid), headers=auth_headers(world.admin))).json()
    assert body["required"] is False and body["period_seconds"] == 60
    assert body["code"] == presence_code.code_for(world.alpha_sid, world.clock.now, 60)


async def test_presence_code_guard(client, world, auth_headers):
    res = await client.get(_url(world.alpha_sid), headers=auth_headers(world.teacher))
    assert res.status_code == 200, res.text
    res = await client.get(_url(world.alpha_sid), headers=auth_headers(world.stranger))
    assert res.status_code == 403 and res.json()["detail"]["code"] == "not_session_teacher"
    res = await client.get(_url(world.beta_sid), headers=auth_headers(world.teacher))  # no teacher assigned
    assert res.status_code == 403 and res.json()["detail"]["code"] == "not_session_teacher"
    res = await client.get(_url(world.alpha_sid), headers=auth_headers(world.student))
    assert res.status_code == 403
    assert (await client.get(_url(world.alpha_sid))).status_code in (401, 403)
    res = await client.get(_url(987654), headers=auth_headers(world.admin))
    assert res.status_code == 404 and res.json()["detail"]["code"] == "session_not_found"


async def test_presence_code_not_today(client, world, auth_headers):
    world.clock.set(datetime(2025, 3, 4, 9, 5))
    res = await client.get(_url(world.alpha_sid), headers=auth_headers(world.teacher))
    assert res.status_code == 409 and res.json()["detail"]["code"] == "not_today"


async def test_presence_code_cancelled_session(client, db, world, auth_headers):
    res = await client.post(f"/api/attendance/sessions/{world.alpha_sid}/cancel", json={"reason": "Teacher away"},
                            headers=auth_headers(world.admin))
    assert res.status_code == 200, res.text
    res = await client.get(_url(world.alpha_sid), headers=auth_headers(world.admin))
    assert res.status_code == 409 and res.json()["detail"]["code"] == "session_cancelled"


async def test_code_from_the_classroom_screen_checks_a_student_in(client, db, world, auth_headers, fake_face):
    code = (await client.get(_url(world.alpha_sid), headers=auth_headers(world.teacher))).json()["code"]
    res = await client.post("/api/face-recognition/challenge", json={"purpose": "checkin", "session_id": world.alpha_sid},
                            headers=auth_headers(world.student))
    challenge = res.json()
    fake_face.set_frames(checkin_burst(EMB, "left" if challenge["action"] == "turn_left" else "right"))
    world.clock.advance(seconds=20)
    res = await client.post("/api/face-recognition/mark-attendance",
                            json={"frames": [FRAME] * 3, "challenge_id": challenge["challenge_id"],
                                  "presence_code": code, "session_id": world.alpha_sid},
                            headers=auth_headers(world.student))
    body = res.json()
    assert body["success"] is True and body["status"] == "present" and body["session_id"] == world.alpha_sid, body


# ============================================================================ face-attempts


async def test_face_attempts_list_and_summary(client, db, world, auth_headers, fake_face):
    now = world.clock.now
    await record_attempt(db, student_id=world.student.id, purpose="checkin", outcome="presence_code_invalid",
                         session_id=world.alpha_sid, now=now - timedelta(minutes=3))
    await record_attempt(db, student_id=world.student.id, purpose="checkin", outcome="face_mismatch",
                         session_id=world.alpha_sid, similarity=0.12, now=now - timedelta(minutes=2))
    await record_attempt(db, student_id=world.student.id, purpose="checkin", outcome="liveness_unavailable",
                         session_id=world.alpha_sid, similarity=0.98, now=now - timedelta(minutes=1))
    await record_attempt(db, student_id=world.student.id, purpose="checkin", outcome="face_mismatch",
                         session_id=world.beta_sid, now=now - timedelta(minutes=1))
    await db.commit()
    # plus a real successful check-in through the endpoint
    code = presence_code.code_for(world.alpha_sid, now, 30)
    challenge = (await client.post("/api/face-recognition/challenge", json={"purpose": "checkin"},
                                   headers=auth_headers(world.student))).json()
    fake_face.set_frames(checkin_burst(EMB, "left" if challenge["action"] == "turn_left" else "right"))
    body = (await client.post("/api/face-recognition/mark-attendance",
                              json={"frames": [FRAME] * 3, "challenge_id": challenge["challenge_id"],
                                    "presence_code": code}, headers=auth_headers(world.student))).json()
    assert body["success"] is True, body

    res = await client.get(_url(world.alpha_sid, "face-attempts"), headers=auth_headers(world.teacher))
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["session_id"] == world.alpha_sid
    assert [a["outcome"] for a in data["attempts"]] == [
        "success", "liveness_unavailable", "face_mismatch", "presence_code_invalid"]  # newest first
    top = data["attempts"][0]
    assert top["student_id"] == world.student.id and top["student_name"] == "Asha Rai"
    assert top["roll_number"] == "ROLL-001" and top["counts_as_failure"] is False
    assert top["similarity"] == pytest.approx(1.0) and top["liveness_score"] == pytest.approx(0.95)
    assert set(top) == {"id", "student_id", "student_name", "roll_number", "outcome", "counts_as_failure",
                        "similarity", "liveness_score", "created_at"}
    assert data["attempts"][2]["similarity"] == pytest.approx(0.12)
    assert data["summary"] == {"total": 4, "successes": 1, "failures": 2,
                               "by_outcome": {"success": 1, "liveness_unavailable": 1, "face_mismatch": 1,
                                              "presence_code_invalid": 1}}

    admin_view = (await client.get(_url(world.beta_sid, "face-attempts"), headers=auth_headers(world.admin))).json()
    assert admin_view["summary"]["total"] == 1 and admin_view["summary"]["failures"] == 1


async def test_face_attempts_guard(client, world, auth_headers):
    res = await client.get(_url(world.alpha_sid, "face-attempts"), headers=auth_headers(world.stranger))
    assert res.status_code == 403 and res.json()["detail"]["code"] == "not_session_teacher"
    res = await client.get(_url(world.alpha_sid, "face-attempts"), headers=auth_headers(world.student))
    assert res.status_code == 403
    res = await client.get(_url(987654, "face-attempts"), headers=auth_headers(world.admin))
    assert res.status_code == 404
    empty = (await client.get(_url(world.alpha_sid, "face-attempts"), headers=auth_headers(world.teacher))).json()
    assert empty["attempts"] == [] and empty["summary"] == {"total": 0, "successes": 0, "failures": 0, "by_outcome": {}}
