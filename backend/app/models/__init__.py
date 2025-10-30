from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Float, ForeignKey, JSON, Enum, ARRAY, Numeric, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum

# Import notification models
from .notifications import EnhancedNotification, NotificationReadReceipt, NotificationScope, NotificationPriority, NotificationType

# Import calendar models
from .calendar import AcademicEvent, EventAttendance, CalendarSetting, AcademicYear, SemesterConfiguration, ClassScheduleTemplate, EventType, HolidayType

# Import schedule models
from .schedule import ClassSchedule, DayOfWeek

# Enums matching PostgreSQL ENUM types
class UserRole(enum.Enum):
    student = "student"
    admin = "admin"
    faculty = "faculty"

class AttendanceStatus(enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"

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

    # Relationships - User can be either student or admin
    student_profile = relationship("Student", back_populates="user", uselist=False, cascade="all, delete-orphan")
    admin_profile = relationship("Admin", back_populates="user", uselist=False, cascade="all, delete-orphan")

    # User can mark attendance and create notifications
    attendance_marked = relationship("AttendanceRecord", foreign_keys="AttendanceRecord.marked_by", back_populates="marked_by_user")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


# Faculty model
class Faculty(Base):
    __tablename__ = "faculties"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    # Relationships
    students = relationship("Student", back_populates="faculty_rel", cascade="all, delete-orphan")
    academic_events = relationship("AcademicEvent", back_populates="faculty")


# Updated Student model
class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    student_id = Column(String, unique=True, index=True, nullable=False)
    faculty = Column(String, nullable=False)  # Legacy column - keep for compatibility
    faculty_id = Column(Integer, ForeignKey("faculties.id"), nullable=True)
    semester = Column(Integer, nullable=False, default=1)  # Current semester (1-8)
    year = Column(Integer, nullable=False, default=1)  # Current academic year (1-4)
    batch = Column(Integer, nullable=False)  # Year when student joined (e.g., 2025)
    face_encoding = Column(JSON)  # Store face encoding as JSON (optimized with indexes)
    profile_image_url = Column(String)
    phone_number = Column(String)
    emergency_contact = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="student_profile")
    faculty_rel = relationship("Faculty", back_populates="students")
    attendance_records = relationship("AttendanceRecord", back_populates="student", cascade="all, delete-orphan")
    marks = relationship("Mark", back_populates="student", cascade="all, delete-orphan")
    ai_insights = relationship("AIInsight", back_populates="student", cascade="all, delete-orphan")
    event_attendance = relationship("EventAttendance", back_populates="student")

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
    academic_events = relationship("AcademicEvent", back_populates="subject")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)  # Optional subject link
    date = Column(DateTime, nullable=False)  # Date only (no time component)
    time_in = Column(DateTime, nullable=True)  # Time when attendance was marked
    time_out = Column(DateTime, nullable=True)  # Time when student left (optional)
    period = Column(Integer, nullable=True)  # Period number (1, 2, 3, etc.) for tracking multiple classes per day
    time_slot = Column(String, nullable=True)  # Time slot (e.g., "09:00-10:00") for better clarity
    status = Column(Enum(AttendanceStatus, name="attendance_status", native_enum=False), nullable=False, default=AttendanceStatus.present)
    method = Column(Enum(AttendanceMethod, name="attendance_method", native_enum=False), nullable=False, default=AttendanceMethod.manual)
    confidence_score = Column(Numeric(5, 2))  # Face recognition confidence (up to 999.99)
    location = Column(String, nullable=True)  # Location where attendance was marked
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    marked_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Who marked the attendance

    # Relationships
    student = relationship("Student", back_populates="attendance_records")
    subject = relationship("Subject", backref="attendance_records")
    marked_by_user = relationship("User", foreign_keys=[marked_by], back_populates="attendance_marked")
    
    # Add index for better query performance on common lookups
    __table_args__ = (
        # Composite index for finding attendance on a specific date+subject+period
        Index('idx_attendance_date_subject_period', 'date', 'subject_id', 'period'),
        # Index for student lookups
        Index('idx_attendance_student_date', 'student_id', 'date'),
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
