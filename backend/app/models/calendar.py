#!/usr/bin/env python3
"""
Academic Calendar Database Schema
Creates tables for calendar events, holidays, exams, and class schedules
"""

from sqlalchemy import Column, Integer, String, Text, Date, Time, DateTime, Boolean, ForeignKey, Enum as SQLEnum, JSON
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
