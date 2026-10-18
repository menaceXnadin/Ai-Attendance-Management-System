"""Face check-in, challenge, policy, verification and diagnostics endpoints
(docs/system/face-verification.md §6, §7).

Enrolment endpoints (``/register-face``, ``/register-face-multi``, ``/enrollment``,
``/my-face``) live in ``face_enrollment.py`` under the same prefix.

* Check-in orchestration lives in ``app.services.face_verification`` (it owns the request's
  transaction and writes one attempt row per request).
* Model access goes only through ``insightface_service.aprocess_frames`` (worker thread);
  thresholds come only from ``FacePolicy``.
* Students never see similarity scores on failure.
"""
import logging
from typing import Any, List, Optional, Union

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_student, get_current_user, require_admin_or_teacher, require_face_engine
from app.core.database import get_db
from app.models import AttendanceRecord, ChallengePurpose, ClassSession, Student, User
from app.schemas import AttendanceRecord as AttendanceRecordSchema
from app.schemas import FaceRecognitionResponse
from app.services import face_math, face_store
from app.services.domain_errors import DomainError, not_found
from app.services.face_challenges import challenge_payload, create_challenge
from app.services.face_policy import FacePolicy, get_face_policy
from app.services.face_verification import (
    MAX_SECONDARY_FACE_RATIO,
    frame_list,
    run_face_checkin,
    run_verify_identity,
)
from app.services.insightface_service import insightface_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/face-recognition", tags=["face-recognition"])


# ============================================================================ schemas


class FaceCheckinRequest(BaseModel):
    """Self check-in (§7). Send ``frames`` (the captured burst, unmirrored base64 JPEGs); the
    legacy ``image_data`` is treated as ``frames=[image_data]``. ``subject_id`` /
    ``session_id`` / ``schedule_id`` optionally pin the class; with none of them the server
    picks the student's session whose check-in window is open now."""
    frames: Optional[List[str]] = None
    image_data: Optional[str] = None  # legacy single image
    challenge_id: Optional[str] = Field(default=None, max_length=64)
    presence_code: Optional[str] = Field(default=None, max_length=32)
    subject_id: Optional[int] = None
    session_id: Optional[int] = None
    schedule_id: Optional[int] = None


class FaceCheckinResponse(FaceRecognitionResponse):
    """Legacy ``FaceRecognitionResponse`` fields + the check-in contract (HTTP 200 always for
    business-rule outcomes; ``code`` identifies a rejection)."""
    code: Optional[str] = None
    status: Optional[str] = None  # present | late (only when attendance_marked)
    current_status: Optional[str] = None  # existing record status for already_recorded
    session_id: Optional[int] = None
    subject_id: Optional[int] = None
    window_state: Optional[str] = None  # not_open | closed (window_closed rejections)
    opens_at: Optional[str] = None
    closes_at: Optional[str] = None
    quality_issues: Optional[List[str]] = None  # low_quality rejections
    retry_after_seconds: Optional[int] = None  # too_many_attempts rejections


class FaceChallengeRequest(BaseModel):
    purpose: str
    session_id: Optional[int] = None
    subject_id: Optional[int] = None
    schedule_id: Optional[int] = None


class FaceImageRequest(BaseModel):
    """One image (a list is accepted for compatibility; its first item is used)."""
    image_data: Union[str, List[str]]


class VerifyIdentityRequest(BaseModel):
    image_data: Optional[Union[str, List[str]]] = None
    frames: Optional[List[str]] = None


class LiveRecognitionRequest(BaseModel):
    image_data: str  # Base64 encoded image


class LiveRecognitionResponse(BaseModel):
    success: bool
    message: str
    student_recognized: Optional[bool] = None
    student_name: Optional[str] = None
    student_id: Optional[int] = None
    confidence_score: Optional[float] = None
    faces_detected: int
    recognition_quality: Optional[str] = None


# ============================================================================ helpers

QUALITY_FEEDBACK = {
    "too_dark": "Improve the lighting on your face",
    "too_bright": "Avoid strong light or glare on your face",
    "too_blurry": "Hold still and keep the camera steady",
    "too_small": "Move closer to the camera",
    "low_confidence": "Face the camera with your whole face visible",
    "not_frontal": "Look straight at the camera",
}


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _first_image(image_data: Union[str, List[str], None]) -> Optional[str]:
    if isinstance(image_data, list):
        return image_data[0] if image_data else None
    return image_data or None


def _quality_issues(face: dict, policy: FacePolicy) -> list[str]:
    return face_math.quality_issues(
        face,
        min_detection_score=policy.min_detection_score,
        min_face_size_px=policy.min_face_size_px,
        min_sharpness=policy.min_sharpness,
        min_brightness=policy.min_brightness,
        max_brightness=policy.max_brightness,
    )


def _has_multiple_faces(frame: dict) -> bool:
    return int(frame.get("faces_detected") or 0) > 1 and float(frame.get("secondary_face_ratio") or 0.0) > MAX_SECONDARY_FACE_RATIO


async def _analyse_single(image: Optional[str], policy: FacePolicy) -> dict[str, Any]:
    """Quality feedback for one image: ``{state, frame, face, issues, area_percentage, feedback}``.

    ``state`` is ``invalid_image`` | ``no_face`` | ``multiple_faces`` | ``ok``.
    """
    if not image:
        return {"state": "invalid_image", "frame": None, "face": None, "issues": [], "feedback": []}
    results = await insightface_service.aprocess_frames([image], with_liveness=False)
    frame = results[0] if results else {"ok": False, "error": "invalid_image", "faces_detected": 0}
    if frame.get("error") == "invalid_image":
        return {"state": "invalid_image", "frame": frame, "face": None, "issues": [], "feedback": []}
    face = frame.get("face")
    if not frame.get("ok") or not face:
        return {"state": "no_face", "frame": frame, "face": None, "issues": [], "feedback": []}
    if _has_multiple_faces(frame):
        return {"state": "multiple_faces", "frame": frame, "face": face, "issues": [], "feedback": []}
    issues = _quality_issues(face, policy)
    area_pct = float(face.get("area_ratio") or 0.0) * 100.0
    feedback = [QUALITY_FEEDBACK[i] for i in issues if i in QUALITY_FEEDBACK]
    if area_pct > 60:
        feedback.append("Move back from the camera")
    return {"state": "ok", "frame": frame, "face": face, "issues": issues, "area_percentage": area_pct,
            "feedback": feedback}


def _face_box(face: dict, area_pct: float) -> dict[str, Any]:
    return {
        "bbox": face.get("bbox"),
        "confidence": face.get("det_score", face.get("confidence")),
        "width": face.get("width"),
        "height": face.get("height"),
        "area_percentage": round(area_pct, 2),
    }


# ============================================================================ check-in (§7)


@router.post("/mark-attendance", response_model=FaceCheckinResponse, dependencies=[Depends(require_face_engine)])
async def mark_attendance_with_face(
    recognition_data: FaceCheckinRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """Student self check-in with face verification (face-verification.md §7; DOMAIN_RULES
    §13.9). Order: lock-out, registered face, session, presence code, challenge, frames,
    quality, identity, head turn, passive liveness, record. Business-rule rejections are HTTP
    200 with ``success: false`` and a ``code``."""
    try:
        result = await run_face_checkin(
            db,
            student=current_student,
            frames=recognition_data.frames,
            image_data=recognition_data.image_data,
            challenge_id=recognition_data.challenge_id,
            presence_code_value=recognition_data.presence_code,
            subject_id=recognition_data.subject_id,
            schedule_id=recognition_data.schedule_id,
            session_id=recognition_data.session_id,
            ip_address=_client_ip(request),
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Face check-in failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "internal_error", "message": "Error processing face check-in; please try again"},
        )
    return FaceCheckinResponse(**result.as_dict())


@router.post("/challenge")
async def create_face_challenge(
    body: FaceChallengeRequest,
    db: AsyncSession = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """Single-use liveness challenge (§6). ``purpose``: ``checkin`` (action ``turn_left`` /
    ``turn_right``) or ``enrolment`` (``front_left_right``). A check-in challenge needs a
    registered face (409 ``no_registered_face``)."""
    purpose = (body.purpose or "").strip().lower()
    try:
        policy = await get_face_policy(db)
        if purpose not in (ChallengePurpose.checkin, ChallengePurpose.enrolment):
            raise DomainError("invalid_purpose", "purpose must be 'checkin' or 'enrolment'", http_status=400)
        if purpose == ChallengePurpose.checkin and not current_student.face_encoding:
            raise DomainError("no_registered_face", "No registered face found. Please register your face first.",
                              http_status=409)
        session_id = None
        if body.session_id is not None:
            found = (await db.execute(select(ClassSession.id).where(ClassSession.id == body.session_id))).scalar()
            if found is None:
                raise not_found("session", session_id=body.session_id)
            session_id = int(found)
        challenge = await create_challenge(db, student=current_student, purpose=purpose, policy=policy,
                                           session_id=session_id)
        payload = challenge_payload(challenge, policy)
        await db.commit()
    except DomainError as err:
        await db.rollback()
        raise err.to_http_exception()
    return payload


@router.get("/policy")
async def get_public_face_policy(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Public subset of the face verification policy (what the UI must collect)."""
    return (await get_face_policy(db)).public_dict()


@router.post("/verify-identity", dependencies=[Depends(require_face_engine)])
async def verify_identity(
    body: VerifyIdentityRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """Legacy: does the image match the logged-in student? (§7: lock-out, registered face,
    frames, quality, identity; logged with purpose ``verify``). ``confidence_score`` is 0.0
    unless matched. No registered face -> 400 ``no_registered_face``."""
    image = body.image_data
    frames = frame_list(body.frames, None) or ([image] if isinstance(image, str) and image else list(image or []))
    try:
        result = await run_verify_identity(db, student=current_student, frames=frames, ip_address=_client_ip(request))
    except DomainError as err:
        raise err.to_http_exception()
    except HTTPException:
        raise
    except Exception:
        logger.exception("Identity verification failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail={"code": "internal_error", "message": "Error verifying identity"})
    return result.as_dict()


# ============================================================================ student records


@router.get("/my-attendance", response_model=List[AttendanceRecordSchema])
async def get_my_attendance(
    current_student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """Get current student's attendance records."""
    result = await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.student_id == current_student.id)
        .order_by(AttendanceRecord.date.desc())
        .limit(50)
    )

    attendance_records = result.scalars().all()
    return [AttendanceRecordSchema.from_orm(record) for record in attendance_records]


# ============================================================================ quality feedback


@router.post("/verify-face", dependencies=[Depends(require_face_engine)])
async def verify_face_image(
    request: FaceImageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Quality feedback for one image (no matching, nothing stored)."""
    policy = await get_face_policy(db)
    try:
        a = await _analyse_single(_first_image(request.image_data), policy)
    except Exception:
        logger.exception("verify-face failed")
        return {"valid": False, "faces_detected": 0, "message": "Error processing image",
                "feedback": "Try capturing a new image", "quality_issues": []}
    frame = a["frame"] or {}
    if a["state"] == "invalid_image":
        return {"valid": False, "faces_detected": 0, "message": "The image could not be read.",
                "feedback": "Try capturing a new image", "quality_issues": []}
    if a["state"] == "no_face":
        return {"valid": False, "faces_detected": 0,
                "message": "No face detected in the image. Please ensure your face is clearly visible.",
                "feedback": "Move closer to camera or improve lighting", "quality_issues": []}
    faces = int(frame.get("faces_detected") or 1)
    if a["state"] == "multiple_faces":
        return {"valid": False, "faces_detected": faces,
                "message": f"Multiple faces detected ({faces}). Please ensure only one person is visible.",
                "feedback": "Multiple people detected - ensure only you are visible", "quality_issues": []}
    valid = not a["issues"]
    feedback = a["feedback"] or (["Perfect! Ready for verification"] if valid else [])
    return {
        "valid": valid,
        "faces_detected": faces,
        "message": "Face quality is good" if valid else "Face quality is too low: " + ", ".join(a["issues"]),
        "face": _face_box(a["face"], a["area_percentage"]),
        "feedback": " • ".join(feedback),
        "quality_issues": a["issues"],
    }


@router.post("/detect-faces", dependencies=[Depends(require_face_engine)])
async def detect_faces_in_image(
    request: FaceImageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Real-time detection feedback for one image (no matching, nothing stored)."""
    policy = await get_face_policy(db)
    base = {"faces": [], "ready_for_capture": False, "quality_issues": []}
    try:
        a = await _analyse_single(_first_image(request.image_data), policy)
    except Exception:
        logger.exception("detect-faces failed")
        return {**base, "success": False, "message": "Error analyzing face", "faces_detected": 0,
                "feedback": "Error occurred during analysis"}
    frame = a["frame"] or {}
    if a["state"] == "invalid_image":
        return {**base, "success": False, "message": "The image could not be read.", "faces_detected": 0,
                "feedback": "Try capturing a new image"}
    if a["state"] == "no_face":
        return {**base, "success": False, "message": "No face detected. Please ensure your face is visible and well-lit.",
                "faces_detected": 0, "feedback": "Move closer to camera or improve lighting"}
    faces = int(frame.get("faces_detected") or 1)
    face = a["face"]
    if a["state"] == "multiple_faces":
        area_pct = float(face.get("area_ratio") or 0.0) * 100.0
        return {**base, "success": False,
                "message": f"Multiple faces detected ({faces}). Please ensure only one person is visible.",
                "faces_detected": faces, "faces": [_face_box(face, area_pct)],
                "feedback": "Multiple people detected - ensure only you are visible"}
    valid = not a["issues"]
    feedback = a["feedback"] or (["Perfect! Ready for capture"] if valid else [])
    return {
        "success": valid,
        "message": "Face detected" if valid else "Face quality is too low: " + ", ".join(a["issues"]),
        "faces_detected": faces,
        "faces": [_face_box(face, a["area_percentage"])],
        "feedback": " • ".join(feedback),
        "ready_for_capture": valid,
        "quality_issues": a["issues"],
    }


# ============================================================================ staff 1:N tool


def _recognition_quality(similarity: float, threshold: float) -> str:
    if similarity >= threshold + 0.25:
        return "excellent"
    if similarity >= threshold + 0.10:
        return "good"
    return "fair"


@router.post("/live-recognition", response_model=LiveRecognitionResponse, dependencies=[Depends(require_face_engine)])
async def live_face_recognition(
    request: LiveRecognitionRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin_or_teacher),
):
    """Staff tool: who is this? 1:N search over every active enrolled student's templates;
    a match needs ``policy.match_threshold``."""
    policy = await get_face_policy(db)
    try:
        a = await _analyse_single(request.image_data, policy)
    except Exception:
        logger.exception("live-recognition failed")
        return LiveRecognitionResponse(success=False, message="Error during recognition", student_recognized=False,
                                       faces_detected=0, recognition_quality="error")
    frame = a["frame"] or {}
    if a["state"] in ("invalid_image", "no_face"):
        return LiveRecognitionResponse(success=False, message="No face detected", student_recognized=False,
                                       faces_detected=0, recognition_quality="poor")
    faces = int(frame.get("faces_detected") or 1)
    if a["state"] == "multiple_faces":
        return LiveRecognitionResponse(success=False, message=f"Multiple faces detected ({faces})",
                                       student_recognized=False, faces_detected=faces,
                                       recognition_quality="multiple_faces")
    if a["issues"]:
        return LiveRecognitionResponse(success=False, message="Face not clear enough for recognition: " + ", ".join(a["issues"]),
                                       student_recognized=False, faces_detected=faces, recognition_quality="poor")

    probe = np.asarray(a["face"]["embedding"], dtype=np.float64).reshape(-1)
    entries = [(sid, emb) for sid, emb in await face_store.gallery(db, model_id=insightface_service.model_id)
               if emb is not None and len(emb) == probe.size]
    active = {}
    if entries:
        active = {
            sid: name for sid, name in (await db.execute(
                select(Student.id, User.full_name).join(User, Student.user_id == User.id)
                .where(Student.id.in_({sid for sid, _ in entries}), User.is_active.is_(True))
            )).all()
        }
        entries = [(sid, emb) for sid, emb in entries if sid in active]
    if not entries:
        return LiveRecognitionResponse(success=False, message="No registered students found", student_recognized=False,
                                       faces_detected=faces, recognition_quality="no_database")

    matrix = np.asarray([emb for _, emb in entries], dtype=np.float64)
    norms = np.linalg.norm(matrix, axis=1)
    norms[norms == 0] = 1.0
    probe_norm = float(np.linalg.norm(probe)) or 1.0
    sims = (matrix @ probe) / (norms * probe_norm)
    best = int(np.argmax(sims))
    best_sim = float(sims[best])
    best_student = entries[best][0]
    if best_sim >= policy.match_threshold:
        name = active.get(best_student)
        return LiveRecognitionResponse(
            success=True,
            message=f"Recognized: {name}",
            student_recognized=True,
            student_name=name,
            student_id=best_student,
            confidence_score=round(best_sim * 100.0, 2),
            faces_detected=faces,
            recognition_quality=_recognition_quality(best_sim, policy.match_threshold),
        )
    return LiveRecognitionResponse(success=False, message="Face not recognized", student_recognized=False,
                                   faces_detected=faces, recognition_quality="unrecognized")


# ============================================================================ diagnostics


@router.get("/service-status")
async def get_face_recognition_service_status(db: AsyncSession = Depends(get_db)):
    """Engine status: model id, whether the anti-spoof models are loaded, and the public policy."""
    try:
        model_info = insightface_service.get_model_info()
    except Exception as exc:  # the engine failed to initialise
        logger.warning("Face engine status check failed: %s", exc)
        return {"status": "error", "message": "Face recognition engine is not available", "service": "insightface",
                "model_id": getattr(insightface_service, "model_id", None), "liveness_available": False,
                "models": {}, "policy": None}
    try:
        policy = (await get_face_policy(db)).public_dict()
    except Exception:
        logger.warning("Could not load the face verification policy", exc_info=True)
        policy = None
    liveness = bool(getattr(insightface_service, "liveness_available", False))
    return {
        "status": "active",
        "message": "Face recognition engine is running" + ("" if liveness else " (liveness models not installed)"),
        "service": "insightface",
        "model_id": getattr(insightface_service, "model_id", None),
        "liveness_available": liveness,
        "models": model_info,
        "policy": policy,
    }
