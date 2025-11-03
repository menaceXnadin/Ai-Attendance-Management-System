"""
System Settings Model
Stores configurable system-wide settings including attendance thresholds
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON, Float
from sqlalchemy.sql import func
from app.core.database import Base


class SystemSetting(Base):
    """
    Store system-wide configuration settings
    Each setting has a key-value structure with metadata
    """
    __tablename__ = "system_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)  # Setting identifier
    value = Column(JSON, nullable=False)  # Setting value (flexible JSON format)
    category = Column(String, nullable=False, index=True)  # attendance, academic, notification, etc.
    description = Column(Text)  # Human-readable description
    data_type = Column(String, nullable=False)  # json, string, number, boolean
    is_active = Column(Boolean, default=True)
    updated_by = Column(Integer, nullable=True)  # User ID who last updated
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AttendanceThreshold(Base):
    """
    Dedicated table for attendance threshold configuration
    Provides a clear, validated structure for attendance rules
    """
    __tablename__ = "attendance_thresholds"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # excellent, good, warning, critical
    min_percentage = Column(Float, nullable=False)  # Minimum percentage for this tier
    max_percentage = Column(Float, nullable=True)  # Maximum percentage (null for top tier)
    color = Column(String, nullable=False)  # Color code (blue, green, yellow, red)
    badge_style = Column(String, nullable=False)  # CSS class or style string
    label = Column(String, nullable=False)  # Display label
    description = Column(Text)  # Description of what this tier means
    order = Column(Integer, nullable=False)  # Display order (1=best, 4=worst)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
