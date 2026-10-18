"""Face check-in, verify-identity, challenge, policy and diagnostics endpoints
(docs/system/face-verification.md §6, §7).

The engine is the harness fake (``tests/support/fake_face.py``): ``set_frames`` controls what
each frame of the burst "shows". Time is frozen (naive = Asia/Kathmandu). Unless a test says
otherwise the face policy is the secure default (presence code, head turn and passive
liveness all required). Every request must write exactly one ``face_verification_attempts``
row, committed even when the check-in is rejected.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import text

from app.services import presence_code
from app.services.face_attempts import record_attempt
from tests.support.fake_face import (
    RELAXED_FACE_POLICY,
    blend,
    checkin_burst,
    frontal,
    turned,
    unit_embedding,
)

URL = "/api/face-recognition/mark-attendance"
MONDAY = date(2025, 3, 3)  # inside the term 2025-01-06 .. 2025-05-30
FRAME = "data:image/jpeg;base64,AAAA"
EMB = unit_embedding(1)
OTHER = unit_embedding(42)  # orthogonal to EMB
PERIOD = 30  # default presence_code_period_seconds


# ============================================================================ fixtures / helpers


@pytest.fixture
async def world(db, factory, frozen_now):
    """Faculty F (semester 1): Alpha 09:00-10:00 and Beta 10:00-11:00 on Mondays, an active
    term, two enrolled students with EMB registered, one without a face, an admin, a teacher."""
    await db.execute(text(
        "UPDATE system_settings SET value = value - 'tracking_start_date' WHERE key = 'attendance_policy'"))
    fac = await factory.faculty(name="Faculty F")
    teacher = await factory.teacher(faculty=fac)
    alpha = await factory.subject(faculty=fac, name="Alpha")
    beta = await factory.subject(faculty=fac, name="Beta")
    await factory.class_schedule(subject=alpha, faculty=fac, day_of_week="MONDAY", start_time="09:00",
                                 end_time="10:00", semester=1, teacher=teacher)
    await factory.class_schedule(subject=beta, faculty=fac, day_of_week="MONDAY", start_time="10:00",
                                 end_time="11:00", semester=1, teacher=teacher)
    await factory.term(start_date=date(2025, 1, 6), end_date=date(2025, 5, 30))
    face = json.dumps(EMB)
    student = await factory.student(faculty=fac, semester=1, face_encoding=face, enrolled_on=date(2025, 1, 1),
                                    full_name="Asha Rai", student_id="ROLL-001")
    other = await factory.student(faculty=fac, semester=1, face_encoding=json.dumps(OTHER), enrolled_on=date(2025, 1, 1))
    faceless = await factory.student(faculty=fac, semester=1, enrolled_on=date(2025, 1, 1))
    admin = await factory.admin()
    await db.commit()  # release the savepoint so route rollbacks keep the seed rows
    clock = frozen_now(datetime(2025, 3, 3, 9, 5))

    class W:
        pass

    w = W()
    w.__dict__.update(fac=fac, teacher=teacher, alpha=alpha, beta=beta, student=student, other=other,
                      faceless=faceless, admin=admin, clock=clock)
    return w


async def _session_id(db, w, subject=None) -> int:
    """Materialize today's sessions (as the scheduler / today list would) and return one id."""
    from app.services.class_sessions import ensure_sessions_for

    sessions = await ensure_sessions_for(db, session_date=MONDAY, faculty_id=w.fac.id, semester=1)
    await db.commit()
    return next(s.id for s in sessions if s.subject_id == (subject or w.alpha).id)


def _code(session_id: int, now: datetime) -> str:
    return presence_code.code_for(session_id, now, PERIOD)


def _wrong_code(session_id: int, now: datetime) -> str:
    valid = {_code(session_id, now), _code(session_id, now - timedelta(seconds=PERIOD))}
    return next(c for c in ("000000", "111111", "222222") if c not in valid)


def _direction(action: str) -> str:
    return "left" if action == "turn_left" else "right"


def _opposite(action: str) -> str:
    return "right" if action == "turn_left" else "left"


async def _challenge(client, auth_headers, student, purpose="checkin", **extra) -> dict:
    res = await client.post("/api/face-recognition/challenge", json={"purpose": purpose, **extra},
                            headers=auth_headers(student))
    assert res.status_code == 200, res.text
    return res.json()


async def _post(client, auth_headers, student, **body) -> dict:
    payload = {"frames": [FRAME] * 3, **body}
    res = await client.post(URL, json=payload, headers=auth_headers(student))
    assert res.status_code == 200, res.text
    return res.json()


async def _ready(client, auth_headers, fake_face, db, w, *, subject=None, student=None, specs=None):
    """Session id + a fresh challenge; the fake shows a burst that satisfies that challenge."""
    sid = await _session_id(db, w, subject)
    ch = await _challenge(client, auth_headers, student or w.student)
    fake_face.set_frames(specs(ch["action"]) if specs else checkin_burst(EMB, _direction(ch["action"])))
    return sid, ch


async def _attempts(db, student_id) -> list[dict]:
    rows = (await db.execute(text(
        "SELECT purpose, outcome, counts_as_failure, session_id, challenge_id, similarity, liveness_score, "
        "details, ip_address FROM face_verification_attempts WHERE student_id = :s ORDER BY id"),
        {"s": student_id})).mappings().all()
    return [dict(r) for r in rows]


async def _records(db, student_id) -> list[dict]:
    rows = (await db.execute(text(
        "SELECT status::text AS status, source, session_id, confidence_score FROM attendance_records "
        "WHERE student_id = :s ORDER BY id"), {"s": student_id})).mappings().all()
    return [dict(r) for r in rows]


async def _challenge_used(db, challenge_id) -> bool:
    return (await db.execute(text("SELECT used_at IS NOT NULL FROM face_challenges WHERE id = :i"),
                             {"i": challenge_id})).scalar()


def _rejected(body: dict, code: str) -> None:
    assert body["success"] is False and body["attendance_marked"] is False, body
    assert body["code"] == code, body
    assert body["confidence_score"] == 0.0  # never a score on failure


# ============================================================================ success (full contract)


async def test_secure_checkin_marks_present_and_stores_confidence(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world)
    body = await _post(client, auth_headers, world.student, frames=[FRAME] * 3, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now), subject_id=world.alpha.id)
    assert body["success"] is True and body["attendance_marked"] is True, body
    assert body["status"] == "present" and body["session_id"] == sid and body["subject_id"] == world.alpha.id
    assert body["confidence_score"] == pytest.approx(100.0)
    assert body["quality_issues"] is None and body["retry_after_seconds"] is None
    recs = await _records(db, world.student.id)
    assert len(recs) == 1 and recs[0]["status"] == "present" and recs[0]["source"] == "student_face"
    assert float(recs[0]["confidence_score"]) == pytest.approx(100.0)
    assert await _challenge_used(db, ch["challenge_id"]) is True
    [att] = await _attempts(db, world.student.id)
    assert att["purpose"] == "checkin" and att["outcome"] == "success" and att["counts_as_failure"] is False
    assert att["session_id"] == sid and att["challenge_id"] == ch["challenge_id"]
    assert float(att["similarity"]) == pytest.approx(1.0) and float(att["liveness_score"]) == pytest.approx(0.95)
    assert att["ip_address"]
    assert att["details"]["frame_count"] == 3 and att["details"]["action"] == ch["action"]
    assert fake_face.calls[-1] == ("process_frames", (3, True))


async def test_secure_checkin_after_late_threshold_is_late(client, db, world, auth_headers, fake_face):
    world.clock.set(datetime(2025, 3, 3, 9, 15))
    sid, ch = await _ready(client, auth_headers, fake_face, db, world)
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    assert body["success"] is True and body["status"] == "late" and body["subject_id"] == world.alpha.id
    assert (await _records(db, world.student.id))[0]["status"] == "late"


async def test_window_rules_still_apply_before_biometrics(client, db, world, auth_headers, fake_face):
    world.clock.set(datetime(2025, 3, 3, 9, 25))  # Alpha closed at 09:20; Beta opens 09:50
    ch = await _challenge(client, auth_headers, world.student)
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"], presence_code="123456",
                       subject_id=world.alpha.id)
    _rejected(body, "window_closed")
    assert body["window_state"] == "closed"
    assert await _challenge_used(db, ch["challenge_id"]) is False  # step 5 not reached
    assert ("process_frames", (3, True)) not in fake_face.calls
    [att] = await _attempts(db, world.student.id)
    assert att["outcome"] == "window_closed" and att["counts_as_failure"] is False
    assert await _records(db, world.student.id) == []


async def test_already_recorded_is_rejected_after_verification(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world)
    first = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                        presence_code=_code(sid, world.clock.now))
    assert first["success"] is True
    world.clock.advance(minutes=1)
    ch2 = await _challenge(client, auth_headers, world.student)
    fake_face.set_frames(checkin_burst(EMB, _direction(ch2["action"])))
    second = await _post(client, auth_headers, world.student, challenge_id=ch2["challenge_id"],
                         presence_code=_code(sid, world.clock.now))
    _rejected(second, "already_recorded")
    assert second["current_status"] == "present"
    assert await _challenge_used(db, ch2["challenge_id"]) is True  # single use whatever the outcome
    assert [a["outcome"] for a in await _attempts(db, world.student.id)] == ["success", "already_recorded"]
    assert len(await _records(db, world.student.id)) == 1


# ============================================================================ 1. lock-out


async def _seed_failures(db, student_id, now, minutes_ago):
    for m in minutes_ago:
        await record_attempt(db, student_id=student_id, purpose="checkin", outcome="face_mismatch",
                             now=now - timedelta(minutes=m))
    await db.commit()


async def test_lockout_reports_retry_after_and_does_not_count_itself(client, db, world, auth_headers, fake_face):
    now = world.clock.now
    await _seed_failures(db, world.student.id, now, [9, 8, 7, 6, 5])
    sid, ch = await _ready(client, auth_headers, fake_face, db, world)
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, now))
    _rejected(body, "too_many_attempts")
    # the oldest counted failure (9 min ago) leaves the 10-minute window in 60 s (+1 s rounding)
    assert body["retry_after_seconds"] == 61
    assert await _challenge_used(db, ch["challenge_id"]) is False  # lock-out comes first
    atts = await _attempts(db, world.student.id)
    assert atts[-1]["outcome"] == "too_many_attempts" and atts[-1]["counts_as_failure"] is False
    assert await _records(db, world.student.id) == []

    # Two minutes later fewer than 5 failures remain in the window; the lock-out row itself never counts.
    world.clock.advance(minutes=2)
    ch = await _challenge(client, auth_headers, world.student)
    fake_face.set_frames(checkin_burst(EMB, _direction(ch["action"])))
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    assert body["success"] is True, body


# ============================================================================ 2. registered face


async def test_no_registered_face(client, db, world, auth_headers, fake_face):
    await _session_id(db, world)
    body = await _post(client, auth_headers, world.faceless, presence_code="123456")
    _rejected(body, "no_registered_face")
    [att] = await _attempts(db, world.faceless.id)
    assert att["outcome"] == "no_registered_face" and att["counts_as_failure"] is False


# ============================================================================ 4. presence code


async def test_presence_code_required_and_invalid(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world)
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"])
    _rejected(body, "presence_code_required")
    assert body["session_id"] == sid
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_wrong_code(sid, world.clock.now))
    _rejected(body, "presence_code_invalid")
    atts = await _attempts(db, world.student.id)
    assert [(a["outcome"], a["counts_as_failure"]) for a in atts] == [
        ("presence_code_required", False), ("presence_code_invalid", True)]
    assert all(a["session_id"] == sid for a in atts)
    assert await _challenge_used(db, ch["challenge_id"]) is False  # challenge comes after the code
    # the code of another session (Beta) is not valid for Alpha
    beta_code = _code(await _session_id(db, world, world.beta), world.clock.now)
    if not presence_code.verify_code(sid, beta_code, world.clock.now, PERIOD):  # collision: ~1e-6
        body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"], presence_code=beta_code)
        _rejected(body, "presence_code_invalid")
    assert await _records(db, world.student.id) == []


async def test_previous_step_presence_code_is_accepted(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world)
    previous = presence_code.code_for(sid, world.clock.now - timedelta(seconds=PERIOD), PERIOD)
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"], presence_code=f" {previous} ")
    assert body["success"] is True, body


async def test_presence_code_two_steps_old_is_rejected(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world)
    old = presence_code.code_for(sid, world.clock.now - timedelta(seconds=2 * PERIOD), PERIOD)
    if presence_code.verify_code(sid, old, world.clock.now, PERIOD):  # astronomically unlikely collision
        pytest.skip("old code collides with a valid one")
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"], presence_code=old)
    _rejected(body, "presence_code_invalid")


# ============================================================================ 5. challenge


async def test_challenge_required_and_unknown(client, db, world, auth_headers, fake_face):
    sid, _ = await _ready(client, auth_headers, fake_face, db, world)
    code = _code(sid, world.clock.now)
    body = await _post(client, auth_headers, world.student, presence_code=code)
    _rejected(body, "challenge_required")
    body = await _post(client, auth_headers, world.student, presence_code=code, challenge_id="f" * 32)
    _rejected(body, "challenge_invalid")
    atts = await _attempts(db, world.student.id)
    assert [(a["outcome"], a["counts_as_failure"]) for a in atts] == [
        ("challenge_required", False), ("challenge_invalid", True)]


async def test_challenge_is_single_use_even_after_a_rejection(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda action: checkin_burst(OTHER, _direction(action)))
    code = _code(sid, world.clock.now)
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"], presence_code=code)
    _rejected(body, "face_mismatch")
    assert await _challenge_used(db, ch["challenge_id"]) is True  # kept despite the rollback
    fake_face.set_frames(checkin_burst(EMB, _direction(ch["action"])))
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"], presence_code=code)
    _rejected(body, "challenge_invalid")
    assert [a["outcome"] for a in await _attempts(db, world.student.id)] == ["face_mismatch", "challenge_invalid"]
    assert await _records(db, world.student.id) == []


async def test_expired_challenge_is_invalid(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world)
    world.clock.advance(seconds=91)  # default TTL 90 s
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "challenge_invalid")
    assert await _challenge_used(db, ch["challenge_id"]) is True


async def test_another_students_challenge_is_invalid_and_not_consumed(client, db, world, auth_headers, fake_face):
    sid = await _session_id(db, world)
    theirs = await _challenge(client, auth_headers, world.other)
    fake_face.set_frames(checkin_burst(EMB, _direction(theirs["action"])))
    body = await _post(client, auth_headers, world.student, challenge_id=theirs["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "challenge_invalid")
    assert await _challenge_used(db, theirs["challenge_id"]) is False
    [att] = await _attempts(db, world.student.id)
    assert att["counts_as_failure"] is True
    assert await _attempts(db, world.other.id) == []


# ============================================================================ 6. frames


@pytest.mark.parametrize("frames", [[FRAME] * 2, [FRAME] * 9, [], None])
async def test_invalid_frame_counts(client, db, world, auth_headers, fake_face, frames):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world)
    payload = {"challenge_id": ch["challenge_id"], "presence_code": _code(sid, world.clock.now), "frames": frames}
    res = await client.post(URL, json=payload, headers=auth_headers(world.student))
    assert res.status_code == 200, res.text
    _rejected(res.json(), "invalid_frames")
    assert not [c for c in fake_face.calls if c[0] == "process_frames"]
    [att] = await _attempts(db, world.student.id)
    assert att["outcome"] == "invalid_frames" and att["counts_as_failure"] is False
    assert await _challenge_used(db, ch["challenge_id"]) is True


# ============================================================================ 7. quality


async def test_no_face_detected(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world)
    fake_face.set_no_face()
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "no_face_detected")


async def test_faceless_frames_ignored_only_while_enough_remain(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: [frontal(EMB), None, turned(EMB, _direction(a))])
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "no_face_detected")  # 2 usable < frames_min 3

    world.clock.advance(seconds=5)
    ch = await _challenge(client, auth_headers, world.student)
    fake_face.set_frames([frontal(EMB), None, frontal(EMB), turned(EMB, _direction(ch["action"]))])
    body = await _post(client, auth_headers, world.student, frames=[FRAME] * 4, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    assert body["success"] is True, body


async def test_multiple_faces(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: [frontal(EMB), frontal(EMB, faces_detected=2, secondary_face_ratio=0.6),
                                            turned(EMB, _direction(a))])
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "multiple_faces")


async def test_small_background_face_is_ignored(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: [frontal(EMB, faces_detected=2, secondary_face_ratio=0.1), frontal(EMB),
                                            turned(EMB, _direction(a))])
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    assert body["success"] is True, body


@pytest.mark.parametrize("overrides,expected", [
    ({"brightness": 20.0}, ["too_dark"]),
    ({"brightness": 240.0}, ["too_bright"]),
    ({"sharpness": 5.0}, ["too_blurry"]),
    ({"width": 60.0, "height": 70.0}, ["too_small"]),
    ({"det_score": 0.4}, ["low_confidence"]),
    ({"brightness": 20.0, "sharpness": 5.0}, ["too_blurry", "too_dark"]),
])
async def test_low_quality_reports_issues(client, db, world, auth_headers, fake_face, overrides, expected):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: [frontal(EMB, **overrides), frontal(EMB, **overrides),
                                            turned(EMB, _direction(a))])
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "low_quality")
    assert sorted(body["quality_issues"]) == sorted(expected)
    [att] = await _attempts(db, world.student.id)
    assert att["counts_as_failure"] is False and sorted(att["details"]["quality_issues"]) == sorted(expected)


async def test_one_good_frontal_frame_is_enough(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: [frontal(EMB, brightness=20.0), frontal(EMB), turned(EMB, _direction(a))])
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    assert body["success"] is True, body


async def test_no_frontal_frame_is_low_quality_not_frontal(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: [turned(EMB, _direction(a))] * 3)
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "low_quality")
    assert body["quality_issues"] == ["not_frontal"]


# ============================================================================ 8. identity


async def test_face_mismatch_on_frontal_frame(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: checkin_burst(OTHER, _direction(a)))
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "face_mismatch")
    assert not any(c.isdigit() for c in body["message"])  # no similarity in the message
    [att] = await _attempts(db, world.student.id)
    assert att["counts_as_failure"] is True and float(att["similarity"]) == pytest.approx(0.0, abs=1e-4)
    assert await _records(db, world.student.id) == []


async def test_borderline_frontal_similarity(client, db, world, auth_headers, fake_face):
    below = blend(EMB, OTHER, 0.7)  # cosine ~0.394 < match_threshold 0.45
    above = blend(EMB, OTHER, 0.6)  # cosine ~0.555
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: checkin_burst(below, _direction(a)))
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "face_mismatch")
    [att] = await _attempts(db, world.student.id)
    assert float(att["similarity"]) == pytest.approx(0.3939, abs=1e-3)

    ch = await _challenge(client, auth_headers, world.student)
    fake_face.set_frames(checkin_burst(above, _direction(ch["action"])))
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    assert body["success"] is True, body
    assert body["confidence_score"] == pytest.approx(55.47, abs=0.01)


async def test_face_mismatch_on_consistency_frame(client, db, world, auth_headers, fake_face):
    swapped = blend(EMB, OTHER, 0.8)  # cosine ~0.243 < consistency_threshold 0.30
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: [frontal(EMB), frontal(EMB), turned(swapped, _direction(a))])
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "face_mismatch")
    [att] = await _attempts(db, world.student.id)
    assert att["counts_as_failure"] is True
    assert float(att["similarity"]) == pytest.approx(1.0)  # the frontal frame matched
    assert att["details"]["consistency_min"] == pytest.approx(0.2425, abs=1e-3)

    # A turned frame of the same person (cosine ~0.394 >= 0.30) is consistent.
    ch = await _challenge(client, auth_headers, world.student)
    fake_face.set_frames([frontal(EMB), frontal(EMB), turned(blend(EMB, OTHER, 0.7), _direction(ch["action"]))])
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    assert body["success"] is True, body


async def test_matching_uses_stored_templates_of_the_current_model(client, db, factory, world, auth_headers, fake_face):
    # `other` is registered with OTHER; the camera shows EMB. A template from another model is ignored...
    await factory.insert("face_templates", {"student_id": world.other.id, "model": "insightface/other",
                                            "pose": "front", "embedding": json.dumps(EMB)}, casts={"embedding": "jsonb"})
    await db.commit()
    sid, ch = await _ready(client, auth_headers, fake_face, db, world, student=world.other)
    body = await _post(client, auth_headers, world.other, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "face_mismatch")
    # ... but a template of the engine's model (insightface/buffalo_l) is part of the matching set.
    await factory.insert("face_templates", {"student_id": world.other.id, "model": "insightface/buffalo_l",
                                            "pose": "left", "embedding": json.dumps(EMB)}, casts={"embedding": "jsonb"})
    await db.commit()
    ch = await _challenge(client, auth_headers, world.other)
    fake_face.set_frames(checkin_burst(EMB, _direction(ch["action"])))
    body = await _post(client, auth_headers, world.other, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    assert body["success"] is True, body


# ============================================================================ 9-10. liveness


async def test_head_turn_in_wrong_direction_fails_liveness(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: checkin_burst(EMB, _opposite(a)))
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "liveness_failed")
    [att] = await _attempts(db, world.student.id)
    assert att["counts_as_failure"] is True


async def test_no_head_turn_fails_liveness(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: [frontal(EMB)] * 2 + [turned(EMB, _direction(a), amount=0.15)])
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "liveness_failed")  # 0.15 < head_turn_min_yaw 0.18


async def test_spoof_suspected(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: checkin_burst(EMB, _direction(a), liveness=0.3))
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "spoof_suspected")
    [att] = await _attempts(db, world.student.id)
    assert att["counts_as_failure"] is True and float(att["liveness_score"]) == pytest.approx(0.3)
    assert await _records(db, world.student.id) == []


async def test_liveness_is_averaged_over_two_best_frontal_frames(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: [frontal(EMB, liveness=0.9), frontal(EMB, liveness=0.6),
                                            turned(EMB, _direction(a), liveness=0.1)])
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    assert body["success"] is True, body  # mean(0.9, 0.6) = 0.75 >= 0.70; the turned frame is not used
    [att] = await _attempts(db, world.student.id)
    assert float(att["liveness_score"]) == pytest.approx(0.75)


async def test_liveness_unavailable_is_not_a_failure(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world)
    fake_face.liveness_available = False
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "liveness_unavailable")
    [att] = await _attempts(db, world.student.id)
    assert att["counts_as_failure"] is False
    assert await _records(db, world.student.id) == []


# ============================================================================ attempts + policy toggles


async def test_every_request_writes_one_attempt(client, db, world, auth_headers, fake_face):
    sid, ch = await _ready(client, auth_headers, fake_face, db, world)
    code = _code(sid, world.clock.now)
    requests = [
        {},                                                   # presence_code_required
        {"presence_code": _wrong_code(sid, world.clock.now)},  # presence_code_invalid
        {"presence_code": code},                              # challenge_required
        {"presence_code": code, "challenge_id": "nope"},      # challenge_invalid
        {"presence_code": code, "challenge_id": ch["challenge_id"]},  # success
    ]
    for body in requests:
        await _post(client, auth_headers, world.student, **body)
    outcomes = [a["outcome"] for a in await _attempts(db, world.student.id)]
    assert outcomes == ["presence_code_required", "presence_code_invalid", "challenge_required",
                        "challenge_invalid", "success"]


async def test_policy_off_accepts_legacy_single_image(client, db, world, auth_headers, fake_face, face_policy):
    await _session_id(db, world)
    fake_face.set_face(embedding=EMB)
    res = await client.post(URL, json={"image_data": FRAME}, headers=auth_headers(world.student))
    _rejected(res.json(), "presence_code_required")  # secure default

    await face_policy(**RELAXED_FACE_POLICY)
    res = await client.post(URL, json={"image_data": FRAME, "subject_id": world.alpha.id},
                            headers=auth_headers(world.student))
    body = res.json()
    assert body["success"] is True and body["status"] == "present", body
    assert fake_face.calls[-1] == ("process_frames", (1, False))  # no liveness requested
    assert [a["outcome"] for a in await _attempts(db, world.student.id)] == ["presence_code_required", "success"]


async def test_relaxed_policy_still_rejects_mismatch(client, db, world, auth_headers, fake_face, face_policy):
    await face_policy(**RELAXED_FACE_POLICY)
    fake_face.set_face(embedding=OTHER)
    res = await client.post(URL, json={"image_data": FRAME}, headers=auth_headers(world.student))
    _rejected(res.json(), "face_mismatch")


async def test_checkin_requires_student_role(client, world, auth_headers):
    res = await client.post(URL, json={"image_data": FRAME}, headers=auth_headers(world.admin))
    assert res.status_code == 403
    res = await client.post(URL, json={"image_data": FRAME})
    assert res.status_code in (401, 403)


# ============================================================================ verify-identity (legacy)


async def test_verify_identity_never_leaks_a_score(client, db, world, auth_headers, fake_face):
    fake_face.set_face(embedding=EMB)
    res = await client.post("/api/face-recognition/verify-identity", json={"image_data": FRAME},
                            headers=auth_headers(world.student))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["matched"] is True and body["confidence_score"] == pytest.approx(100.0)

    fake_face.set_face(embedding=blend(EMB, OTHER, 0.7))  # ~0.394: close, but not a match
    body = (await client.post("/api/face-recognition/verify-identity", json={"image_data": FRAME},
                              headers=auth_headers(world.student))).json()
    assert body["matched"] is False and body["confidence_score"] == 0.0 and body["code"] == "face_mismatch"
    assert not any(c.isdigit() for c in body["message"])
    atts = await _attempts(db, world.student.id)
    assert [(a["purpose"], a["outcome"], a["counts_as_failure"]) for a in atts] == [
        ("verify", "success", False), ("verify", "face_mismatch", True)]
    assert fake_face.calls[-1] == ("process_frames", (1, False))


async def test_verify_identity_without_face_and_lockout(client, db, world, auth_headers, fake_face):
    res = await client.post("/api/face-recognition/verify-identity", json={"image_data": FRAME},
                            headers=auth_headers(world.faceless))
    assert res.status_code == 400 and res.json()["detail"]["code"] == "no_registered_face"
    assert [a["outcome"] for a in await _attempts(db, world.faceless.id)] == ["no_registered_face"]

    await _seed_failures(db, world.student.id, world.clock.now, [1, 2, 3, 4, 5])
    body = (await client.post("/api/face-recognition/verify-identity", json={"image_data": FRAME},
                              headers=auth_headers(world.student))).json()
    assert body["matched"] is False and body["code"] == "too_many_attempts" and body["retry_after_seconds"] > 0


# ============================================================================ /policy, /challenge


async def test_policy_is_the_public_subset(client, world, auth_headers, face_policy):
    res = await client.get("/api/face-recognition/policy", headers=auth_headers(world.student))
    assert res.status_code == 200, res.text
    assert set(res.json()) == {"require_liveness", "require_head_turn", "require_presence_code", "frames_min",
                               "frames_max", "challenge_ttl_seconds", "presence_code_period_seconds",
                               "enrolment_min_images"}
    assert res.json()["frames_min"] == 3
    await face_policy(require_head_turn=False, frames_max=5, match_threshold=0.5)
    body = (await client.get("/api/face-recognition/policy", headers=auth_headers(world.teacher))).json()
    assert body["require_head_turn"] is False and body["frames_min"] == 1 and body["frames_max"] == 5
    assert "match_threshold" not in body
    assert (await client.get("/api/face-recognition/policy")).status_code in (401, 403)


async def test_challenge_contract(client, db, world, auth_headers, face_policy):
    await face_policy(challenge_ttl_seconds=45)
    ch = await _challenge(client, auth_headers, world.student, session_id=await _session_id(db, world),
                          subject_id=world.alpha.id)
    assert ch["purpose"] == "checkin" and ch["action"] in ("turn_left", "turn_right")
    assert ch["ttl_seconds"] == 45
    assert datetime.fromisoformat(ch["expires_at"]) == world.clock.now + timedelta(seconds=45)
    assert ch["requires_head_turn"] is True and ch["requires_liveness"] is True and ch["requires_presence_code"] is True
    assert ch["frames_min"] == 3 and ch["frames_max"] == 8 and ch["instructions"]
    stored = (await db.execute(text("SELECT student_id, purpose, action, used_at FROM face_challenges WHERE id = :i"),
                               {"i": ch["challenge_id"]})).mappings().one()
    assert stored["student_id"] == world.student.id and stored["used_at"] is None

    enrol = await _challenge(client, auth_headers, world.faceless, purpose="enrolment")
    assert enrol["action"] == "front_left_right" and enrol["requires_presence_code"] is False


async def test_challenge_actions_are_random(client, world, auth_headers):
    actions = {(await _challenge(client, auth_headers, world.student))["action"] for _ in range(24)}
    assert actions == {"turn_left", "turn_right"}


async def test_challenge_rejections(client, db, world, auth_headers):
    res = await client.post("/api/face-recognition/challenge", json={"purpose": "selfie"},
                            headers=auth_headers(world.student))
    assert res.status_code == 400 and res.json()["detail"]["code"] == "invalid_purpose"
    res = await client.post("/api/face-recognition/challenge", json={"purpose": "checkin"},
                            headers=auth_headers(world.faceless))
    assert res.status_code == 409 and res.json()["detail"]["code"] == "no_registered_face"
    res = await client.post("/api/face-recognition/challenge", json={"purpose": "checkin", "session_id": 987654},
                            headers=auth_headers(world.student))
    assert res.status_code == 404 and res.json()["detail"]["code"] == "session_not_found"
    res = await client.post("/api/face-recognition/challenge", json={"purpose": "checkin"},
                            headers=auth_headers(world.teacher))
    assert res.status_code == 403
    count = (await db.execute(text("SELECT count(*) FROM face_challenges"))).scalar()
    assert count == 0


# ============================================================================ staff + diagnostics


async def test_live_recognition_threshold(client, world, auth_headers, fake_face, face_policy):
    fake_face.set_face(embedding=EMB)
    res = await client.post("/api/face-recognition/live-recognition", json={"image_data": FRAME},
                            headers=auth_headers(world.teacher))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["student_recognized"] is True and body["student_id"] == world.student.id
    assert body["student_name"] == "Asha Rai" and body["recognition_quality"] == "excellent"

    fake_face.set_face(embedding=blend(EMB, OTHER, 0.68))  # ~0.43 to EMB, ~0.90 to OTHER: the best match wins
    body = (await client.post("/api/face-recognition/live-recognition", json={"image_data": FRAME},
                              headers=auth_headers(world.admin))).json()
    assert body["student_recognized"] is True and body["student_id"] == world.other.id

    probe = blend(unit_embedding(7), EMB, 0.35)  # ~0.48 from EMB; orthogonal to OTHER
    fake_face.set_face(embedding=probe)
    await face_policy(match_threshold=0.6)
    body = (await client.post("/api/face-recognition/live-recognition", json={"image_data": FRAME},
                              headers=auth_headers(world.admin))).json()
    assert body["student_recognized"] is False and body["recognition_quality"] == "unrecognized"
    assert body["confidence_score"] is None
    await face_policy(match_threshold=0.45)
    body = (await client.post("/api/face-recognition/live-recognition", json={"image_data": FRAME},
                              headers=auth_headers(world.admin))).json()
    assert body["student_recognized"] is True and body["student_id"] == world.student.id
    assert body["recognition_quality"] == "fair"

    res = await client.post("/api/face-recognition/live-recognition", json={"image_data": FRAME},
                            headers=auth_headers(world.student))
    assert res.status_code == 403


async def test_quality_feedback_endpoints(client, world, auth_headers, fake_face):
    fake_face.set_face(embedding=EMB)
    res = await client.post("/api/face-recognition/verify-face", json={"image_data": FRAME},
                            headers=auth_headers(world.student))
    body = res.json()
    assert res.status_code == 200 and body["valid"] is True and body["faces_detected"] == 1
    assert set(body["face"]) == {"bbox", "confidence", "width", "height", "area_percentage"}

    fake_face.set_face(embedding=EMB, brightness=20.0)
    body = (await client.post("/api/face-recognition/detect-faces", json={"image_data": FRAME},
                              headers=auth_headers(world.student))).json()
    assert body["success"] is False and body["ready_for_capture"] is False
    assert body["quality_issues"] == ["too_dark"] and body["faces_detected"] == 1 and len(body["faces"]) == 1

    fake_face.set_no_face()
    body = (await client.post("/api/face-recognition/verify-face", json={"image_data": FRAME},
                              headers=auth_headers(world.student))).json()
    assert body["valid"] is False and body["faces_detected"] == 0
    assert all(c[1][1] is False for c in fake_face.calls if c[0] == "process_frames")  # never liveness


async def test_service_status_and_removed_endpoints(client, world, auth_headers, fake_face):
    res = await client.get("/api/face-recognition/service-status")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "active" and body["model_id"] == "insightface/buffalo_l"
    assert body["liveness_available"] is True and body["policy"]["require_presence_code"] is True
    assert "advantages" not in body
    fake_face.liveness_available = False
    assert (await client.get("/api/face-recognition/service-status")).json()["liveness_available"] is False

    res = await client.post("/api/face-recognition/detect-glasses", json={"image_data": FRAME},
                            headers=auth_headers(world.student))
    assert res.status_code == 404


# ============================================================================ turned too far


async def test_turn_only_beyond_max_is_turned_too_far_not_a_failure(client, db, world, auth_headers, fake_face):
    """A near-profile turn (|yaw| > max_turn_yaw) in the right direction gets its own code and
    never counts towards the lock-out."""
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: [frontal(EMB)] * 2 + [turned(EMB, _direction(a), amount=1.15)])
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "turned_too_far")
    [att] = await _attempts(db, world.student.id)
    assert att["counts_as_failure"] is False
    assert att["details"]["too_far_frames"] == [2]


async def test_too_far_frames_are_ignored_when_a_clear_turn_exists(client, db, world, auth_headers, fake_face):
    """A near-profile frame is evidence for nothing: even an unrelated embedding there doesn't
    fail the consistency check, as long as an in-range turned frame of the student exists."""
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: [frontal(EMB), turned(EMB, _direction(a), amount=0.35),
                                            turned(OTHER, _direction(a), amount=1.3)])
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    assert body["success"] is True, body


async def test_too_far_frames_never_count_as_the_turn(client, db, world, auth_headers, fake_face):
    """Dropping near-profile frames can't weaken the check: the turn must come from an in-range frame."""
    sid, ch = await _ready(client, auth_headers, fake_face, db, world,
                           specs=lambda a: [frontal(EMB)] * 2 + [turned(EMB, _opposite(a), amount=1.2)])
    body = await _post(client, auth_headers, world.student, challenge_id=ch["challenge_id"],
                       presence_code=_code(sid, world.clock.now))
    _rejected(body, "liveness_failed")  # wrong direction, so not "too far": a real failure
