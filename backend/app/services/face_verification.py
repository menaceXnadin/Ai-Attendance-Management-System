"""Face check-in orchestration (docs/system/face-verification.md §7).

``run_face_checkin`` is the whole ``POST /face-recognition/mark-attendance`` request: the
biometric and anti-fraud layer (lock-out, presence code, challenge, quality, identity, head
turn, passive liveness) in front of the unchanged attendance rules
(``attendance_recording.find_checkin_session`` / ``student_self_checkin``).
``run_verify_identity`` is the legacy ``POST /face-recognition/verify-identity`` (steps 1, 2,
6, 7 and 8 only).

Transactions: unlike the domain services, these two functions **own the transaction** of the
request (the routes only delegate). Every request writes exactly one
``face_verification_attempts`` row:

* success -> the attendance write, the challenge consumption and the attempt are committed
  together;
* rejection -> everything is rolled back, then the challenge is re-marked used (when step 5
  was reached; single use whatever the outcome) and the attempt is written and committed.

Model access goes only through the ``insightface_service`` singleton, always via
``aprocess_frames`` (never model code on the event loop). Thresholds come only from
``FacePolicy``. Students never see a similarity score unless the result is a match.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any, Optional, Sequence

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.core.clock import app_now
from app.models import (
    AttemptPurpose,
    ChallengeAction,
    ChallengePurpose,
    ClassSchedule,
    ClassSession,
    FaceChallenge,
    Student,
    Subject,
)
from app.services import face_attempts, face_math, face_store, presence_code
from app.services.attendance_policy import get_attendance_policy
from app.services.attendance_recording import find_checkin_session, student_self_checkin
from app.services.domain_errors import DomainError
from app.services.face_challenges import consume_challenge
from app.services.face_policy import FacePolicy, get_face_policy
from app.services.insightface_service import insightface_service

logger = logging.getLogger(__name__)

#: A second face larger than this fraction of the main face rejects the burst (§7 step 7).
MAX_SECONDARY_FACE_RATIO = 0.25
#: Liveness is averaged over up to this many best frontal frames (§7 step 10).
LIVENESS_FRAMES = 2

MESSAGES: dict[str, str] = {
    "too_many_attempts": "Too many failed face check-in attempts. Please wait before trying again.",
    "no_registered_face": "No registered face found. Please register your face first.",
    "subject_not_found": "That subject does not exist.",
    "presence_code_required": "Enter the check-in code shown in your classroom.",
    "presence_code_invalid": "That check-in code is not valid. Use the code currently shown in your classroom.",
    "challenge_required": "Start the camera again to get a new liveness challenge.",
    "challenge_invalid": "This liveness challenge is no longer valid. Please try again.",
    "invalid_frames": "The camera capture was incomplete. Please try again.",
    "no_face_detected": "No clear face was detected. Keep your face in view for the whole capture.",
    "multiple_faces": "More than one face is visible. Make sure only you are in the frame.",
    "low_quality": "The image quality was too low. Face the camera in good light and hold still.",
    "face_mismatch": "Your face could not be verified against your registered face.",
    "liveness_failed": "The head-turn check was not completed. Follow the on-screen prompt and try again.",
    "turned_too_far": "You turned your head too far. Turn it about halfway, keep your eyes on the screen, and try again.",
    "spoof_suspected": "Live-face verification failed. Use your real face in front of the camera, not a photo or screen.",
    "liveness_unavailable": "Face check-in is temporarily unavailable (liveness check not installed). Ask your teacher to record your attendance.",
    "already_recorded": "Attendance already recorded for this class",
    "internal_error": "Face check-in failed; please try again.",
}


def _msg(code: str) -> str:
    return MESSAGES.get(code, code.replace("_", " ").capitalize())


def _reject(code: str, message: Optional[str] = None, http_status: int = 200, **details: Any) -> DomainError:
    return DomainError(code, message or _msg(code), http_status=http_status, details=details)


# ============================================================================ results


@dataclass
class FaceCheckinResult:
    """Body of ``FaceCheckinResponse`` (legacy HTTP-200 contract; ``code`` = rejection)."""

    success: bool
    message: str
    student_id: Optional[int] = None
    attendance_marked: bool = False
    confidence_score: Optional[float] = 0.0  # 0.0 unless the result is a match (never leak scores)
    code: Optional[str] = None
    status: Optional[str] = None
    current_status: Optional[str] = None
    session_id: Optional[int] = None
    subject_id: Optional[int] = None
    window_state: Optional[str] = None
    opens_at: Optional[str] = None
    closes_at: Optional[str] = None
    quality_issues: Optional[list[str]] = None
    retry_after_seconds: Optional[int] = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class VerifyIdentityResult:
    """Body of the legacy ``verify-identity`` response."""

    matched: bool
    confidence_score: float
    message: str
    code: Optional[str] = None
    quality_issues: Optional[list[str]] = None
    retry_after_seconds: Optional[int] = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class _Attempt:
    """What the attempt row records; filled in as the steps run."""

    challenge_id: Optional[str] = None
    challenge_referenced: bool = False  # step 5 reached with an id: keep it single use
    session_id: Optional[int] = None
    similarity: Optional[float] = None
    liveness: Optional[float] = None
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class _FrameVerdict:
    best_similarity: float


# ============================================================================ helpers


def frame_list(frames: Optional[Sequence[str]], image_data: Optional[str]) -> list[str]:
    """``frames`` if given, else the legacy ``image_data`` as a one-frame burst."""
    if frames:
        return [f for f in frames]
    if image_data:
        return [image_data]
    return []


def _yaw(face: dict[str, Any]) -> float:
    yaw = face.get("yaw")
    return float(yaw) if yaw is not None else face_math.yaw_from_kps(face.get("kps"))


def _r(value: Optional[float], digits: int = 4) -> Optional[float]:
    return None if value is None else round(float(value), digits)


def _quality_issues(face: dict[str, Any], policy: FacePolicy) -> list[str]:
    return face_math.quality_issues(
        face,
        min_detection_score=policy.min_detection_score,
        min_face_size_px=policy.min_face_size_px,
        min_sharpness=policy.min_sharpness,
        min_brightness=policy.min_brightness,
        max_brightness=policy.max_brightness,
    )


def _frame_details(results: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    """Numeric per-frame measurements for ``details`` (no images, no embeddings)."""
    out = []
    for r in results:
        face = r.get("face") or {}
        out.append({
            "index": r.get("index"),
            "error": r.get("error"),
            "faces": r.get("faces_detected"),
            "yaw": _r(_yaw(face), 3) if face else None,
            "det_score": _r(face.get("det_score"), 3),
            "sharpness": _r(face.get("sharpness"), 1),
            "brightness": _r(face.get("brightness"), 1),
            "size": [_r(face.get("width"), 0), _r(face.get("height"), 0)] if face else None,
            "liveness": _r(r.get("liveness"), 3),
        })
    return out


async def _analyse_frames(db, *, student: Student, frames: list[str], policy: FacePolicy, head_turn: bool,
                          action: Optional[str], liveness: bool, attempt: _Attempt) -> _FrameVerdict:
    """§7 steps 6-10 (``head_turn``/``liveness`` False skip steps 9/10, as verify-identity does)."""
    # 6. frames
    frames_min = policy.frames_min if head_turn else 1
    attempt.details["frame_count"] = len(frames)
    if not (frames_min <= len(frames) <= policy.frames_max):
        raise _reject("invalid_frames",
                      f"Send between {frames_min} and {policy.frames_max} camera frames.",
                      frames_min=frames_min, frames_max=policy.frames_max)
    results = await insightface_service.aprocess_frames(frames, with_liveness=liveness)
    attempt.details["frames"] = _frame_details(results)

    # 7. quality
    usable = [r for r in results if r.get("ok") and r.get("face")]
    if not usable:
        raise _reject("no_face_detected")
    if any(int(r.get("faces_detected") or 0) > 1 and float(r.get("secondary_face_ratio") or 0.0) > MAX_SECONDARY_FACE_RATIO
           for r in results):
        raise _reject("multiple_faces")
    if len(usable) < frames_min:  # faceless frames are ignored only while enough usable ones remain
        raise _reject("no_face_detected")
    frontal = [r for r in usable if abs(_yaw(r["face"])) <= policy.frontal_max_yaw]
    if not frontal:
        if head_turn:
            attempt.details["quality_issues"] = ["not_frontal"]
            raise _reject("low_quality", "Look straight at the camera at the start of the capture.",
                          quality_issues=["not_frontal"])
        frontal = [min(usable, key=lambda r: abs(_yaw(r["face"])))]  # the most frontal frame
    issues = {r["index"]: _quality_issues(r["face"], policy) for r in frontal}
    good = [r for r in frontal if not issues[r["index"]]]
    if not good:
        found = sorted({i for r in frontal for i in issues[r["index"]]})
        attempt.details["quality_issues"] = found
        raise _reject("low_quality", quality_issues=found)

    # Near-profile frames (|yaw| > max_turn_yaw) are dropped: the detector and the embedding are
    # unreliable there, so they are evidence for nothing (identity, consistency or the turn).
    too_far = [r for r in usable if abs(_yaw(r["face"])) > policy.max_turn_yaw]
    if too_far:
        attempt.details["too_far_frames"] = [r["index"] for r in too_far]
        usable = [r for r in usable if r not in too_far]

    # 8. identity (1:1 against the student's own templates)
    templates = await face_store.load_templates(db, student, model_id=insightface_service.model_id)
    if not templates:
        raise _reject("no_registered_face")
    sims = {r["index"]: face_math.best_similarity(templates, r["face"]["embedding"]) for r in usable}
    best = max(good, key=lambda r: sims[r["index"]])
    best_sim = sims[best["index"]]
    attempt.similarity = best_sim
    attempt.details["best_frame"] = best["index"]
    attempt.details["similarities"] = [_r(sims[r["index"]]) for r in usable]
    if best_sim < policy.match_threshold:
        raise _reject("face_mismatch")
    # Same person throughout: every other face frame against the templates + the best frame.
    reference = templates + [best["face"]["embedding"]]
    consistency = [face_math.best_similarity(reference, r["face"]["embedding"]) for r in usable if r is not best]
    if consistency:
        attempt.details["consistency_min"] = _r(min(consistency))
        if min(consistency) < policy.consistency_threshold:
            raise _reject("face_mismatch")

    # 9. active head turn
    if head_turn:
        yaws = [_yaw(r["face"]) for r in usable]
        if action == ChallengeAction.turn_left:
            turned = any(y >= policy.head_turn_min_yaw for y in yaws)
        elif action == ChallengeAction.turn_right:
            turned = any(y <= -policy.head_turn_min_yaw for y in yaws)
        else:
            turned = False
        if not turned:
            sign = 1 if action == ChallengeAction.turn_left else -1
            if any(_yaw(r["face"]) * sign >= policy.head_turn_min_yaw for r in too_far):
                raise _reject("turned_too_far")  # turned the right way, just too far: not a failure
            raise _reject("liveness_failed")

    # 10. passive liveness (MiniFASNet)
    if liveness:
        if not getattr(insightface_service, "liveness_available", False):
            raise _reject("liveness_unavailable")
        top = sorted(good, key=lambda r: sims[r["index"]], reverse=True)[:LIVENESS_FRAMES]
        scores = [float(r["liveness"]) for r in top if r.get("liveness") is not None]
        if not scores:
            raise _reject("liveness_unavailable")
        mean = sum(scores) / len(scores)
        attempt.liveness = mean
        if mean < policy.antispoof_threshold:
            raise _reject("spoof_suspected")
    return _FrameVerdict(best_similarity=best_sim)


async def _not_enrolled_error(db, student: Student, *, subject_id: Optional[int],
                              session_id: Optional[int]) -> Optional[DomainError]:
    """Classify a ``no_session_today`` rejection: if the requested class belongs to another
    cohort, answer ``not_enrolled`` instead (the service only looks at the student's cohort)."""
    if session_id is not None:
        session = await db.get(ClassSession, session_id)
        if session is None:
            return None
        if (session.faculty_id, session.semester) != (student.faculty_id, student.semester):
            return DomainError("not_enrolled", "You are not enrolled in this class", http_status=403,
                               details={"session_id": session.id})
        return None
    if subject_id is not None:
        taught_to_cohort = (await db.execute(
            select(ClassSchedule.id).where(ClassSchedule.subject_id == subject_id,
                                           ClassSchedule.faculty_id == student.faculty_id,
                                           ClassSchedule.semester == student.semester).limit(1)
        )).first() is not None or (await db.execute(
            select(ClassSession.id).where(ClassSession.subject_id == subject_id,
                                          ClassSession.faculty_id == student.faculty_id,
                                          ClassSession.semester == student.semester).limit(1)
        )).first() is not None
        if not taught_to_cohort:
            return DomainError("not_enrolled", "You are not enrolled in this subject", http_status=403,
                               details={"subject_id": subject_id})
    return None


async def _existing_session_id(db, session_id: Optional[int]) -> Optional[int]:
    """``session_id`` if that class session exists (the attempt FK must never dangle)."""
    if session_id is None:
        return None
    found = (await db.execute(select(ClassSession.id).where(ClassSession.id == int(session_id)))).scalar()
    return int(found) if found is not None else None


async def _write_attempt(db, *, student_id: int, purpose: str, outcome: str, attempt: _Attempt, now: datetime,
                         ip_address: Optional[str], counts_as_failure: Optional[bool] = None,
                         requested_session_id: Optional[int] = None, challenge_purpose: Optional[str] = None) -> None:
    """Re-mark the challenge (after a rollback) and add the attempt row. Flushes only."""
    if attempt.challenge_referenced and attempt.challenge_id and challenge_purpose:
        await db.execute(
            update(FaceChallenge)
            .where(FaceChallenge.id == str(attempt.challenge_id),
                   FaceChallenge.student_id == student_id,
                   FaceChallenge.purpose == str(challenge_purpose),
                   FaceChallenge.used_at.is_(None))
            .values(used_at=now)
            .execution_options(synchronize_session=False)
        )
    # Re-check after a possible rollback: a session materialized by a rejected request is gone.
    session_id = await _existing_session_id(db, attempt.session_id)
    if session_id is None:
        session_id = await _existing_session_id(db, requested_session_id)
    await face_attempts.record_attempt(
        db, student_id=student_id, purpose=purpose, outcome=outcome, session_id=session_id,
        challenge_id=str(attempt.challenge_id)[:32] if attempt.challenge_id else None,
        similarity=attempt.similarity, liveness_score=attempt.liveness,
        details=attempt.details or None, ip_address=ip_address, counts_as_failure=counts_as_failure, now=now,
    )


async def _finish_rejection(db, *, student_id: int, purpose: str, err: DomainError, attempt: _Attempt, now: datetime,
                            ip_address: Optional[str], requested_session_id: Optional[int],
                            challenge_purpose: Optional[str], counts_as_failure: Optional[bool] = None) -> None:
    """Rollback the request's work, then commit the attempt (and the challenge consumption)."""
    await db.rollback()
    if attempt.session_id is None and err.details.get("session_id") is not None:
        attempt.session_id = err.details.get("session_id")
    if err.details.get("quality_issues"):
        attempt.details.setdefault("quality_issues", err.details["quality_issues"])
    if err.code not in ("too_many_attempts",) and err.message:
        attempt.details.setdefault("message", err.message)
    try:
        await _write_attempt(db, student_id=student_id, purpose=purpose, outcome=err.code, attempt=attempt, now=now,
                             ip_address=ip_address, counts_as_failure=counts_as_failure,
                             requested_session_id=requested_session_id, challenge_purpose=challenge_purpose)
        await db.commit()
    except Exception:  # never hide the business outcome behind an audit failure
        logger.exception("Could not record the face %s attempt of student %s", purpose, student_id)
        await db.rollback()


async def _record_internal_error(db, *, student_id: int, purpose: str, attempt: _Attempt, now: datetime,
                                 ip_address: Optional[str], requested_session_id: Optional[int],
                                 challenge_purpose: Optional[str]) -> None:
    try:
        await db.rollback()
        await _write_attempt(db, student_id=student_id, purpose=purpose, outcome="internal_error", attempt=attempt,
                             now=now, ip_address=ip_address, counts_as_failure=False,
                             requested_session_id=requested_session_id, challenge_purpose=challenge_purpose)
        await db.commit()
    except Exception:
        logger.exception("Could not record the failed face %s attempt of student %s", purpose, student_id)
        await db.rollback()


async def _lockout(db, *, student_id: int, policy: FacePolicy, now: datetime) -> None:
    locked, retry = await face_attempts.lockout_status(db, student_id=student_id, policy=policy, now=now)
    if locked:
        minutes = max(1, -(-int(retry or 60) // 60))
        raise _reject("too_many_attempts",
                      f"Too many failed face check-in attempts. Try again in {minutes} minute{'s' if minutes != 1 else ''}.",
                      retry_after_seconds=retry)


def _result_from_error(err: DomainError, student_id: int) -> FaceCheckinResult:
    d = err.details
    return FaceCheckinResult(
        success=False,
        message=err.message,
        code=err.code,
        attendance_marked=False,
        confidence_score=0.0,
        student_id=student_id,
        current_status=d.get("current_status"),
        session_id=d.get("session_id"),
        subject_id=d.get("subject_id"),
        window_state=d.get("window_state"),
        opens_at=d.get("opens_at"),
        closes_at=d.get("closes_at"),
        quality_issues=list(d["quality_issues"]) if d.get("quality_issues") else None,
        retry_after_seconds=d.get("retry_after_seconds"),
    )


# ============================================================================ check-in (§7)


async def run_face_checkin(
    db,
    *,
    student: Student,
    frames: Optional[Sequence[str]] = None,
    image_data: Optional[str] = None,
    challenge_id: Optional[str] = None,
    presence_code_value: Optional[str] = None,
    subject_id: Optional[int] = None,
    schedule_id: Optional[int] = None,
    session_id: Optional[int] = None,
    ip_address: Optional[str] = None,
) -> FaceCheckinResult:
    """Student self check-in with face verification (§7). Owns the transaction (see module doc).

    Business rejections are returned (``success=False`` + ``code``), never raised. Unexpected
    errors are logged as an ``internal_error`` attempt and re-raised.
    """
    student_id = student.id  # captured: a rollback expires the ORM instance
    now = app_now()
    attempt = _Attempt(challenge_id=challenge_id or None)
    attempt.details["request"] = {"subject_id": subject_id, "schedule_id": schedule_id, "session_id": session_id}
    finish = dict(student_id=student_id, purpose=AttemptPurpose.checkin, attempt=attempt, now=now,
                  ip_address=ip_address, requested_session_id=session_id, challenge_purpose=ChallengePurpose.checkin)
    try:
        policy = await get_face_policy(db)
        # 1. lock-out (logged, never counted as a failure itself)
        try:
            await _lockout(db, student_id=student_id, policy=policy, now=now)
        except DomainError as err:
            await _finish_rejection(db, err=err, counts_as_failure=False, **finish)
            return _result_from_error(err, student_id)

        try:
            # 2. registered face
            if not student.face_encoding:
                raise _reject("no_registered_face")

            # 3. session (existing attendance rules)
            if subject_id is not None:
                exists = (await db.execute(select(Subject.id).where(Subject.id == subject_id))).first()
                if exists is None:
                    raise _reject("subject_not_found", f"Subject with ID {subject_id} not found.", subject_id=subject_id)
            if student.faculty_id is None:
                raise _reject("not_enrolled", "You are not assigned to a faculty/semester; check-in is unavailable.")
            att_policy = await get_attendance_policy(db)
            try:
                session = await find_checkin_session(db, student=student, subject_id=subject_id,
                                                     schedule_id=schedule_id, session_id=session_id,
                                                     now=now, policy=att_policy)
            except DomainError as err:
                if err.code == "no_session_today":
                    err = await _not_enrolled_error(db, student, subject_id=subject_id, session_id=session_id) or err
                raise err
            attempt.session_id = session.id
            resolved_session_id, resolved_subject_id = session.id, session.subject_id
            # Persist on-demand materialization now (as GET /attendance/sessions does), so a
            # later rejection's rollback keeps the session and the attempt can reference it.
            await db.commit()

            # 4. proof of presence
            if policy.require_presence_code:
                code = (presence_code_value or "").strip()
                if not code:
                    raise _reject("presence_code_required", session_id=resolved_session_id)
                if not presence_code.verify_code(resolved_session_id, code, now, policy.presence_code_period_seconds):
                    raise _reject("presence_code_invalid", session_id=resolved_session_id)

            # 5. liveness challenge (consumed now, whatever the outcome)
            action = None
            if policy.require_head_turn:
                if not challenge_id:
                    raise _reject("challenge_required", session_id=resolved_session_id)
                attempt.challenge_referenced = True
                try:
                    challenge = await consume_challenge(db, student=student, challenge_id=challenge_id,
                                                        purpose=ChallengePurpose.checkin, now=now)
                except DomainError as err:
                    raise _reject(err.code, _msg(err.code), session_id=resolved_session_id)
                action = challenge.action
                attempt.details["action"] = action

            # 6-10. frames, quality, identity, head turn, passive liveness
            verdict = await _analyse_frames(
                db, student=student, frames=frame_list(frames, image_data), policy=policy,
                head_turn=policy.require_head_turn, action=action, liveness=policy.require_liveness, attempt=attempt)

            # 11. record (existing rules; already_recorded never overwrites)
            confidence = round(verdict.best_similarity * 100.0, 2)
            result = await student_self_checkin(db, student=student, session=session, confidence=confidence,
                                                method="face", now=now, policy=att_policy)
            marked = result.statuses.get(student_id)
            await _write_attempt(db, outcome="success", **finish)
            await db.commit()
        except DomainError as err:
            await _finish_rejection(db, err=err, **finish)
            return _result_from_error(err, student_id)
        except IntegrityError:
            # (student, session) is unique: a concurrent check-in won the race.
            err = _reject("already_recorded")
            await _finish_rejection(db, err=err, **finish)
            return _result_from_error(err, student_id)
    except Exception:
        await _record_internal_error(db, **finish)
        raise

    return FaceCheckinResult(
        success=True,
        message="Attendance marked successfully!" if marked == "present" else "Attendance marked as late.",
        student_id=student_id,
        confidence_score=confidence,
        attendance_marked=True,
        status=marked,
        current_status=marked,
        session_id=result.session_id or resolved_session_id,
        subject_id=resolved_subject_id,
    )


# ============================================================================ verify-identity (legacy)


async def run_verify_identity(db, *, student: Student, frames: Sequence[str],
                              ip_address: Optional[str] = None) -> VerifyIdentityResult:
    """Legacy identity check (§7 last paragraph): steps 1, 2, 6, 7 and 8, purpose ``verify``.

    No head turn or passive liveness is evaluated, so the burst may be a single image
    (``1..frames_max``) and the identity frame is the most frontal one. A mismatch counts as a
    failure; the score is returned only on a match. ``no_registered_face`` is raised as a
    ``DomainError`` (HTTP 400, as before); every other outcome is returned.
    """
    student_id = student.id
    now = app_now()
    attempt = _Attempt()
    finish = dict(student_id=student_id, purpose=AttemptPurpose.verify, attempt=attempt, now=now,
                  ip_address=ip_address, requested_session_id=None, challenge_purpose=None)
    try:
        policy = await get_face_policy(db)
        try:
            await _lockout(db, student_id=student_id, policy=policy, now=now)
        except DomainError as err:
            await _finish_rejection(db, err=err, counts_as_failure=False, **finish)
            return VerifyIdentityResult(matched=False, confidence_score=0.0, message=err.message, code=err.code,
                                        retry_after_seconds=err.details.get("retry_after_seconds"))
        try:
            if not student.face_encoding:
                raise _reject("no_registered_face", http_status=400)
            verdict = await _analyse_frames(db, student=student, frames=list(frames or []), policy=policy,
                                            head_turn=False, action=None, liveness=False, attempt=attempt)
            await _write_attempt(db, outcome="success", **finish)
            await db.commit()
        except DomainError as err:
            await _finish_rejection(db, err=err, **finish)
            if err.code == "no_registered_face":
                raise
            return VerifyIdentityResult(
                matched=False, confidence_score=0.0, message=err.message, code=err.code,
                quality_issues=list(err.details["quality_issues"]) if err.details.get("quality_issues") else None)
    except DomainError:
        raise
    except Exception:
        await _record_internal_error(db, **finish)
        raise
    return VerifyIdentityResult(matched=True, confidence_score=round(verdict.best_similarity * 100.0, 2),
                                message="Identity verified")


__all__ = [
    "FaceCheckinResult", "VerifyIdentityResult", "MAX_SECONDARY_FACE_RATIO", "frame_list",
    "run_face_checkin", "run_verify_identity",
]
