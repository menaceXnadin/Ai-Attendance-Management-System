"""
Class sessions, attendance audit log and job runs.

Schema contract: DOMAIN_RULES.md sections 5.1, 6.2, 7 and the v2 amendments
in section 13 (kind, cancelled_by_event_id, review flags, indexes).
The tables are created by alembic revision ``o20261018_class_sessions``;
these models must stay in sync with that revision.

Status/kind/source/action values are stored as plain VARCHAR columns guarded by
CHECK constraints (not native enums), so new values only need a CHECK change.
The ``StrEnum`` classes below are the canonical Python spellings; because they
are ``str`` subclasses they compare equal to the raw column values
(``SessionStatus.held == "held"``).
"""
import enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class SessionStatus(enum.StrEnum):
    scheduled = "scheduled"
    held = "held"
    cancelled = "cancelled"


class SessionKind(enum.StrEnum):
    regular = "regular"
    makeup = "makeup"


class AttendanceSource(enum.StrEnum):
    """Provenance of an attendance_records row (attendance_records.source)."""
    teacher = "teacher"
    admin = "admin"
    student_face = "student_face"
    system_auto = "system_auto"
    legacy = "legacy"


# Sources whose present/late/absent writes mean "attendance was actually taken".
REAL_ATTENDANCE_SOURCES = frozenset(
    {AttendanceSource.teacher, AttendanceSource.admin, AttendanceSource.student_face}
)


class AuditAction(enum.StrEnum):
    """Values for attendance_audit_log.action (no DB CHECK; keep to <= 32 chars)."""
    create = "create"
    update = "update"
    session_cancelled = "session_cancelled"
    session_uncancelled = "session_uncancelled"
    session_submitted = "session_submitted"
    finalize = "finalize"
    legacy_backfill = "legacy_backfill"
    metrics_exclusion = "metrics_exclusion"
    review_cleared = "review_cleared"


class ExclusionReason(enum.StrEnum):
    """Values written by the migration to attendance_records.exclusion_reason (13.5)."""
    legacy_unheld_session = "legacy_unheld_session"
    outside_term = "outside_term"
    recorded_before_class = "recorded_before_class"
    before_enrollment = "before_enrollment"


class JobRunStatus(enum.StrEnum):
    running = "running"
    success = "success"
    failed = "failed"
    skipped = "skipped"


def _in_check(column: str, values) -> str:
    return f"{column} IN ({', '.join(repr(str(v)) for v in values)})"


class ClassSession(Base):
    """One occurrence of a class for a cohort (subject + faculty + semester) on a date.

    Columns subject_id/faculty_id/semester/start_time/end_time/teacher_id are a
    snapshot taken when the session is materialized; they never follow later
    edits of the timetable row (schedule_id may even become NULL).
    """
    __tablename__ = "class_sessions"

    id = Column(Integer, primary_key=True)
    schedule_id = Column(Integer, ForeignKey("class_schedules.id", ondelete="SET NULL", name="fk_class_sessions_schedule"), nullable=True)
    kind = Column(String(16), nullable=False, default=SessionKind.regular.value,
                  server_default=text("'regular'"))

    # Snapshot (cohort + slot)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="RESTRICT", name="fk_class_sessions_subject"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("faculties.id", ondelete="RESTRICT", name="fk_class_sessions_faculty"), nullable=False)
    semester = Column(Integer, nullable=False)
    term_id = Column(Integer, ForeignKey("semester_configurations.id", ondelete="RESTRICT", name="fk_class_sessions_term"), nullable=True)
    session_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="SET NULL", name="fk_class_sessions_teacher"), nullable=True)

    # Lifecycle
    status = Column(String(16), nullable=False, default=SessionStatus.scheduled.value,
                    server_default=text("'scheduled'"))
    attendance_taken_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    submitted_by = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT", name="fk_class_sessions_submitted_by"), nullable=True)
    finalized_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT", name="fk_class_sessions_cancelled_by"), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    cancelled_by_event_id = Column(Integer, ForeignKey("academic_events.id", ondelete="SET NULL", name="fk_class_sessions_cancelled_by_event"), nullable=True)
    review_required = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    review_reason = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships (read-mostly; the DB decides on deletes)
    schedule = relationship("ClassSchedule", foreign_keys=[schedule_id])
    subject = relationship("Subject", foreign_keys=[subject_id])
    faculty = relationship("Faculty", foreign_keys=[faculty_id])
    term = relationship("SemesterConfiguration", foreign_keys=[term_id])
    teacher = relationship("Teacher", foreign_keys=[teacher_id])
    submitted_by_user = relationship("User", foreign_keys=[submitted_by])
    cancelled_by_user = relationship("User", foreign_keys=[cancelled_by])
    cancelled_by_event = relationship("AcademicEvent", foreign_keys=[cancelled_by_event_id])
    attendance_records = relationship(
        "AttendanceRecord", back_populates="session", passive_deletes="all"
    )

    __table_args__ = (
        UniqueConstraint(
            "subject_id", "faculty_id", "semester", "session_date", "start_time",
            name="uq_class_session_slot",
        ),
        CheckConstraint("end_time > start_time", name="ck_class_session_time_order"),
        CheckConstraint(_in_check("status", SessionStatus), name="ck_class_session_status"),
        CheckConstraint(_in_check("kind", SessionKind), name="ck_class_session_kind"),
        Index(
            "uq_class_session_schedule_date", "schedule_id", "session_date",
            unique=True,
            postgresql_where=text("schedule_id IS NOT NULL AND kind = 'regular'"),
        ),
        Index("ix_class_sessions_session_date", "session_date"),
        Index("ix_class_sessions_cohort_date", "faculty_id", "semester", "session_date"),
        Index("ix_class_sessions_status", "status"),
        Index("ix_class_sessions_teacher_date", "teacher_id", "session_date"),
        Index(
            "ix_class_sessions_held_unfinalized", "status", "finalized_at",
            postgresql_where=text("status = 'held' AND finalized_at IS NULL"),
        ),
        Index(
            "ix_class_sessions_cancelled_by_event", "cancelled_by_event_id",
            postgresql_where=text("cancelled_by_event_id IS NOT NULL"),
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<ClassSession id={self.id} subject={self.subject_id} "
            f"cohort={self.faculty_id}/{self.semester} {self.session_date} "
            f"{self.start_time}-{self.end_time} {self.status}>"
        )


class AttendanceAuditLog(Base):
    """Append-only history of attendance changes (application code never deletes rows)."""
    __tablename__ = "attendance_audit_log"

    id = Column(Integer, primary_key=True)
    attendance_record_id = Column(
        Integer, ForeignKey("attendance_records.id", ondelete="SET NULL", name="fk_attendance_audit_record"), nullable=True
    )
    session_id = Column(Integer, ForeignKey("class_sessions.id", ondelete="SET NULL", name="fk_attendance_audit_session"), nullable=True)
    # Plain id (no FK) so the history survives even if the student row is ever removed.
    student_id = Column(Integer, nullable=True)
    action = Column(String(32), nullable=False)
    old_status = Column(String(16), nullable=True)
    new_status = Column(String(16), nullable=True)
    old_source = Column(String(16), nullable=True)
    new_source = Column(String(16), nullable=True)
    changed_by = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT", name="fk_attendance_audit_changed_by"), nullable=True)  # NULL = system
    changed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    reason = Column(Text, nullable=True)
    context = Column(JSONB, nullable=True)

    attendance_record = relationship("AttendanceRecord", foreign_keys=[attendance_record_id])
    session = relationship("ClassSession", foreign_keys=[session_id])
    changed_by_user = relationship("User", foreign_keys=[changed_by])

    __table_args__ = (
        Index("ix_attendance_audit_log_record", "attendance_record_id"),
        Index("ix_attendance_audit_log_session", "session_id"),
        Index("ix_attendance_audit_log_changed_at", "changed_at"),
    )


class JobRun(Base):
    """One row per background job run that acquired its lock or failed (13.11)."""
    __tablename__ = "job_runs"

    id = Column(Integer, primary_key=True)
    job_name = Column(String(64), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(16), nullable=False, default=JobRunStatus.running.value,
                    server_default=text("'running'"))
    triggered_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL", name="fk_job_runs_triggered_by"), nullable=True)  # NULL = scheduler
    params = Column(JSONB, nullable=True)
    result = Column(JSONB, nullable=True)
    error = Column(Text, nullable=True)

    triggered_by_user = relationship("User", foreign_keys=[triggered_by])

    __table_args__ = (
        CheckConstraint(_in_check("status", JobRunStatus), name="ck_job_run_status"),
        Index("ix_job_runs_job_started", "job_name", "started_at"),
    )
