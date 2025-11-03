#!/usr/bin/env python3
"""
Academic Calendar Database Schema
Creates tables for calendar events, holidays, exams, and class schedules
"""

from sqlalchemy import Column, Integer, String, Text, Date, Time, DateTime, Boolean, ForeignKey, Enum as SQLEnum, JSON, CheckConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum
from datetime import datetime

# Import the existing Base from core database
from app.core.database import Base

class EventType(enum.Enum):
    CLASS = "class"
    HOLIDAY = "holiday"
    EXAM = "exam"
    SPECIAL_EVENT = "special_event"
    CANCELLED_CLASS = "cancelled_class"

class HolidayType(enum.Enum):
    FULL_DAY = "full_day"
    HALF_DAY = "half_day"

class AttendanceStatus(enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    PENDING = "pending"
    STARTS_SOON = "starts_soon"
    CANCELLED = "cancelled"

class AcademicEvent(Base):
    """
    Main table for all academic calendar events
    """
    __tablename__ = "academic_events"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(SQLEnum(EventType), nullable=False)
    
    # Date and time information
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)  # For multi-day events
    start_time = Column(Time, nullable=True)  # For timed events
    end_time = Column(Time, nullable=True)
    is_all_day = Column(Boolean, default=False)
    
    # Holiday specific fields
    holiday_type = Column(SQLEnum(HolidayType), nullable=True)
    
    # Class specific fields
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    faculty_id = Column(Integer, ForeignKey("faculties.id"), nullable=True)
    class_room = Column(String(100), nullable=True)
    
    # Event metadata
    color_code = Column(String(7), nullable=False)  # Hex color code
    is_recurring = Column(Boolean, default=False)
    recurrence_pattern = Column(JSON, nullable=True)  # For recurring events
    
    # Administrative fields
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Additional metadata
    attendance_required = Column(Boolean, default=False)
    notification_settings = Column(JSON, nullable=True)
    
    # Relationships
    subject = relationship("Subject", back_populates="academic_events")
    faculty = relationship("Faculty", back_populates="academic_events")
    creator = relationship("User")
    attendance_records = relationship("EventAttendance", back_populates="event")
    event_sessions = relationship("EventSession", back_populates="parent_event", cascade="all, delete-orphan")

class EventSession(Base):
    """
    Sub-events/sessions within a main academic event
    For detailed time breakdowns like agenda items, activities, etc.
    """
    __tablename__ = "event_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    parent_event_id = Column(Integer, ForeignKey("academic_events.id"), nullable=False)
    
    # Session details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Time information (within parent event timeframe)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    
    # Session metadata
    session_type = Column(String(100), nullable=True)  # presentation, break, lunch, activity, etc.
    presenter = Column(String(255), nullable=True)  # Who's presenting/leading
    location = Column(String(255), nullable=True)  # Specific room if different from main event
    color_code = Column(String(7), nullable=True)  # Custom color, inherits from parent if null
    
    # Administrative fields
    display_order = Column(Integer, default=0)  # For ordering sessions
    is_active = Column(Boolean, default=True)
    attendance_required = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    parent_event = relationship("AcademicEvent", back_populates="event_sessions")
    session_attendance = relationship("SessionAttendance", back_populates="session", cascade="all, delete-orphan")

class SessionAttendance(Base):
    """
    Track attendance for specific event sessions
    """
    __tablename__ = "session_attendance"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("event_sessions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    
    # Attendance information
    status = Column(SQLEnum(AttendanceStatus), default=AttendanceStatus.PENDING)
    marked_at = Column(DateTime, nullable=True)
    marked_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Session-specific info
    participation_score = Column(Integer, nullable=True)  # 0-100 for participation
    notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    session = relationship("EventSession", back_populates="session_attendance")

class EventAttendance(Base):
    """
    Track attendance for specific academic events
    """
    __tablename__ = "event_attendance"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("academic_events.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    
    # Attendance information
    status = Column(SQLEnum(AttendanceStatus), default=AttendanceStatus.PENDING)
    marked_at = Column(DateTime, nullable=True)
    marked_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Face verification details
    face_verification_used = Column(Boolean, default=False)
    verification_confidence = Column(Integer, nullable=True)  # 0-100
    
    # Location and device info
    location = Column(String(255), nullable=True)
    device_info = Column(JSON, nullable=True)
    
    # Administrative fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    event = relationship("AcademicEvent", back_populates="attendance_records")
    student = relationship("Student")
    marker = relationship("User")

class CalendarSetting(Base):
    """
    Store calendar preferences and settings for users
    """
    __tablename__ = "calendar_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    
    # View preferences
    default_view = Column(String(20), default="month")  # month, week, day
    start_week_on = Column(String(10), default="monday")  # monday, sunday
    
    # Notification settings
    email_notifications = Column(Boolean, default=True)
    push_notifications = Column(Boolean, default=True)
    reminder_before_minutes = Column(Integer, default=15)
    
    # Theme preferences
    color_scheme = Column(String(20), default="default")
    show_weekends = Column(Boolean, default=True)
    
    # Administrative fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")

class AcademicYear(Base):
    """
    Define academic years and terms/semesters
    """
    __tablename__ = "academic_years"
    
    id = Column(Integer, primary_key=True, index=True)
    year_name = Column(String(50), nullable=False)  # e.g., "2024-2025"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    
    # Term/Semester information
    total_terms = Column(Integer, default=2)
    current_term = Column(Integer, default=1)
    
    # Status
    is_current = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Administrative fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SemesterConfiguration(Base):
    """
    University-Wide Academic Period Configuration
    
    Defines time periods (e.g., Fall 2025, Spring 2026) that apply to the ENTIRE university.
    All students across ALL semesters (1-8) and ALL faculties use the same date range.
    
    The semester_number field is OPTIONAL and used only for:
    - Administrative reference (e.g., "This is typically when 3rd-year students study")
    - Sorting and organizing periods
    - NOT for filtering attendance or restricting access
    
    Each student's attendance is filtered by their individual semester and faculty,
    not by this configuration's semester_number.
    """
    __tablename__ = "semester_configurations"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Period identification
    semester_number = Column(Integer, nullable=True)   # Optional: Reference semester (e.g., 5 for "typical 3rd year Fall")
    academic_year = Column(Integer, nullable=False)    # Academic year (e.g., 2025)
    semester_name = Column(String(100), nullable=False)  # Period name (e.g., "Fall 2025 Academic Period")
    
    # University-wide period dates (applies to ALL students and faculties)
    start_date = Column(Date, nullable=False)      # Period start (all students use this)
    end_date = Column(Date, nullable=False)        # Period end (all students use this)
    
    # Academic metrics
    total_weeks = Column(Integer, nullable=True)   # Duration in weeks (e.g., 16)
    exam_week_start = Column(Date, nullable=True)  # Exam period start
    exam_week_end = Column(Date, nullable=True)    # Exam period end
    
    # Status flags
    is_current = Column(Boolean, default=False)    # Only ONE period can be current at a time
    is_active = Column(Boolean, default=True)      # Soft delete flag
    
    # Administrative fields
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    created_by_user = relationship("User", foreign_keys=[created_by])
    
    # Constraints
    __table_args__ = (
        # Semester numbers should be valid (1-8)
        CheckConstraint("semester_number BETWEEN 1 AND 8", name="valid_semester_number"),
        # End date after start date
        CheckConstraint("end_date > start_date", name="valid_date_range"),
    )


class AcademicCalendarConfig(Base):
    """
    Academic Calendar Date Override Configuration
    
    Allows admin to override the default semester boundary dates for emergency scenarios
    (e.g., COVID-19, natural disasters, institutional policy changes).
    
    When an active override exists, AutomaticSemesterService uses these dates instead of
    the hardcoded defaults. Only one override can be active at a time.
    
    Default boundaries (when no override active):
    - Fall: August 1 - December 15
    - Spring: January 15 - May 30
    """
    __tablename__ = "academic_calendar_config"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Date Boundaries (month, day tuples stored as separate columns)
    fall_start_month = Column(Integer, nullable=False)
    fall_start_day = Column(Integer, nullable=False)
    fall_end_month = Column(Integer, nullable=False)
    fall_end_day = Column(Integer, nullable=False)
    
    spring_start_month = Column(Integer, nullable=False)
    spring_start_day = Column(Integer, nullable=False)
    spring_end_month = Column(Integer, nullable=False)
    spring_end_day = Column(Integer, nullable=False)
    
    # Override Control
    is_override_active = Column(Boolean, nullable=False, default=False, index=True)
    
    # Metadata
    reason = Column(Text, nullable=True)  # e.g., "COVID-19 pandemic adjustment"
    effective_from = Column(Date, nullable=False)
    effective_until = Column(Date, nullable=True)  # NULL = indefinite
    
    # Audit Trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Emergency Flag
    is_emergency_override = Column(Boolean, default=False)
    emergency_contact_email = Column(String(255), nullable=True)
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
    
    # Constraints
    __table_args__ = (
        # Month values must be valid (1-12)
        CheckConstraint("fall_start_month BETWEEN 1 AND 12", name="valid_fall_start_month"),
        CheckConstraint("fall_end_month BETWEEN 1 AND 12", name="valid_fall_end_month"),
        CheckConstraint("spring_start_month BETWEEN 1 AND 12", name="valid_spring_start_month"),
        CheckConstraint("spring_end_month BETWEEN 1 AND 12", name="valid_spring_end_month"),
        # Day values must be valid (1-31)
        CheckConstraint("fall_start_day BETWEEN 1 AND 31", name="valid_fall_start_day"),
        CheckConstraint("fall_end_day BETWEEN 1 AND 31", name="valid_fall_end_day"),
        CheckConstraint("spring_start_day BETWEEN 1 AND 31", name="valid_spring_start_day"),
        CheckConstraint("spring_end_day BETWEEN 1 AND 31", name="valid_spring_end_day"),
        # Effective from before effective until
        CheckConstraint("effective_until IS NULL OR effective_until >= effective_from", name="valid_effective_range"),
    )

class ClassScheduleTemplate(Base):
    """
    Template for recurring class schedules
    """
    __tablename__ = "class_schedule_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Schedule pattern
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("faculties.id"), nullable=True)
    
    # Timing
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    
    # Location
    classroom = Column(String(100), nullable=True)
    building = Column(String(100), nullable=True)
    
    # Validity period
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    
    # Administrative fields
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    subject = relationship("Subject")
    faculty = relationship("Faculty")
    creator = relationship("User")

# Color scheme constants for event types
EVENT_COLORS = {
    EventType.CLASS: "#10B981",        # Green
    EventType.HOLIDAY: "#EF4444",      # Red  
    EventType.EXAM: "#F59E0B",         # Yellow/Amber
    EventType.SPECIAL_EVENT: "#3B82F6", # Blue
    EventType.CANCELLED_CLASS: "#6B7280" # Gray
}

# Add relationships to existing models (these would be added to your existing models)
"""
Add these relationships to existing model files:

# In Subject model:
academic_events = relationship("AcademicEvent", back_populates="subject")

# In Faculty model:  
academic_events = relationship("AcademicEvent", back_populates="faculty")

# In Student model:
event_attendance = relationship("EventAttendance", back_populates="student")
"""
