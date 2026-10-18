"""Face verification tables (docs/system/face-verification.md §5).

Created by alembic revision ``p20261018_face_verification``; keep these models in sync
with it. Value columns are VARCHAR + CHECK (like ``attendance_sessions``), so the
``StrEnum`` members compare equal to the raw column values.

Biometric rows belong to the student: their FKs to ``students`` CASCADE (unlike
attendance, which is a legal record and uses RESTRICT).
"""
import enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class FaceEnrollmentStatus(enum.StrEnum):
    none = "none"          # never enrolled -> may enrol
    enrolled = "enrolled"  # has templates -> may not enrol (already_enrolled)
    reset = "reset"        # admin reset -> may enrol
    deleted = "deleted"    # student deleted their data -> needs an admin reset (enrolment_locked)


class FacePose(enum.StrEnum):
    front = "front"
    left = "left"
    right = "right"


class ChallengePurpose(enum.StrEnum):
    checkin = "checkin"
    enrolment = "enrolment"


class ChallengeAction(enum.StrEnum):
    turn_left = "turn_left"
    turn_right = "turn_right"
    front_left_right = "front_left_right"


class AttemptPurpose(enum.StrEnum):
    checkin = "checkin"
    verify = "verify"
    enrolment = "enrolment"


class EnrollmentEventAction(enum.StrEnum):
    enrolled = "enrolled"
    reset = "reset"
    deleted = "deleted"
    duplicate_blocked = "duplicate_blocked"
    spoof_blocked = "spoof_blocked"


ENROLLMENT_STATUSES_ALLOWING_ENROLMENT = frozenset({FaceEnrollmentStatus.none, FaceEnrollmentStatus.reset})


def _in_check(column: str, values) -> str:
    return f"{column} IN ({', '.join(repr(str(v)) for v in values)})"


class FaceTemplate(Base):
    """One enrolment embedding (per valid enrolment frame)."""

    __tablename__ = "face_templates"

    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE", name="fk_face_templates_student"), nullable=False)
    model = Column(String(64), nullable=False)
    pose = Column(String(16), nullable=False)
    embedding = Column(JSONB, nullable=False)
    quality = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    student = relationship("Student", foreign_keys=[student_id])

    __table_args__ = (
        CheckConstraint(_in_check("pose", FacePose), name="ck_face_templates_pose"),
        Index("ix_face_templates_student", "student_id"),
    )


class FaceChallenge(Base):
    """Single-use liveness challenge (§6)."""

    __tablename__ = "face_challenges"

    id = Column(String(32), primary_key=True)  # uuid4 hex
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE", name="fk_face_challenges_student"), nullable=False)
    purpose = Column(String(16), nullable=False)
    action = Column(String(24), nullable=False)
    session_id = Column(Integer, ForeignKey("class_sessions.id", ondelete="SET NULL", name="fk_face_challenges_session"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(_in_check("purpose", ChallengePurpose), name="ck_face_challenges_purpose"),
        CheckConstraint(_in_check("action", ChallengeAction), name="ck_face_challenges_action"),
        Index("ix_face_challenges_student_created", "student_id", "created_at"),
    )


class FaceVerificationAttempt(Base):
    """One face check-in / verify / enrolment attempt and its outcome (§7)."""

    __tablename__ = "face_verification_attempts"

    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE", name="fk_face_attempts_student"), nullable=False)
    session_id = Column(Integer, ForeignKey("class_sessions.id", ondelete="SET NULL", name="fk_face_attempts_session"), nullable=True)
    challenge_id = Column(String(32), nullable=True)
    purpose = Column(String(16), nullable=False)
    outcome = Column(String(32), nullable=False)
    counts_as_failure = Column(Boolean, nullable=False, default=False)
    similarity = Column(Numeric(6, 4), nullable=True)
    liveness_score = Column(Numeric(6, 4), nullable=True)
    details = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(_in_check("purpose", AttemptPurpose), name="ck_face_attempts_purpose"),
        Index("ix_face_attempts_student_created", "student_id", "created_at"),
        Index("ix_face_attempts_session", "session_id"),
    )


class FaceEnrollmentEvent(Base):
    """Audit trail of enrolment, reset, deletion and blocked enrolments (§8)."""

    __tablename__ = "face_enrollment_events"

    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE", name="fk_face_events_student"), nullable=False)
    action = Column(String(24), nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL", name="fk_face_events_actor"), nullable=True)
    reason = Column(Text, nullable=True)
    details = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    actor = relationship("User", foreign_keys=[actor_user_id])

    __table_args__ = (
        CheckConstraint(_in_check("action", EnrollmentEventAction), name="ck_face_events_action"),
        Index("ix_face_events_student_created", "student_id", "created_at"),
    )
