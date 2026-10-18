"""Face enrolment, self-deletion, admin reset and student payloads (docs/system/face-verification.md §8).

Time is frozen with ``frozen_now`` (naive = Asia/Kathmandu). The engine is the harness fake
(``tests/support/fake_face.py``): ``fake_face.set_frames([...])`` controls what each posted
image "shows". Challenges are created through ``face_challenges.create_challenge``. Setup is
committed (``db.commit()`` only releases a SAVEPOINT) so the route's rollback on a rejected
enrolment keeps the seed rows, exactly like production keeps them.
"""
from __future__ import annotations

import json
from datetime import datetime
from types import SimpleNamespace

import pytest
from sqlalchemy import select, text

from app.models import Student
from app.services import face_challenges
from app.services.face_enrollment import DUPLICATE_MESSAGE
from app.services.face_math import composite_embedding, cosine_similarity
from app.services.face_policy import get_face_policy
from tests.support.fake_face import MODEL_ID, blend, enrolment_burst, face_spec, frontal, turned, unit_embedding

NOW = datetime(2025, 3, 3, 9, 0)
IMG = "data:image/jpeg;base64,AAAA"
MULTI = "/api/face-recognition/register-face-multi"
LEGACY = "/api/face-recognition/register-face"
STATUS = "/api/face-recognition/enrollment"
MY_FACE = "/api/face-recognition/my-face"
QUALITY_KEYS = {"det_score", "sharpness", "brightness", "yaw", "area_ratio"}


def images(n: int = 3) -> list[str]:
    return [IMG] * n


def _j(value):
    return json.loads(value) if isinstance(value, str) else value


# ------------------------------------------------------------------------------ helpers
async def set_face_policy(db, **values) -> None:
    """Merge ``values`` into the ``face_verification`` system setting (committed)."""
    patch = json.dumps(values)
    res = await db.execute(text(
        "UPDATE system_settings SET value = value || CAST(:p AS jsonb), is_active = true "
        "WHERE key = 'face_verification'"), {"p": patch})
    if res.rowcount == 0:
        await db.execute(text(
            "INSERT INTO system_settings (key, value, category, description, data_type, is_active) "
            "VALUES ('face_verification', CAST(:p AS jsonb), 'face', 'test', 'json', true)"), {"p": patch})
    await db.commit()


async def new_challenge(db, student_rec, purpose: str = "enrolment") -> str:
    student = (await db.execute(select(Student).where(Student.id == student_rec.id))).scalars().first()
    challenge = await face_challenges.create_challenge(db, student=student, purpose=purpose,
                                                       policy=await get_face_policy(db))
    await db.commit()
    return challenge.id


async def mark_enrolled(db, student_rec, embedding, *, template=None) -> None:
    """Give a student a composite (and optionally one template row) directly in the DB."""
    await db.execute(text(
        "UPDATE students SET face_encoding = CAST(:e AS json), face_enrollment_status = 'enrolled', "
        "face_model = :m WHERE id = :i"), {"e": json.dumps(embedding), "m": MODEL_ID, "i": student_rec.id})
    if template is not None:
        await db.execute(text(
            "INSERT INTO face_templates (student_id, model, pose, embedding) "
            "VALUES (:i, :m, 'front', CAST(:e AS jsonb))"), {"i": student_rec.id, "m": MODEL_ID, "e": json.dumps(template)})
    await db.commit()
    db.expire_all()


async def enrol(client, auth_headers, student_rec, *, challenge=None, n=3, consent=True, path=MULTI, **extra):
    body = {"images": images(n), "consent": consent, **extra}
    if challenge is not None:
        body["challenge_id"] = challenge
    return await client.post(path, json=body, headers=auth_headers(student_rec))


async def student_row(db, sid):
    return (await db.execute(text(
        "SELECT face_enrollment_status AS status, face_registered_at, face_model, face_consent_at, "
        "face_encoding IS NULL AS enc_null, face_encoding::text AS enc FROM students WHERE id = :i"),
        {"i": sid})).mappings().one()


async def templates(db, sid):
    rows = (await db.execute(text(
        "SELECT pose, model, embedding, quality FROM face_templates WHERE student_id = :i ORDER BY id"),
        {"i": sid})).mappings().all()
    return [{**r, "embedding": _j(r["embedding"]), "quality": _j(r["quality"])} for r in rows]


async def events(db, sid):
    rows = (await db.execute(text(
        "SELECT action, actor_user_id, reason, details FROM face_enrollment_events WHERE student_id = :i ORDER BY id"),
        {"i": sid})).mappings().all()
    return [{**r, "details": _j(r["details"])} for r in rows]


async def attempts(db, sid):
    rows = (await db.execute(text(
        "SELECT purpose, outcome, counts_as_failure, challenge_id, similarity, liveness_score, details "
        "FROM face_verification_attempts WHERE student_id = :i ORDER BY id"), {"i": sid})).mappings().all()
    return [{**r, "details": _j(r["details"])} for r in rows]


async def challenge_used_at(db, challenge_id):
    return (await db.execute(text("SELECT used_at FROM face_challenges WHERE id = :i"), {"i": challenge_id})).scalar()


def detail(res) -> dict:
    return res.json()["detail"]


@pytest.fixture
async def world(db, factory, frozen_now):
    clock = frozen_now(NOW)
    fac = await factory.faculty()
    student = await factory.student(faculty=fac)
    other = await factory.student(faculty=fac)
    teacher = await factory.teacher(faculty=fac)
    admin = await factory.admin()
    await db.commit()
    return SimpleNamespace(clock=clock, fac=fac, student=student, other=other, teacher=teacher, admin=admin)


@pytest.fixture
async def enrolled(client, db, world, auth_headers, fake_face):
    """``world.student`` enrolled through the API with one front, left and right frame."""
    fake_face.set_frames(enrolment_burst(unit_embedding(10)))
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student))
    assert res.status_code == 200, res.text
    return world


# ======================================================================= status endpoint
async def test_status_for_new_student_is_none(client, world, auth_headers):
    res = await client.get(STATUS, headers=auth_headers(world.student))
    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body) == {"status", "can_enroll", "registered_at", "model", "template_count", "consent_at", "message"}
    assert body["status"] == "none" and body["can_enroll"] is True
    assert body["registered_at"] is None and body["model"] is None and body["consent_at"] is None
    assert body["template_count"] == 0 and body["message"]


async def test_legacy_composite_counts_as_enrolled(client, db, world, auth_headers, fake_face):
    """A student with a composite but no status (pre-migration row) can't overwrite it."""
    await db.execute(text("UPDATE students SET face_encoding = CAST(:e AS json) WHERE id = :i"),
                     {"e": json.dumps(unit_embedding(3)), "i": world.student.id})
    await db.commit()
    body = (await client.get(STATUS, headers=auth_headers(world.student))).json()
    assert body["status"] == "enrolled" and body["can_enroll"] is False
    fake_face.set_frames(enrolment_burst(unit_embedding(3)))
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student))
    assert res.status_code == 409 and detail(res)["code"] == "already_enrolled"


# ========================================================================== happy path
async def test_enrolment_happy_path(client, db, world, auth_headers, fake_face):
    base = unit_embedding(10)
    e1, e2, e3 = (blend(base, unit_embedding(s), 0.1) for s in (11, 12, 13))
    fake_face.set_frames([frontal(e1), turned(e2, "left"), turned(e3, "right")])
    ch = await new_challenge(db, world.student)

    res = await enrol(client, auth_headers, world.student, challenge=ch)

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True and body["message"]
    d = body["details"]
    assert set(d) == {"images_processed", "valid_images", "poses", "template_count", "model", "image_results"}
    assert d["images_processed"] == 3 and d["valid_images"] == 3 and d["template_count"] == 3
    assert d["poses"] == {"front": 1, "left": 1, "right": 1}
    assert d["model"] == MODEL_ID
    assert [r["pose"] for r in d["image_results"]] == ["front", "left", "right"]
    assert all(r["valid"] is True and r["issues"] == [] for r in d["image_results"])
    assert "embedding" not in res.text and "similarity" not in res.text
    assert ("process_frames", (3, True)) in fake_face.calls

    row = await student_row(db, world.student.id)
    assert row["status"] == "enrolled"
    assert row["face_registered_at"] == world.clock.now and row["face_consent_at"] == world.clock.now
    assert row["face_model"] == MODEL_ID
    composite = json.loads(row["enc"])
    assert len(composite) == 512
    assert cosine_similarity(composite, composite_embedding([e1, e2, e3])) > 0.999999

    tpl = await templates(db, world.student.id)
    assert [t["pose"] for t in tpl] == ["front", "left", "right"]
    assert {t["model"] for t in tpl} == {MODEL_ID}
    assert all(set(t["quality"]) == QUALITY_KEYS for t in tpl)
    assert [t["quality"]["yaw"] for t in tpl] == [0.0, 0.3, -0.3]
    assert cosine_similarity(tpl[0]["embedding"], e1) > 0.999999

    ev = await events(db, world.student.id)
    assert [(e["action"], e["actor_user_id"]) for e in ev] == [("enrolled", world.student.user.id)]
    assert ev[0]["details"]["template_count"] == 3

    at = await attempts(db, world.student.id)
    assert len(at) == 1
    assert at[0]["purpose"] == "enrolment" and at[0]["outcome"] == "success"
    assert at[0]["counts_as_failure"] is False and at[0]["challenge_id"] == ch
    assert float(at[0]["liveness_score"]) == pytest.approx(0.95)
    assert await challenge_used_at(db, ch) == world.clock.now

    status = (await client.get(STATUS, headers=auth_headers(world.student))).json()
    assert status["status"] == "enrolled" and status["can_enroll"] is False
    assert status["template_count"] == 3 and status["model"] == MODEL_ID
    assert status["registered_at"] is not None and status["consent_at"] is not None


async def test_legacy_register_face_accepts_image_data(client, db, world, auth_headers, fake_face):
    fake_face.set_frames(enrolment_burst(unit_embedding(10)))
    ch = await new_challenge(db, world.student)
    res = await client.post(LEGACY, json={"image_data": images(3), "consent": True, "challenge_id": ch},
                            headers=auth_headers(world.student))
    assert res.status_code == 200, res.text
    assert res.json()["details"]["template_count"] == 3


async def test_legacy_register_face_single_image_is_too_few(client, db, world, auth_headers, fake_face):
    ch = await new_challenge(db, world.student)
    res = await client.post(LEGACY, json={"image_data": IMG, "consent": True, "challenge_id": ch},
                            headers=auth_headers(world.student))
    assert res.status_code == 400 and detail(res)["code"] == "invalid_frames"
    assert detail(res)["details"]["received"] == 1


async def test_in_between_frames_are_stored_but_do_not_cover_a_pose(client, db, world, auth_headers, fake_face):
    emb = unit_embedding(10)
    fake_face.set_frames([frontal(emb), turned(emb, "left"), turned(emb, "right"), face_spec(emb, yaw=0.15)])
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student), n=4)
    assert res.status_code == 200, res.text
    d = res.json()["details"]
    assert d["template_count"] == 4 and d["poses"] == {"front": 1, "left": 2, "right": 1}
    assert d["image_results"][3]["pose"] is None and d["image_results"][3]["valid"] is True


# ====================================================================== status rules
async def test_second_enrolment_is_already_enrolled(client, db, enrolled, auth_headers, fake_face):
    w = enrolled
    ch = await new_challenge(db, w.student)
    res = await enrol(client, auth_headers, w.student, challenge=ch)
    assert res.status_code == 409
    assert detail(res)["code"] == "already_enrolled"
    assert await challenge_used_at(db, ch) is None  # step 1 fails before the challenge is consumed
    assert len(await templates(db, w.student.id)) == 3
    assert [a["outcome"] for a in await attempts(db, w.student.id)] == ["success", "already_enrolled"]


async def test_delete_my_face_then_enrolment_is_locked(client, db, enrolled, auth_headers, fake_face):
    w = enrolled
    res = await client.delete(MY_FACE, headers=auth_headers(w.student))
    assert res.status_code == 200, res.text
    assert res.json()["success"] is True and res.json()["message"]

    row = await student_row(db, w.student.id)
    assert row["status"] == "deleted"
    assert row["enc_null"] is True  # SQL NULL, not JSON 'null'
    assert row["face_registered_at"] is None and row["face_consent_at"] is None and row["face_model"] is None
    assert await templates(db, w.student.id) == []
    ev = await events(db, w.student.id)
    assert [e["action"] for e in ev] == ["enrolled", "deleted"]
    assert ev[1]["actor_user_id"] == w.student.user.id and ev[1]["details"]["templates_deleted"] == 3

    status = (await client.get(STATUS, headers=auth_headers(w.student))).json()
    assert status["status"] == "deleted" and status["can_enroll"] is False and status["template_count"] == 0

    res = await enrol(client, auth_headers, w.student, challenge=await new_challenge(db, w.student))
    assert res.status_code == 409 and detail(res)["code"] == "enrolment_locked"

    again = await client.delete(MY_FACE, headers=auth_headers(w.student))
    assert again.status_code == 200 and again.json()["success"] is True
    assert [e["action"] for e in await events(db, w.student.id)] == ["enrolled", "deleted"]


async def test_delete_without_face_data_changes_nothing(client, db, world, auth_headers):
    res = await client.delete(MY_FACE, headers=auth_headers(world.student))
    assert res.status_code == 200 and res.json()["success"] is True
    assert (await student_row(db, world.student.id))["status"] == "none"
    assert await events(db, world.student.id) == []


async def test_admin_reset_then_reenrol(client, db, enrolled, auth_headers, fake_face):
    w = enrolled
    res = await client.post(f"/api/students/{w.student.id}/face/reset", json={"reason": "  New glasses  "},
                            headers=auth_headers(w.admin))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True and body["status"] == "reset" and body["templates_deleted"] == 3
    assert body["student_id"] == w.student.id

    row = await student_row(db, w.student.id)
    assert row["status"] == "reset" and row["enc_null"] is True
    assert await templates(db, w.student.id) == []
    ev = await events(db, w.student.id)
    assert ev[-1]["action"] == "reset" and ev[-1]["actor_user_id"] == w.admin.user.id
    assert ev[-1]["reason"] == "New glasses"

    status = (await client.get(STATUS, headers=auth_headers(w.student))).json()
    assert status["status"] == "reset" and status["can_enroll"] is True and status["template_count"] == 0

    info = await client.get(f"/api/students/{w.student.id}/face", headers=auth_headers(w.admin))
    assert info.status_code == 200, info.text
    info = info.json()
    assert info["status"] == "reset" and info["template_count"] == 0 and info["face_registered"] is False
    assert [e["action"] for e in info["events"]] == ["reset", "enrolled"]  # newest first
    assert info["events"][0]["actor_name"] == w.admin.user.full_name
    assert info["events"][0]["reason"] == "New glasses"

    fake_face.set_frames(enrolment_burst(unit_embedding(10)))
    res = await enrol(client, auth_headers, w.student, challenge=await new_challenge(db, w.student))
    assert res.status_code == 200, res.text
    assert (await student_row(db, w.student.id))["status"] == "enrolled"
    assert len(await templates(db, w.student.id)) == 3


async def test_admin_face_info_for_enrolled_student(client, enrolled, auth_headers):
    w = enrolled
    res = await client.get(f"/api/students/{w.student.id}/face", headers=auth_headers(w.admin))
    assert res.status_code == 200, res.text
    info = res.json()
    assert info["student_id"] == w.student.id and info["status"] == "enrolled" and info["face_registered"] is True
    assert info["can_enroll"] is False and info["model"] == MODEL_ID
    assert info["template_count"] == 3 and info["poses"] == ["front", "left", "right"]
    assert info["registered_at"] and info["consent_at"]
    assert [e["action"] for e in info["events"]] == ["enrolled"]
    assert info["events"][0]["actor_name"] == w.student.user.full_name
    assert "embedding" not in res.text


# ============================================================================ consent
@pytest.mark.parametrize("extra", [{"consent": False}, {"consent": None}])
async def test_consent_required(client, db, world, auth_headers, fake_face, extra):
    ch = await new_challenge(db, world.student)
    body = {"images": images(3), "challenge_id": ch, **extra}
    res = await client.post(MULTI, json=body, headers=auth_headers(world.student))
    assert res.status_code == 400 and detail(res)["code"] == "consent_required"
    assert await challenge_used_at(db, ch) is None
    assert (await student_row(db, world.student.id))["status"] == "none"
    assert [(a["outcome"], a["counts_as_failure"]) for a in await attempts(db, world.student.id)] == [
        ("consent_required", False)]


async def test_consent_missing_is_required(client, db, world, auth_headers):
    ch = await new_challenge(db, world.student)
    res = await client.post(MULTI, json={"images": images(3), "challenge_id": ch}, headers=auth_headers(world.student))
    assert res.status_code == 400 and detail(res)["code"] == "consent_required"


# ========================================================================= challenges
async def test_challenge_required(client, db, world, auth_headers, fake_face):
    res = await enrol(client, auth_headers, world.student)
    assert res.status_code == 400 and detail(res)["code"] == "challenge_required"
    assert [(a["outcome"], a["counts_as_failure"]) for a in await attempts(db, world.student.id)] == [
        ("challenge_required", False)]


async def test_checkin_challenge_is_invalid_for_enrolment(client, db, world, auth_headers, fake_face):
    ch = await new_challenge(db, world.student, purpose="checkin")
    res = await enrol(client, auth_headers, world.student, challenge=ch)
    assert res.status_code == 400 and detail(res)["code"] == "challenge_invalid"
    assert await challenge_used_at(db, ch) is None  # another purpose: not consumed
    at = await attempts(db, world.student.id)
    assert [(a["outcome"], a["counts_as_failure"]) for a in at] == [("challenge_invalid", False)]


async def test_another_students_challenge_is_invalid(client, db, world, auth_headers, fake_face):
    ch = await new_challenge(db, world.other)
    res = await enrol(client, auth_headers, world.student, challenge=ch)
    assert res.status_code == 400 and detail(res)["code"] == "challenge_invalid"
    assert await challenge_used_at(db, ch) is None


async def test_expired_challenge_is_invalid_and_consumed(client, db, world, auth_headers, fake_face):
    fake_face.set_frames(enrolment_burst(unit_embedding(10)))
    ch = await new_challenge(db, world.student)
    world.clock.advance(seconds=91)  # default TTL 90 s
    res = await enrol(client, auth_headers, world.student, challenge=ch)
    assert res.status_code == 400 and detail(res)["code"] == "challenge_invalid"
    assert await challenge_used_at(db, ch) == world.clock.now
    assert (await student_row(db, world.student.id))["status"] == "none"


async def test_challenge_is_single_use_even_after_a_rejection(client, db, world, auth_headers, fake_face):
    emb = unit_embedding(10)
    fake_face.set_frames([frontal(emb, sharpness=1.0)] * 3)
    ch = await new_challenge(db, world.student)
    first = await enrol(client, auth_headers, world.student, challenge=ch)
    assert first.status_code == 422 and detail(first)["code"] == "low_quality"
    assert await challenge_used_at(db, ch) == world.clock.now  # survives the rollback

    fake_face.set_frames(enrolment_burst(emb))
    second = await enrol(client, auth_headers, world.student, challenge=ch)
    assert second.status_code == 400 and detail(second)["code"] == "challenge_invalid"
    at = await attempts(db, world.student.id)
    assert [(a["outcome"], a["counts_as_failure"]) for a in at] == [("low_quality", False), ("challenge_invalid", False)]
    assert all(a["challenge_id"] == ch for a in at)


# ============================================================================= frames
@pytest.mark.parametrize("count", [2, 9])
async def test_invalid_frame_count(client, db, world, auth_headers, fake_face, count):
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student), n=count)
    assert res.status_code == 400 and detail(res)["code"] == "invalid_frames"
    assert detail(res)["details"] == {"min_images": 3, "max_images": 8, "received": count}
    assert not [c for c in fake_face.calls if c[0] == "process_frames"]


async def test_enrolment_min_images_comes_from_policy(client, db, world, auth_headers, fake_face):
    await set_face_policy(db, enrolment_min_images=5)
    emb = unit_embedding(10)
    fake_face.set_frames(enrolment_burst(emb) + [frontal(emb)])
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student), n=4)
    assert res.status_code == 400 and detail(res)["code"] == "invalid_frames"
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student), n=5)
    assert res.status_code == 200, res.text
    assert res.json()["details"]["template_count"] == 5


@pytest.mark.parametrize("bad, issue", [
    ({"sharpness": 5.0}, "too_blurry"),
    ({"brightness": 10.0}, "too_dark"),
    ({"brightness": 250.0}, "too_bright"),
    ({"det_score": 0.65}, "low_confidence"),  # enough for check-in (0.60), not for enrolment (0.70)
    ({"width": 50.0, "height": 60.0}, "too_small"),
    ({"faces_detected": 2, "secondary_face_ratio": 0.6}, "multiple_faces"),
    (None, "no_face"),
])
async def test_low_quality(client, db, world, auth_headers, fake_face, bad, issue):
    emb = unit_embedding(10)
    if bad is None:
        fake_face.set_frames([None, None, turned(emb, "right")])
    else:
        fake_face.set_frames([frontal(emb, **bad), turned(emb, "left", **bad), turned(emb, "right")])
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student))
    assert res.status_code == 422, res.text
    d = detail(res)
    assert d["code"] == "low_quality"
    assert d["details"]["valid_images"] == 1 and d["details"]["required"] == 3
    assert issue in d["details"]["quality_issues"]
    results = d["details"]["image_results"]
    assert issue in results[0]["issues"] and results[0]["valid"] is False
    assert results[2]["valid"] is True
    assert (await student_row(db, world.student.id))["status"] == "none"
    assert await templates(db, world.student.id) == []
    at = await attempts(db, world.student.id)
    assert [(a["outcome"], a["counts_as_failure"]) for a in at] == [("low_quality", False)]
    assert issue in at[0]["details"]["quality_issues"]


async def test_small_secondary_face_is_allowed(client, db, world, auth_headers, fake_face):
    fake_face.set_frames(enrolment_burst(unit_embedding(10), faces_detected=2, secondary_face_ratio=0.2))
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student))
    assert res.status_code == 200, res.text


@pytest.mark.parametrize("frames, missing", [
    (["front", "front", "front"], ["left", "right"]),
    (["front", "left", "left"], ["right"]),
    (["front", "in_between_left", "in_between_right"], ["left", "right"]),
])
async def test_pose_coverage(client, db, world, auth_headers, fake_face, frames, missing):
    emb = unit_embedding(10)
    make = {
        "front": lambda: frontal(emb),
        "left": lambda: turned(emb, "left"),
        "in_between_left": lambda: face_spec(emb, yaw=0.15),
        "in_between_right": lambda: face_spec(emb, yaw=-0.15),
    }
    fake_face.set_frames([make[f]() for f in frames])
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student))
    assert res.status_code == 422, res.text
    assert detail(res)["code"] == "pose_coverage"
    assert detail(res)["details"]["missing_poses"] == missing
    assert (await student_row(db, world.student.id))["status"] == "none"


# =========================================================================== liveness
async def test_spoof_suspected_is_blocked_and_audited(client, db, world, auth_headers, fake_face):
    fake_face.set_frames(enrolment_burst(unit_embedding(10), liveness=0.3))
    ch = await new_challenge(db, world.student)
    res = await enrol(client, auth_headers, world.student, challenge=ch)
    assert res.status_code == 422, res.text
    assert detail(res)["code"] == "spoof_suspected"
    assert "0.3" not in res.text  # no score shown to the student

    row = await student_row(db, world.student.id)
    assert row["status"] == "none" and row["enc_null"] is True
    assert await templates(db, world.student.id) == []
    ev = await events(db, world.student.id)
    assert [e["action"] for e in ev] == ["spoof_blocked"]  # persisted despite the rollback
    assert ev[0]["details"]["liveness_score"] == pytest.approx(0.3)
    at = await attempts(db, world.student.id)
    assert [(a["outcome"], a["counts_as_failure"]) for a in at] == [("spoof_suspected", False)]
    assert float(at[0]["liveness_score"]) == pytest.approx(0.3)
    assert await challenge_used_at(db, ch) == world.clock.now


async def test_liveness_uses_the_front_frames(client, db, world, auth_headers, fake_face):
    emb = unit_embedding(10)
    fake_face.set_frames([frontal(emb, liveness=0.9), turned(emb, "left", liveness=0.1),
                          turned(emb, "right", liveness=0.1)])
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student))
    assert res.status_code == 200, res.text


async def test_liveness_unavailable(client, db, world, auth_headers, fake_face):
    fake_face.set_frames(enrolment_burst(unit_embedding(10)))
    fake_face.liveness_available = False
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student))
    assert res.status_code == 503, res.text
    assert detail(res)["code"] == "liveness_unavailable"
    assert await events(db, world.student.id) == []
    assert [a["outcome"] for a in await attempts(db, world.student.id)] == ["liveness_unavailable"]
    assert (await student_row(db, world.student.id))["status"] == "none"


# ========================================================================== duplicates
async def test_duplicate_face_is_blocked_without_revealing_the_other_student(client, db, world, auth_headers, fake_face):
    face = unit_embedding(30)
    await mark_enrolled(db, world.other, face)
    fake_face.set_frames(enrolment_burst(blend(face, unit_embedding(31), 0.1)))
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student))
    assert res.status_code == 409, res.text
    d = detail(res)
    assert d == {"code": "duplicate_face", "message": DUPLICATE_MESSAGE, "details": {}}
    assert "other_student" not in res.text and "similarity" not in res.text

    ev = await events(db, world.student.id)
    assert [e["action"] for e in ev] == ["duplicate_blocked"]
    assert ev[0]["details"]["other_student_id"] == world.other.id
    assert ev[0]["details"]["similarity"] >= 0.45
    at = await attempts(db, world.student.id)
    assert [(a["outcome"], a["counts_as_failure"]) for a in at] == [("duplicate_face", False)]
    assert (await student_row(db, world.student.id))["status"] == "none"
    assert await templates(db, world.student.id) == []
    assert (await student_row(db, world.other.id))["status"] == "enrolled"


async def test_duplicate_check_includes_other_students_templates(client, db, world, auth_headers, fake_face):
    await mark_enrolled(db, world.other, unit_embedding(40), template=unit_embedding(41))
    fake_face.set_frames(enrolment_burst(unit_embedding(41)))
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student))
    assert res.status_code == 409 and detail(res)["code"] == "duplicate_face"


async def test_a_different_face_is_not_a_duplicate(client, db, world, auth_headers, fake_face):
    await mark_enrolled(db, world.other, unit_embedding(50))
    fake_face.set_frames(enrolment_burst(unit_embedding(51)))
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student))
    assert res.status_code == 200, res.text


# ===================================================================== policy toggles
async def test_without_head_turn_no_challenge_and_only_a_front_pose(client, db, world, auth_headers, fake_face):
    await set_face_policy(db, require_head_turn=False)
    emb = unit_embedding(10)
    fake_face.set_frames([turned(emb, "left")] * 3)
    res = await enrol(client, auth_headers, world.student)
    assert res.status_code == 422 and detail(res)["code"] == "pose_coverage"
    assert detail(res)["details"]["missing_poses"] == ["front"]

    fake_face.set_frames([frontal(emb)] * 3)
    res = await enrol(client, auth_headers, world.student)
    assert res.status_code == 200, res.text
    assert res.json()["details"]["poses"] == {"front": 3, "left": 0, "right": 0}


async def test_without_liveness_the_antispoof_check_is_skipped(client, db, world, auth_headers, fake_face):
    await set_face_policy(db, require_liveness=False)
    fake_face.liveness_available = False
    fake_face.set_frames(enrolment_burst(unit_embedding(10), liveness=0.1))
    res = await enrol(client, auth_headers, world.student, challenge=await new_challenge(db, world.student))
    assert res.status_code == 200, res.text
    assert ("process_frames", (3, False)) in fake_face.calls
    assert (await attempts(db, world.student.id))[0]["liveness_score"] is None


# ===================================================================== access control
async def test_enrolment_endpoints_are_student_only(client, world, auth_headers):
    assert (await client.get(STATUS, headers=auth_headers(world.teacher))).status_code == 403
    res = await client.post(MULTI, json={"images": images(3), "consent": True}, headers=auth_headers(world.admin))
    assert res.status_code == 403
    assert (await client.delete(MY_FACE, headers=auth_headers(world.teacher))).status_code == 403


@pytest.mark.parametrize("role", ["student", "teacher"])
async def test_admin_face_endpoints_reject_non_admins(client, world, auth_headers, role):
    who = world.student if role == "student" else world.teacher
    res = await client.post(f"/api/students/{world.student.id}/face/reset", json={"reason": "Lost access"},
                            headers=auth_headers(who))
    assert res.status_code == 403
    res = await client.get(f"/api/students/{world.student.id}/face", headers=auth_headers(who))
    assert res.status_code == 403


@pytest.mark.parametrize("body", [None, {}, {"reason": ""}, {"reason": "  ab  "}, {"reason": None}])
async def test_admin_reset_requires_a_reason(client, db, world, auth_headers, body):
    await mark_enrolled(db, world.student, unit_embedding(10))
    kwargs = {} if body is None else {"json": body}
    res = await client.post(f"/api/students/{world.student.id}/face/reset", headers=auth_headers(world.admin), **kwargs)
    assert res.status_code == 400, res.text
    assert detail(res)["code"] == "reason_required"
    assert (await student_row(db, world.student.id))["status"] == "enrolled"
    assert await events(db, world.student.id) == []


async def test_admin_face_endpoints_unknown_student(client, world, auth_headers):
    res = await client.post("/api/students/999999/face/reset", json={"reason": "Lost access"},
                            headers=auth_headers(world.admin))
    assert res.status_code == 404
    assert (await client.get("/api/students/999999/face", headers=auth_headers(world.admin))).status_code == 404


# ==================================================================== student payloads
async def test_student_payloads_never_include_embeddings(client, db, enrolled, auth_headers):
    w = enrolled
    res = await client.get("/api/students/?limit=100000", headers=auth_headers(w.admin))
    assert res.status_code == 200, res.text
    rows = {r["id"]: r for r in res.json()}
    me, other = rows[w.student.id], rows[w.other.id]
    assert me["face_encoding"] is None and me["face_registered"] is True
    assert me["face_enrollment_status"] == "enrolled" and me["face_registered_at"]
    assert other["face_encoding"] is None and other["face_registered"] is False
    assert other["face_enrollment_status"] == "none" and other["face_registered_at"] is None

    one = await client.get(f"/api/students/{w.student.id}", headers=auth_headers(w.admin))
    assert one.status_code == 200, one.text
    one = one.json()
    assert one["face_encoding"] is None and one["face_registered"] is True
    assert one["face_enrollment_status"] == "enrolled" and one["face_registered_at"]

    own = await client.get("/api/students/", headers=auth_headers(w.student))
    assert own.status_code == 200
    assert [(r["id"], r["face_encoding"], r["face_registered"]) for r in own.json()] == [(w.student.id, None, True)]

    upd = await client.put(f"/api/students/{w.student.id}", json={"phone_number": "9800000000"},
                           headers=auth_headers(w.admin))
    assert upd.status_code == 200, upd.text
    assert upd.json()["face_encoding"] is None and upd.json()["face_registered"] is True
