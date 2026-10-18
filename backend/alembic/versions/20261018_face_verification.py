"""Face verification: templates, liveness challenges, attempts log, enrolment state.

Implements docs/system/face-verification.md §5.

Upgrade
  1. students: face_enrollment_status (none|enrolled|reset|deleted, default 'none'),
     face_registered_at, face_model, face_consent_at. Students that already have a
     face_encoding become 'enrolled' with face_model 'insightface/buffalo_l'.
  2. Tables face_templates, face_challenges, face_verification_attempts,
     face_enrollment_events (FKs to students CASCADE).
  3. Insert system_settings 'face_verification' defaults if the key is absent.

Downgrade
  Drops the tables and columns. The 'face_verification' setting is kept.

Revision ID: p20261018_face_verification
Revises: o20261018_class_sessions
Create Date: 2026-10-18
"""
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'p20261018_face_verification'
down_revision = 'o20261018_class_sessions'
branch_labels = None
depends_on = None

FACE_MODEL_ID = "insightface/buffalo_l"

# Mirrors app.services.face_policy defaults (docs/system/face-verification.md §4).
FACE_POLICY_DEFAULTS = {
    "match_threshold": 0.45,
    "consistency_threshold": 0.30,
    "duplicate_threshold": 0.45,
    "require_liveness": True,
    "antispoof_threshold": 0.70,
    "require_head_turn": True,
    "head_turn_min_yaw": 0.18,
    "frontal_max_yaw": 0.12,
    "challenge_ttl_seconds": 90,
    "frames_min": 3,
    "frames_max": 8,
    "require_presence_code": True,
    "presence_code_period_seconds": 30,
    "max_failed_attempts": 5,
    "failed_attempt_window_minutes": 10,
    "min_detection_score": 0.60,
    "enrolment_min_detection_score": 0.70,
    "min_face_size_px": 80,
    "min_sharpness": 20.0,
    "min_brightness": 40,
    "max_brightness": 220,
    "enrolment_min_images": 3,
}


def upgrade() -> None:
    # 1. students enrolment state
    op.add_column("students", sa.Column("face_enrollment_status", sa.String(16), nullable=False, server_default=sa.text("'none'")))
    op.add_column("students", sa.Column("face_registered_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("students", sa.Column("face_model", sa.String(64), nullable=True))
    op.add_column("students", sa.Column("face_consent_at", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint(
        "ck_students_face_enrollment_status", "students",
        "face_enrollment_status IN ('none', 'enrolled', 'reset', 'deleted')",
    )
    # JSON 'null' written by older code is not an enrolment: normalise it to SQL NULL first.
    op.execute("UPDATE students SET face_encoding = NULL WHERE face_encoding IS NOT NULL AND face_encoding::text = 'null'")
    op.execute(
        sa.text(
            "UPDATE students SET face_enrollment_status = 'enrolled', face_model = :model, "
            "face_registered_at = COALESCE(updated_at, created_at, now()) "
            "WHERE face_encoding IS NOT NULL"
        ).bindparams(model=FACE_MODEL_ID)
    )

    # 2. tables
    op.create_table(
        "face_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE", name="fk_face_templates_student"), nullable=False),
        sa.Column("model", sa.String(64), nullable=False),
        sa.Column("pose", sa.String(16), nullable=False),
        sa.Column("embedding", postgresql.JSONB(), nullable=False),
        sa.Column("quality", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("pose IN ('front', 'left', 'right')", name="ck_face_templates_pose"),
    )
    op.create_index("ix_face_templates_student", "face_templates", ["student_id"])

    op.create_table(
        "face_challenges",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE", name="fk_face_challenges_student"), nullable=False),
        sa.Column("purpose", sa.String(16), nullable=False),
        sa.Column("action", sa.String(24), nullable=False),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("class_sessions.id", ondelete="SET NULL", name="fk_face_challenges_session"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("purpose IN ('checkin', 'enrolment')", name="ck_face_challenges_purpose"),
        sa.CheckConstraint("action IN ('turn_left', 'turn_right', 'front_left_right')", name="ck_face_challenges_action"),
    )
    op.create_index("ix_face_challenges_student_created", "face_challenges", ["student_id", "created_at"])

    op.create_table(
        "face_verification_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE", name="fk_face_attempts_student"), nullable=False),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("class_sessions.id", ondelete="SET NULL", name="fk_face_attempts_session"), nullable=True),
        sa.Column("challenge_id", sa.String(32), nullable=True),
        sa.Column("purpose", sa.String(16), nullable=False),
        sa.Column("outcome", sa.String(32), nullable=False),
        sa.Column("counts_as_failure", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("similarity", sa.Numeric(6, 4), nullable=True),
        sa.Column("liveness_score", sa.Numeric(6, 4), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("purpose IN ('checkin', 'verify', 'enrolment')", name="ck_face_attempts_purpose"),
    )
    op.create_index("ix_face_attempts_student_created", "face_verification_attempts", ["student_id", "created_at"])
    op.create_index("ix_face_attempts_session", "face_verification_attempts", ["session_id"])

    op.create_table(
        "face_enrollment_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE", name="fk_face_events_student"), nullable=False),
        sa.Column("action", sa.String(24), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_face_events_actor"), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "action IN ('enrolled', 'reset', 'deleted', 'duplicate_blocked', 'spoof_blocked')",
            name="ck_face_events_action",
        ),
    )
    op.create_index("ix_face_events_student_created", "face_enrollment_events", ["student_id", "created_at"])

    # 3. policy defaults (only when absent; never overwrite an admin's values)
    op.execute(
        sa.text(
            "INSERT INTO system_settings (key, value, category, description, data_type, is_active) "
            "SELECT 'face_verification', CAST(:value AS json), 'security', "
            "'Face verification, liveness and proof-of-presence policy', 'json', true "
            "WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'face_verification')"
        ).bindparams(value=json.dumps(FACE_POLICY_DEFAULTS))
    )


def downgrade() -> None:
    op.drop_index("ix_face_events_student_created", table_name="face_enrollment_events")
    op.drop_table("face_enrollment_events")
    op.drop_index("ix_face_attempts_session", table_name="face_verification_attempts")
    op.drop_index("ix_face_attempts_student_created", table_name="face_verification_attempts")
    op.drop_table("face_verification_attempts")
    op.drop_index("ix_face_challenges_student_created", table_name="face_challenges")
    op.drop_table("face_challenges")
    op.drop_index("ix_face_templates_student", table_name="face_templates")
    op.drop_table("face_templates")
    op.drop_constraint("ck_students_face_enrollment_status", "students", type_="check")
    op.drop_column("students", "face_consent_at")
    op.drop_column("students", "face_model")
    op.drop_column("students", "face_registered_at")
    op.drop_column("students", "face_enrollment_status")
