from sqlalchemy import Column, Integer, String, DateTime, Date, Boolean, Text, Float, ForeignKey, JSON, Enum, ARRAY, Numeric, Index, UniqueConstraint, CheckConstraint, text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from app.core.database import Base
import enum

# Import notification models
from .notifications import EnhancedNotification, NotificationReadReceipt, NotificationScope, NotificationPriority, NotificationType

# Import calendar models
from .calendar import AcademicEvent, EventAttendance, CalendarSetting, AcademicYear, SemesterConfiguration, ClassScheduleTemplate, EventType, HolidayType, EventAttendanceStatus

# Import schedule models
from .schedule import ClassSchedule, DayOfWeek

# Import system settings models
from .system_settings import SystemSetting, AttendanceThreshold

# Class sessions, audit log, job runs (attendance redesign)
from .attendance_sessions import (
    ClassSession, AttendanceAuditLog, JobRun,
    SessionStatus, SessionKind, AttendanceSource, AuditAction, ExclusionReason, JobRunStatus,
    REAL_ATTENDANCE_SOURCES,
)

# Face verification (docs/system/face-verification.md)
from .face import (
    FaceTemplate, FaceChallenge, FaceVerificationAttempt, FaceEnrollmentEvent,
    FaceEnrollmentStatus, FacePose, ChallengePurpose, ChallengeAction, AttemptPurpose,
    EnrollmentEventAction, ENROLLMENT_STATUSES_ALLOWING_ENROLMENT,
)

# Enums matching PostgreSQL ENUM types
class UserRole(enum.Enum):
    student = "student"
    admin = "admin"
    faculty = "faculty"

class AttendanceStatus(enum.Enum):
    """DB enum ``attendance_status``. ``cancelled`` exists for legacy rows only:
    new code never writes per-student cancelled rows (cancellation lives on the session)."""
    present = "present"
    absent = "absent"
    late = "late"
    cancelled = "cancelled"
    excused = "excused"

class AttendanceMethod(enum.Enum):
    manual = "manual"
    face = "face"
    other = "other"

class InsightPriority(enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole, name="user_role", native_enum=False), nullable=False, default=UserRole.student)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships - User can be student, admin, or teacher
    # No ORM delete cascade to students: users->students is ON DELETE CASCADE in the DB and
    # attendance_records->students is ON DELETE RESTRICT, so the DB refuses to delete a user
    # whose student has attendance history. Deactivate users instead of deleting them.
    student_profile = relationship("Student", back_populates="user", uselist=False,
                                   cascade="save-update, merge", passive_deletes="all")
    admin_profile = relationship("Admin", back_populates="user", uselist=False, cascade="all, delete-orphan")
    teacher_profile = relationship("Teacher", back_populates="user", uselist=False, cascade="all, delete-orphan")

    # User can mark attendance and create notifications
    # passive_deletes="all": never NULL out attendance_records.marked_by from the ORM (provenance).
    attendance_marked = relationship("AttendanceRecord", foreign_keys="AttendanceRecord.marked_by",
                                     back_populates="marked_by_user", passive_deletes="all")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


# Faculty model
class Faculty(Base):
    __tablename__ = "faculties"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    code = Column(String(50), unique=True, nullable=True)  # Faculty code for student IDs (e.g., CSCI, ITEC)
    description = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    # Relationships
    # The DB decides (students_faculty_id_fkey is NO ACTION -> faculty with students cannot be deleted).
    students = relationship("Student", back_populates="faculty_rel", passive_deletes="all")
    # passive_deletes="all": never NULL academic_events.faculty_id (would widen a faculty event to all faculties).
    academic_events = relationship("AcademicEvent", back_populates="faculty", passive_deletes="all")


# Updated Student model
class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    student_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(255), nullable=True)  # DB-maintained copy of users.full_name (trigger on users update)
    faculty = Column(String(100), nullable=False)  # Legacy column - keep for compatibility
    faculty_id = Column(Integer, ForeignKey("faculties.id"), nullable=True)
    semester = Column(Integer, nullable=False, default=1)  # Current semester (1-8)
    year = Column(Integer, nullable=False, default=1)  # Current academic year (1-4)
    batch = Column(Integer, nullable=False)  # Year when student joined (e.g., 2025)
    # none_as_null: assigning None writes SQL NULL (not JSON 'null'), so `face_encoding IS NOT NULL` means "enrolled".
    face_encoding = Column(JSON(none_as_null=True), comment="JSON-encoded face encoding for recognition")  # composite template; never sent to clients
    # Face enrolment state (docs/system/face-verification.md §8)
    face_enrollment_status = Column(String(16), nullable=False, default="none", server_default=text("'none'"))
    face_registered_at = Column(DateTime(timezone=True), nullable=True)
    face_model = Column(String(64), nullable=True)
    face_consent_at = Column(DateTime(timezone=True), nullable=True)
    profile_image_url = Column(String)
    phone_number = Column(String(20))
    emergency_contact = Column(String(20))
    # Enrollment start for rosters/metrics = coalesce(enrolled_on, (created_at AT TIME ZONE APP_TIMEZONE)::date)
    enrolled_on = Column(Date, nullable=True)
    # Date the student joined the current cohort (faculty_id + semester); set when an admin changes either.
    cohort_since = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="student_profile")
    faculty_rel = relationship("Faculty", back_populates="students")
    # No ORM cascade: attendance is a legal record; the DB FK is ON DELETE RESTRICT.
    attendance_records = relationship("AttendanceRecord", back_populates="student", passive_deletes="all")
    marks = relationship("Mark", back_populates="student", cascade="all, delete-orphan")
    ai_insights = relationship("AIInsight", back_populates="student", cascade="all, delete-orphan")
    event_attendance = relationship("EventAttendance", back_populates="student")

    __table_args__ = (
        # Indexes present in the live DB (the duplicate students_user_id_idx is intentionally not modelled).
        Index("idx_students_student_id", "student_id"),
        Index("idx_students_user_id", "user_id"),
        Index("idx_students_class_year", "faculty", "year"),
        Index("students_face_encoding_not_null_idx", "id", postgresql_where=text("face_encoding IS NOT NULL")),
        CheckConstraint("face_enrollment_status IN ('none', 'enrolled', 'reset', 'deleted')", name="ck_students_face_enrollment_status"),
    )

class Admin(Base):
    __tablename__ = "admins"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    admin_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)  # Direct name column for better performance
    department = Column(String)
    permissions = Column(ARRAY(String))  # Store permissions as array of strings
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="admin_profile")

class Teacher(Base):
    __tablename__ = "teachers"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    teacher_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    faculty_id = Column(Integer, ForeignKey("faculties.id"), nullable=True)
    department = Column(String)
    phone_number = Column(String)
    office_location = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="teacher_profile")
    faculty_rel = relationship("Faculty", backref="teachers")
    schedules = relationship("ClassSchedule", back_populates="teacher")

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    code = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text)
    credits = Column(Integer, default=3)
    class_schedule = Column(JSON)  # Store schedule as JSON
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    faculty_id = Column(Integer, ForeignKey("faculties.id"), nullable=True)

    # Relationships
    marks = relationship("Mark", back_populates="subject", cascade="all, delete-orphan")
    faculty = relationship("Faculty", backref="subjects")
    # passive_deletes="all": never NULL academic_events.subject_id (a subject-specific
    # CANCELLED_CLASS would silently become a whole-day cancellation).
    academic_events = relationship("AcademicEvent", back_populates="subject", passive_deletes="all")

class AttendanceRecord(Base):
    """One student's attendance for one class session.

    Mirrors the live table exactly (native enums, DATE column, timestamptz, FKs)
    plus the redesign columns added by revision o20261018_class_sessions.
    ``date``/``subject_id``/``period``/``time_slot``/``method``/``location`` stay populated
    for backward compatibility (date = session.session_date, subject_id = session.subject_id).
    """
    __tablename__ = "attendance_records"
    id = Column(Integer, primary_key=True)
    # Attendance is a legal record: deleting a student with attendance is refused by the DB.
    student_id = Column(Integer, ForeignKey("students.id", ondelete="RESTRICT",
                                            name="attendance_records_student_id_fkey"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="RESTRICT",
                                            name="fk_attendance_subject"), nullable=False)
    # NULL only for legacy rows that could not be mapped to a session.
    session_id = Column(Integer, ForeignKey("class_sessions.id", ondelete="RESTRICT",
                                            name="fk_attendance_session"), nullable=True)
    date = Column(Date, nullable=False)  # = session_date
    time_in = Column(DateTime(timezone=True), nullable=True)  # When attendance was marked
    time_out = Column(DateTime(timezone=True), nullable=True)
    period = Column(Integer, nullable=True)
    time_slot = Column(String(50), nullable=True)  # 'HH:MM-HH:MM'
    status = Column(
        PGEnum(AttendanceStatus, name="attendance_status", create_type=False,
               values_callable=lambda e: [m.value for m in e]),
        nullable=True, default=AttendanceStatus.present,
        server_default=text("'present'::attendance_status"),
    )
    method = Column(
        PGEnum(AttendanceMethod, name="attendance_method", create_type=False,
               values_callable=lambda e: [m.value for m in e]),
        nullable=True, default=AttendanceMethod.manual,
        server_default=text("'manual'::attendance_method"),
    )
    # Provenance: teacher | admin | student_face | system_auto | legacy (see AttendanceSource)
    source = Column(String(16), nullable=False, default="legacy", server_default=text("'legacy'"))
    excluded_from_metrics = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    exclusion_reason = Column(String(64), nullable=True)
    confidence_score = Column(Numeric(5, 2), comment="Confidence score for face recognition or attendance method")
    location = Column(String(100), nullable=True)  # 'AUTO_ABSENT_SYSTEM' only for system_auto rows
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    marked_by = Column(Integer, ForeignKey("users.id", name="fk_attendance_marked_by_user"), nullable=True)

    # Relationships
    student = relationship("Student", back_populates="attendance_records")
    subject = relationship("Subject", backref=backref("attendance_records", passive_deletes="all"))
    session = relationship("ClassSession", back_populates="attendance_records")
    marked_by_user = relationship("User", foreign_keys=[marked_by], back_populates="attendance_marked")

    __table_args__ = (
        UniqueConstraint("student_id", "session_id", name="uq_attendance_student_session"),
        # Legacy rows without a session keep the old one-per-subject-day rule.
        Index("uq_attendance_legacy_day", "student_id", "subject_id", "date", unique=True,
              postgresql_where=text("session_id IS NULL")),
        CheckConstraint(
            "source IN ('teacher', 'admin', 'student_face', 'system_auto', 'legacy')",
            name="ck_attendance_source",
        ),
        Index("idx_attendance_session_id", "session_id"),
        Index("idx_attendance_date", "date"),
        Index("idx_attendance_date_subject_period", "date", "subject_id", "period"),
        Index("idx_attendance_student_date", "student_id", "date"),
        Index("idx_attendance_status", "status"),
        Index("idx_attendance_method", "method"),
        Index("idx_attendance_location", "location",
              postgresql_where=text("location::text = 'AUTO_ABSENT_SYSTEM'::text")),
    )

class Mark(Base):
    __tablename__ = "marks"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    exam_type = Column(String, nullable=False)  # midterm, final, quiz, assignment
    marks_obtained = Column(Float, nullable=False)
    total_marks = Column(Float, nullable=False)
    grade = Column(String)
    exam_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    student = relationship("Student", back_populates="marks")
    subject = relationship("Subject", back_populates="marks")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String, nullable=False)  # info, warning, success, danger
    is_read = Column(Boolean, default=False)
    action_url = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="notifications")

class AIInsight(Base):
    __tablename__ = "ai_insights"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    insight_type = Column(String, nullable=False)  # prediction, recommendation, alert
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    data = Column(JSON)  # Store additional data as JSON
    confidence = Column(Float)
    priority = Column(Enum(InsightPriority, name="insight_priority", native_enum=False), nullable=False, default=InsightPriority.medium)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime)

    # Relationships
    student = relationship("Student", back_populates="ai_insights")

# Password Reset Token model
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationship
    user = relationship("User")
