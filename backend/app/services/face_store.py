"""Shared persistence helpers for face verification (docs/system/face-verification.md §5, §8).

Used by both the enrolment service and the check-in service. Flushes only; the caller commits.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import delete, func, select

from app.models import FaceEnrollmentEvent, FaceTemplate, Student


async def load_templates(db, student: Student, *, model_id: str) -> list[list[float]]:
    """The student's matching set: the composite (``students.face_encoding``) plus every
    ``face_templates`` row produced by ``model_id``. Empty when the student isn't enrolled."""
    templates: list[list[float]] = []
    if student.face_encoding:
        templates.append(list(student.face_encoding))
    rows = (await db.execute(
        select(FaceTemplate.embedding).where(FaceTemplate.student_id == student.id, FaceTemplate.model == model_id)
    )).scalars().all()
    templates.extend(list(r) for r in rows if r)
    return templates


async def gallery(db, *, model_id: str, exclude_student_id: Optional[int] = None) -> list[tuple[int, list[float]]]:
    """``(student_id, embedding)`` for every enrolled student's composite and templates
    (1:N search: the enrolment duplicate check and the staff live-recognition tool)."""
    out: list[tuple[int, list[float]]] = []
    q = select(Student.id, Student.face_encoding).where(Student.face_encoding.isnot(None))
    if exclude_student_id is not None:
        q = q.where(Student.id != exclude_student_id)
    for sid, enc in (await db.execute(q)).all():
        if enc:
            out.append((sid, list(enc)))
    tq = select(FaceTemplate.student_id, FaceTemplate.embedding).where(FaceTemplate.model == model_id)
    if exclude_student_id is not None:
        tq = tq.where(FaceTemplate.student_id != exclude_student_id)
    for sid, emb in (await db.execute(tq)).all():
        if emb:
            out.append((sid, list(emb)))
    return out


async def template_summary(db, student_id: int) -> tuple[int, list[str]]:
    """``(count, poses)`` of the student's stored templates."""
    rows = (await db.execute(
        select(FaceTemplate.pose, func.count()).where(FaceTemplate.student_id == student_id).group_by(FaceTemplate.pose)
    )).all()
    return sum(int(n) for _, n in rows), sorted(p for p, _ in rows)


async def clear_face_data(db, student: Student, *, new_status: str) -> int:
    """Delete templates, null the composite and set ``face_enrollment_status``. Returns the
    number of templates deleted. Consent and registration timestamps are cleared too."""
    result = await db.execute(delete(FaceTemplate).where(FaceTemplate.student_id == student.id))
    student.face_encoding = None
    student.face_enrollment_status = new_status
    student.face_registered_at = None
    student.face_model = None
    student.face_consent_at = None
    await db.flush()
    return int(result.rowcount or 0)


def add_enrollment_event(db, *, student_id: int, action: str, actor_user_id: Optional[int],
                         reason: Optional[str] = None, details: Optional[dict[str, Any]] = None,
                         at: Optional[datetime] = None) -> FaceEnrollmentEvent:
    event = FaceEnrollmentEvent(student_id=student_id, action=str(action), actor_user_id=actor_user_id,
                                reason=reason, details=details)
    if at is not None:
        event.created_at = at
    db.add(event)
    return event


def face_fields(student: Student) -> dict[str, Any]:
    """Public enrolment fields for student payloads (``face_encoding`` is never exposed)."""
    return {
        "face_encoding": None,
        "face_registered": student.face_encoding is not None,
        "face_registered_at": student.face_registered_at.isoformat() if getattr(student, "face_registered_at", None) else None,
        "face_enrollment_status": getattr(student, "face_enrollment_status", None) or "none",
    }
