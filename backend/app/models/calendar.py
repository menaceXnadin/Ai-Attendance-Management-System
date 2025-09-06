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
    Dynamic configuration for semester dates and academic calendar
    Replaces hardcoded semester dates throughout the system
    """
    __tablename__ = "semester_configurations"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Semester identification
    semester_number = Column(Integer, nullable=False)  # 1-8 for 4-year program
    academic_year = Column(Integer, nullable=False)    # e.g., 2025
    semester_name = Column(String(100), nullable=False)  # e.g., "Fall 2025", "Spring 2026"
    
    # Semester dates
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    
    # Academic metrics
    total_weeks = Column(Integer, nullable=True)  # e.g., 16 weeks
    exam_week_start = Column(Date, nullable=True)
    exam_week_end = Column(Date, nullable=True)
    
    # Status flags
    is_current = Column(Boolean, default=False)    # Only one semester can be current
    is_active = Column(Boolean, default=True)      # For soft delete
    
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
