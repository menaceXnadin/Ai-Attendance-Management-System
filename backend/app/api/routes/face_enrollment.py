"""Face enrolment endpoints (docs/system/face-verification.md §8).

Same ``/face-recognition`` prefix as ``face_recognition.py``; included in ``main.py`` right
after it. Business logic lives in ``app.services.face_enrollment``; these handlers only parse
the body, own the transaction and translate errors (``{"detail": {code, message, details}}``).

A rejected enrolment is rolled back, then its audit trail (attempt row, ``spoof_blocked`` /
``duplicate_blocked`` event, challenge ``used_at``) is written and committed before the error
is returned.
"""
import logging
from typing import List, Optional, Union

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_student, require_face_engine
from app.core.database import get_db
from app.models import Student
from app.services import face_enrollment
from app.services.domain_errors import DomainError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/face-recognition", tags=["face-enrollment"])


class FaceEnrollmentRequest(BaseModel):
    images: List[str] = Field(default_factory=list, description="Base64 JPEG frames (front, left, right)")
    consent: Optional[bool] = None  # must be true; anything else -> 400 consent_required
    challenge_id: Optional[str] = None


class LegacyFaceEnrollmentRequest(FaceEnrollmentRequest):
    image_data: Optional[Union[str, List[str]]] = Field(
        default=None, description="Legacy: one base64 image or a list; used when `images` is empty")


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


async def _enroll(request: Request, db: AsyncSession, student: Student, *, images: List[str],
                  consent: Optional[bool], challenge_id: Optional[str]) -> dict:
    try:
        result = await face_enrollment.enroll(
            db, student=student, images=images, consent=consent, challenge_id=challenge_id,
            actor_user_id=student.user_id, ip=_client_ip(request),
        )
        await db.commit()
        return result
    except DomainError as err:
        await db.rollback()
        audit = getattr(err, "audit", None)
        if audit is not None:
            try:
                await face_enrollment.record_rejection(db, audit)
                await db.commit()
            except Exception:  # never hide the business error behind an audit failure
                logger.exception("Could not record the rejected face enrolment for student %s", audit.student_id)
                await db.rollback()
        raise err.to_http_exception()
    except Exception:
        await db.rollback()
        raise


@router.get("/enrollment")
async def get_enrollment_status(
    current_student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """The logged-in student's enrolment state: ``{status, can_enroll, registered_at, model,
    template_count, consent_at, message}``."""
    return await face_enrollment.enrollment_status(db, current_student)


@router.post("/register-face-multi", dependencies=[Depends(require_face_engine)])
async def register_face_multi(
    body: FaceEnrollmentRequest,
    request: Request,
    current_student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Enrol the logged-in student's face from a guided front/left/right burst (§8)."""
    return await _enroll(request, db, current_student, images=body.images, consent=body.consent,
                         challenge_id=body.challenge_id)


@router.post("/register-face", dependencies=[Depends(require_face_engine)])
async def register_face(
    body: LegacyFaceEnrollmentRequest,
    request: Request,
    current_student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Same as ``register-face-multi``; also accepts the legacy ``image_data`` (string or list)."""
    images = list(body.images)
    if not images and body.image_data is not None:
        images = [body.image_data] if isinstance(body.image_data, str) else list(body.image_data)
    return await _enroll(request, db, current_student, images=images, consent=body.consent,
                         challenge_id=body.challenge_id)


@router.delete("/my-face")
async def delete_my_face(
    current_student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Delete the logged-in student's face templates; re-enrolment then needs an admin reset."""
    try:
        result = await face_enrollment.delete_own_face(db, student=current_student,
                                                       actor_user_id=current_student.user_id)
        await db.commit()
        return result
    except DomainError as err:
        await db.rollback()
        raise err.to_http_exception()
    except Exception:
        await db.rollback()
        raise
