"""Face enrolment, self-deletion and admin reset (docs/system/face-verification.md §8).

Enrolment flow (``enroll``), first failure wins::

    1 status (already_enrolled / enrolment_locked)  ->  2 consent (consent_required)
    -> 3 head-turn challenge, consumed (challenge_required / challenge_invalid)
    -> 4 image count (invalid_frames)  ->  5 engine + per-frame quality (low_quality)
    -> 6 pose coverage (pose_coverage)  ->  7 passive liveness (liveness_unavailable /
       spoof_suspected + ``spoof_blocked`` event)  ->  8 composite
    -> 9 duplicate check (duplicate_face + ``duplicate_blocked`` event)
    -> 10 replace templates, set the student's face fields, ``enrolled`` event, attempt row

Transactions: services FLUSH, the route OWNS THE COMMIT. A rejected enrolment raises
:class:`EnrollmentRejected` (a :class:`DomainError`) carrying a :class:`RejectionAudit`. The
route rolls the main work back, then calls :func:`record_rejection` and commits, so the audit
trail of a refused enrolment survives: the attempt row (``purpose='enrolment'``,
``outcome=<code>``, never counted towards the check-in lock-out), the ``spoof_blocked`` /
``duplicate_blocked`` event, and the single-use challenge's ``used_at``.

Privacy: no image is stored; only embeddings and numeric quality measurements. A
``duplicate_face`` rejection never names the other student in the response (only the
``duplicate_blocked`` event, which admins see, does).

Model access goes through the ``insightface_service`` singleton only (tests replace it with
``tests/support/fake_face.py``).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional, Sequence

from sqlalchemy import delete, null, select, update

from app.core.clock import app_now
from app.models import (
    ENROLLMENT_STATUSES_ALLOWING_ENROLMENT,
    AttemptPurpose,
    ChallengePurpose,
    EnrollmentEventAction,
    FaceChallenge,
    FaceEnrollmentEvent,
    FaceEnrollmentStatus,
    FacePose,
    FaceTemplate,
    Student,
    User,
)
from app.services import face_attempts, face_challenges, face_math, face_store
from app.services.domain_errors import DomainError
from app.services.face_policy import FacePolicy, get_face_policy
from app.services.insightface_service import insightface_service

logger = logging.getLogger(__name__)

#: Hard upper bound on enrolment images (§8 step 4).
MAX_ENROLMENT_IMAGES = 8
#: A second face larger than this fraction of the main face makes the frame invalid (§8 step 5).
MAX_SECONDARY_FACE_RATIO = 0.25
#: Events returned by ``admin_face_info``.
ADMIN_EVENT_LIMIT = 50
#: Minimum length of an admin reset reason (after stripping).
MIN_RESET_REASON_LENGTH = 3

DUPLICATE_MESSAGE = "This face is already registered to another account. Contact an administrator."

STATUS_MESSAGES = {
    "none": "Register your face to use face check-in.",
    "enrolled": "Your face is registered.",
    "reset": "An administrator reset your face registration. Register your face again to use face check-in.",
    "deleted": "You deleted your face data. Ask an administrator to reset your face registration before registering again.",
}
#: Statuses that may enrol, as plain strings (``none``, ``reset``).
_CAN_ENROLL = frozenset(str(s) for s in ENROLLMENT_STATUSES_ALLOWING_ENROLMENT)


# ---------------------------------------------------------------------------------------
# Rejection audit (persisted after the route's rollback)
# ---------------------------------------------------------------------------------------
@dataclass
class RejectionAudit:
    """What a refused enrolment must still write once the main work is rolled back."""

    student_id: int
    outcome: str
    now: datetime
    challenge_id: Optional[str] = None
    challenge_referenced: bool = False  # step 3 was reached: keep the challenge single use
    actor_user_id: Optional[int] = None
    ip: Optional[str] = None
    liveness_score: Optional[float] = None
    similarity: Optional[float] = None
    attempt_details: dict[str, Any] = field(default_factory=dict)
    event_action: Optional[str] = None
    event_details: Optional[dict[str, Any]] = None


class EnrollmentRejected(DomainError):
    """A :class:`DomainError` from ``enroll`` plus the audit rows to keep after rollback."""

    def __init__(self, error: DomainError, audit: RejectionAudit) -> None:
        super().__init__(error.code, error.message, http_status=error.http_status, details=error.details)
        self.audit = audit


async def record_rejection(db, audit: RejectionAudit) -> None:
    """Write the audit trail of a refused enrolment (call after the rollback; flushes only).

    * re-marks the challenge used (the rollback undid ``consume_challenge``) when it belongs
      to this student and is an enrolment challenge, exactly like ``consume_challenge``;
    * adds the ``spoof_blocked`` / ``duplicate_blocked`` event, if any;
    * logs the attempt (``counts_as_failure`` is always False for enrolment).
    """
    if audit.challenge_referenced and audit.challenge_id:
        await db.execute(
            update(FaceChallenge)
            .where(FaceChallenge.id == str(audit.challenge_id),
                   FaceChallenge.student_id == audit.student_id,
                   FaceChallenge.purpose == str(ChallengePurpose.enrolment),
                   FaceChallenge.used_at.is_(None))
            .values(used_at=audit.now)
            .execution_options(synchronize_session=False)
        )
    if audit.event_action:
        face_store.add_enrollment_event(
            db, student_id=audit.student_id, action=audit.event_action, actor_user_id=audit.actor_user_id,
            details=audit.event_details, at=audit.now,
        )
    await face_attempts.record_attempt(
        db, student_id=audit.student_id, purpose=AttemptPurpose.enrolment, outcome=audit.outcome,
        challenge_id=(str(audit.challenge_id)[:32] if audit.challenge_id else None),
        similarity=audit.similarity, liveness_score=audit.liveness_score,
        details=audit.attempt_details or None, ip_address=audit.ip, counts_as_failure=False, now=audit.now,
    )


# ---------------------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------------------
def effective_status(student: Student) -> str:
    """The stored ``face_enrollment_status``, except that a student who still has a composite
    template counts as ``enrolled`` (legacy rows written before the status column existed),
    so a template can never be overwritten without an admin reset."""
    status = str(getattr(student, "face_enrollment_status", None) or FaceEnrollmentStatus.none)
    if status in (FaceEnrollmentStatus.none, FaceEnrollmentStatus.reset) and student.face_encoding:
        return str(FaceEnrollmentStatus.enrolled)
    return status


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value is not None else None


async def enrollment_status(db, student: Student) -> dict[str, Any]:
    """``GET /face-recognition/enrollment``: ``{status, can_enroll, registered_at, model,
    template_count, consent_at, message}``."""
    status = effective_status(student)
    count, _poses = await face_store.template_summary(db, student.id)
    return {
        "status": status,
        "can_enroll": status in _CAN_ENROLL,
        "registered_at": _iso(student.face_registered_at),
        "model": student.face_model,
        "template_count": count,
        "consent_at": _iso(student.face_consent_at),
        "message": STATUS_MESSAGES.get(status, STATUS_MESSAGES["none"]),
    }


def _check_can_enroll(student: Student) -> None:
    status = effective_status(student)
    if status == FaceEnrollmentStatus.enrolled:
        raise DomainError("already_enrolled", "Your face is already registered.", http_status=409)
    if status == FaceEnrollmentStatus.deleted:
        raise DomainError("enrolment_locked", STATUS_MESSAGES["deleted"], http_status=409)
    if status not in _CAN_ENROLL:  # pragma: no cover - CHECK constraint
        raise DomainError("enrolment_locked", "Face registration is not available for this account.", http_status=409)


# ---------------------------------------------------------------------------------------
# Frame evaluation (pure)
# ---------------------------------------------------------------------------------------
def _frame_yaw(face: dict[str, Any]) -> float:
    yaw = face.get("yaw")
    return float(yaw) if yaw is not None else face_math.yaw_from_kps(face.get("kps"))


def _stored_pose(strict_pose: Optional[str], yaw: float) -> str:
    """Pose label for the template row. A frame between ``frontal_max_yaw`` and
    ``head_turn_min_yaw`` is still a valid template (§8 step 10: one row per valid frame); it
    is labelled with the side it leans to but never counts towards pose coverage."""
    if strict_pose:
        return strict_pose
    return str(FacePose.left if yaw > 0 else FacePose.right)


def evaluate_frames(results: Sequence[dict[str, Any]], policy: FacePolicy) -> list[dict[str, Any]]:
    """Per-frame verdicts for §8 step 5/6.

    Returns one dict per engine result: ``index``, ``valid``, ``issues`` (quality codes:
    ``invalid_image``, ``no_face``, ``multiple_faces``, ``low_confidence``, ``too_small``,
    ``too_blurry``, ``too_dark``, ``too_bright``, ``turned_too_far``), ``pose`` (strict
    front/left/right of a valid frame, or None), ``direction`` (the pose the yaw points to,
    valid or not, so the UI can say *which* photo failed), plus the private keys ``_face``,
    ``_yaw``, ``_liveness`` used by ``enroll``.

    Detection confidence drops naturally on turned faces, so only frontal frames need
    ``enrolment_min_detection_score``; turned frames need ``min_detection_score``. Frames turned
    beyond ``max_turn_yaw`` (near profile) are rejected as ``turned_too_far``.
    """
    evaluated: list[dict[str, Any]] = []
    for i, r in enumerate(results):
        face = r.get("face") if isinstance(r, dict) else None
        issues: list[str] = []
        yaw = _frame_yaw(face) if face else None
        if r.get("error") or not face:
            issues.append(str(r.get("error") or "no_face"))
        else:
            if int(r.get("faces_detected") or 0) > 1 and float(r.get("secondary_face_ratio") or 0.0) > MAX_SECONDARY_FACE_RATIO:
                issues.append("multiple_faces")
            turned_frame = yaw is not None and abs(yaw) > policy.frontal_max_yaw
            if turned_frame and abs(yaw) > policy.max_turn_yaw:
                issues.append("turned_too_far")
            issues.extend(face_math.quality_issues(
                face,
                min_detection_score=policy.min_detection_score if turned_frame else policy.enrolment_min_detection_score,
                min_face_size_px=policy.min_face_size_px,
                min_sharpness=policy.min_sharpness,
                min_brightness=policy.min_brightness,
                max_brightness=policy.max_brightness,
            ))
            if not face.get("embedding"):
                issues.append("no_face")
        valid = not issues
        direction = (face_math.classify_pose(yaw, frontal_max_yaw=policy.frontal_max_yaw, turn_min_yaw=policy.head_turn_min_yaw)
                     if yaw is not None else None)
        pose = direction if valid else None
        evaluated.append({
            "index": int(r.get("index", i)),
            "valid": valid,
            "pose": pose,
            "direction": direction,
            "issues": issues,
            "_face": face if valid else None,
            "_yaw": yaw,
            "_liveness": r.get("liveness"),
        })
    return evaluated


def _public_results(evaluated: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{k: v for k, v in e.items() if not k.startswith("_")} for e in evaluated]


def _pose_counts(poses: Sequence[str]) -> dict[str, int]:
    return {p: sum(1 for x in poses if x == p) for p in (FacePose.front.value, FacePose.left.value, FacePose.right.value)}


def _quality(face: dict[str, Any], yaw: float) -> dict[str, Any]:
    def num(key: str) -> Optional[float]:
        v = face.get(key)
        return None if v is None else round(float(v), 4)

    return {"det_score": num("det_score"), "sharpness": num("sharpness"), "brightness": num("brightness"),
            "yaw": round(float(yaw), 4), "area_ratio": num("area_ratio")}


# ---------------------------------------------------------------------------------------
# Enrolment
# ---------------------------------------------------------------------------------------
async def enroll(db, *, student: Student, images: Optional[Sequence[str]], consent: Any,
                 challenge_id: Optional[str], actor_user_id: Optional[int] = None,
                 now: Optional[datetime] = None, ip: Optional[str] = None,
                 policy: Optional[FacePolicy] = None) -> dict[str, Any]:
    """Enrol ``student``'s face (§8 steps 1-10). Flushes only; the route commits.

    Returns ``{success: True, message, details: {images_processed, valid_images, poses,
    template_count, model, image_results}}``. Raises :class:`EnrollmentRejected`.
    """
    now = now or app_now()
    policy = policy or await get_face_policy(db)
    images = list(images or [])
    audit = RejectionAudit(student_id=student.id, outcome="", now=now, challenge_id=challenge_id,
                           actor_user_id=actor_user_id, ip=ip)
    try:
        return await _enroll(db, student=student, images=images, consent=consent, challenge_id=challenge_id,
                             actor_user_id=actor_user_id, now=now, ip=ip, policy=policy, audit=audit)
    except EnrollmentRejected:
        raise
    except DomainError as err:
        audit.outcome = err.code
        raise EnrollmentRejected(err, audit) from None


async def _enroll(db, *, student: Student, images: list[str], consent: Any, challenge_id: Optional[str],
                  actor_user_id: Optional[int], now: datetime, ip: Optional[str], policy: FacePolicy,
                  audit: RejectionAudit) -> dict[str, Any]:
    model_id = insightface_service.model_id
    audit.attempt_details = {"images": len(images)}

    # 1. status
    _check_can_enroll(student)

    # 2. consent
    if consent is not True:
        raise DomainError("consent_required", "Please confirm that you consent to storing your face template.",
                          http_status=400)

    # 3. head-turn challenge (single use: consumed whatever the outcome)
    if policy.require_head_turn:
        audit.challenge_referenced = bool(challenge_id)
        await face_challenges.consume_challenge(db, student=student, challenge_id=challenge_id,
                                                purpose=ChallengePurpose.enrolment, now=now)

    # 4. image count
    if not (policy.enrolment_min_images <= len(images) <= MAX_ENROLMENT_IMAGES):
        raise DomainError(
            "invalid_frames",
            f"Send between {policy.enrolment_min_images} and {MAX_ENROLMENT_IMAGES} photos.",
            http_status=400,
            details={"min_images": policy.enrolment_min_images, "max_images": MAX_ENROLMENT_IMAGES,
                     "received": len(images)},
        )

    # 5. engine + per-frame quality
    results = await insightface_service.aprocess_frames(images, with_liveness=policy.require_liveness)
    evaluated = evaluate_frames(results, policy)
    valid = [e for e in evaluated if e["valid"]]
    image_results = _public_results(evaluated)
    all_issues = sorted({issue for e in evaluated for issue in e["issues"]})
    audit.attempt_details.update({
        "valid_images": len(valid),
        "yaw": [None if e["_yaw"] is None else round(float(e["_yaw"]), 4) for e in evaluated],
        "poses": [e["pose"] for e in evaluated],
        "quality_issues": all_issues,
    })
    if len(valid) < policy.enrolment_min_images:
        raise DomainError(
            "low_quality",
            "Not enough clear photos of your face. Use good light, keep only your face in view and hold still.",
            http_status=422,
            details={"image_results": image_results, "valid_images": len(valid),
                     "required": policy.enrolment_min_images, "quality_issues": all_issues},
        )

    # 6. pose coverage (strict classification only)
    strict = {e["pose"] for e in valid if e["pose"]}
    required = ({FacePose.front.value, FacePose.left.value, FacePose.right.value} if policy.require_head_turn
                else {FacePose.front.value})
    missing = sorted(required - strict)
    if missing:
        raise DomainError(
            "pose_coverage",
            "We need a photo looking straight at the camera" + (", one turned to your left and one turned to your right."
                                                                 if policy.require_head_turn else "."),
            http_status=422,
            details={
                "missing_poses": missing,
                # Why the photos meant for each missing pose were rejected (e.g. turned_too_far).
                "pose_issues": {p: sorted({i for e in evaluated if e["direction"] == p for i in e["issues"]})
                                for p in missing},
                "image_results": image_results,
            },
        )

    # 7. passive liveness on the front frames
    liveness_score: Optional[float] = None
    if policy.require_liveness:
        scores = [float(e["_liveness"]) for e in valid if e["pose"] == FacePose.front and e["_liveness"] is not None]
        if not insightface_service.liveness_available or not scores:
            raise DomainError("liveness_unavailable",
                              "Face liveness checking is not available right now. Please contact an administrator.",
                              http_status=503)
        liveness_score = sum(scores) / len(scores)
        audit.liveness_score = liveness_score
        if liveness_score < policy.antispoof_threshold:
            audit.event_action = str(EnrollmentEventAction.spoof_blocked)
            audit.event_details = {"liveness_score": round(liveness_score, 4),
                                   "threshold": policy.antispoof_threshold, "frames": len(scores)}
            raise DomainError("spoof_suspected",
                              "We couldn't confirm a live face. Don't use a photo or a screen, and try again in good light.",
                              http_status=422)

    # 8. composite
    composite = face_math.composite_embedding([e["_face"]["embedding"] for e in valid])

    # 9. duplicate check against every other enrolled student (1:N)
    by_student: dict[int, list[list[float]]] = {}
    for sid, emb in await face_store.gallery(db, model_id=model_id, exclude_student_id=student.id):
        by_student.setdefault(sid, []).append(emb)
    best_sid, best_sim = None, 0.0
    for sid, embs in by_student.items():
        sim = face_math.best_similarity(embs, composite)
        if best_sid is None or sim > best_sim:
            best_sid, best_sim = sid, sim
    if best_sid is not None:
        audit.similarity = best_sim
    if best_sid is not None and best_sim >= policy.duplicate_threshold:
        audit.event_action = str(EnrollmentEventAction.duplicate_blocked)
        audit.event_details = {"other_student_id": best_sid, "similarity": round(best_sim, 4),
                               "threshold": policy.duplicate_threshold}
        raise DomainError("duplicate_face", DUPLICATE_MESSAGE, http_status=409)

    # 10. save
    await db.execute(delete(FaceTemplate).where(FaceTemplate.student_id == student.id))
    stored_poses: list[str] = []
    for e in valid:
        pose = _stored_pose(e["pose"], e["_yaw"])
        stored_poses.append(pose)
        db.add(FaceTemplate(student_id=student.id, model=model_id, pose=pose,
                            embedding=[float(x) for x in e["_face"]["embedding"]],
                            quality=_quality(e["_face"], e["_yaw"]), created_at=now))
    student.face_encoding = composite
    student.face_enrollment_status = str(FaceEnrollmentStatus.enrolled)
    student.face_registered_at = now
    student.face_model = model_id
    student.face_consent_at = now
    poses = _pose_counts(stored_poses)
    face_store.add_enrollment_event(db, student_id=student.id, action=EnrollmentEventAction.enrolled,
                                    actor_user_id=actor_user_id,
                                    details={"template_count": len(valid), "poses": poses, "model": model_id},
                                    at=now)
    await face_attempts.record_attempt(
        db, student_id=student.id, purpose=AttemptPurpose.enrolment, outcome="success",
        challenge_id=(str(challenge_id)[:32] if challenge_id else None),
        similarity=audit.similarity, liveness_score=liveness_score,
        details=audit.attempt_details, ip_address=ip, counts_as_failure=False, now=now,
    )
    await db.flush()
    return {
        "success": True,
        "message": "Face registered successfully.",
        "details": {
            "images_processed": len(images),
            "valid_images": len(valid),
            "poses": poses,
            "template_count": len(valid),
            "model": model_id,
            "image_results": image_results,
        },
    }


# ---------------------------------------------------------------------------------------
# Deletion and admin reset
# ---------------------------------------------------------------------------------------
async def _clear(db, student: Student, *, new_status: str) -> int:
    """``face_store.clear_face_data`` plus a guaranteed SQL NULL composite: the ORM ``JSON``
    column persists Python ``None`` as JSON ``'null'``, which ``face_encoding IS NOT NULL``
    queries would still count as registered."""
    deleted = await face_store.clear_face_data(db, student, new_status=new_status)
    await db.execute(update(Student.__table__).where(Student.__table__.c.id == student.id).values(face_encoding=null()))
    return deleted


async def delete_own_face(db, *, student: Student, actor_user_id: Optional[int] = None,
                          now: Optional[datetime] = None) -> dict[str, Any]:
    """``DELETE /face-recognition/my-face``: delete templates, null the composite, status
    ``deleted`` (re-enrolment then needs an admin reset) and a ``deleted`` event.

    Idempotent: already ``deleted`` -> success without a new event. A student with no face
    data (``none`` / ``reset``) is left unchanged, so deleting nothing never locks enrolment.
    """
    now = now or app_now()
    status = effective_status(student)
    if status == FaceEnrollmentStatus.deleted:
        return {"success": True, "message": "Your face data has already been deleted."}
    count, _ = await face_store.template_summary(db, student.id)
    if status != FaceEnrollmentStatus.enrolled and count == 0:
        return {"success": True, "message": "You have no face data stored."}
    deleted = await _clear(db, student, new_status=FaceEnrollmentStatus.deleted)
    face_store.add_enrollment_event(db, student_id=student.id, action=EnrollmentEventAction.deleted,
                                    actor_user_id=actor_user_id,
                                    details={"templates_deleted": deleted, "previous_status": status}, at=now)
    await db.flush()
    return {"success": True,
            "message": "Your face data has been deleted. Ask an administrator if you want to register again."}


async def admin_reset_face(db, *, student: Student, actor: Any, reason: Optional[str],
                           now: Optional[datetime] = None) -> dict[str, Any]:
    """``POST /students/{id}/face/reset`` (admin): delete templates, null the composite,
    status ``reset`` (the student may enrol again) and a ``reset`` event with actor + reason."""
    now = now or app_now()
    reason = "" if reason is None else str(reason).strip()
    if len(reason) < MIN_RESET_REASON_LENGTH:
        raise DomainError("reason_required",
                          f"A reason of at least {MIN_RESET_REASON_LENGTH} characters is required.", http_status=400)
    actor_user_id = getattr(actor, "id", actor)
    previous = effective_status(student)
    deleted = await _clear(db, student, new_status=FaceEnrollmentStatus.reset)
    face_store.add_enrollment_event(db, student_id=student.id, action=EnrollmentEventAction.reset,
                                    actor_user_id=actor_user_id, reason=reason,
                                    details={"templates_deleted": deleted, "previous_status": previous}, at=now)
    await db.flush()
    return {"success": True, "message": "Face registration reset. The student can register again.",
            "student_id": student.id, "status": str(FaceEnrollmentStatus.reset), "templates_deleted": deleted}


async def admin_face_info(db, student: Student) -> dict[str, Any]:
    """``GET /students/{id}/face`` (admin): status fields, template count and poses, and the
    last ``ADMIN_EVENT_LIMIT`` events (newest first, with the actor's name)."""
    count, poses = await face_store.template_summary(db, student.id)
    rows = (await db.execute(
        select(FaceEnrollmentEvent, User.full_name)
        .outerjoin(User, User.id == FaceEnrollmentEvent.actor_user_id)
        .where(FaceEnrollmentEvent.student_id == student.id)
        .order_by(FaceEnrollmentEvent.created_at.desc(), FaceEnrollmentEvent.id.desc())
        .limit(ADMIN_EVENT_LIMIT)
    )).all()
    status = effective_status(student)
    return {
        "student_id": student.id,
        "status": status,
        "face_registered": bool(student.face_encoding),
        "can_enroll": status in _CAN_ENROLL,
        "registered_at": _iso(student.face_registered_at),
        "model": student.face_model,
        "consent_at": _iso(student.face_consent_at),
        "template_count": count,
        "poses": poses,
        "events": [
            {
                "id": ev.id,
                "action": ev.action,
                "actor_user_id": ev.actor_user_id,
                "actor_name": actor_name,
                "reason": ev.reason,
                "details": ev.details,
                "created_at": _iso(ev.created_at),
            }
            for ev, actor_name in rows
        ],
    }


__all__ = [
    "EnrollmentRejected", "RejectionAudit", "record_rejection", "effective_status", "enrollment_status",
    "evaluate_frames", "enroll", "delete_own_face", "admin_reset_face", "admin_face_info",
    "MAX_ENROLMENT_IMAGES", "DUPLICATE_MESSAGE",
]
