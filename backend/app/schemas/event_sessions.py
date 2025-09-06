#!/usr/bin/env python3
"""
Event Sessions Schema
Pydantic models for event session management
"""

from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import time, datetime

class EventSessionCreate(BaseModel):
    """Schema for creating a new event session"""
    parent_event_id: Optional[int] = None  # Optional since it comes from URL
    title: str
    description: Optional[str] = None
    start_time: str  # Format: "HH:MM"
    end_time: str    # Format: "HH:MM"
    session_type: Optional[str] = None
    presenter: Optional[str] = None
    location: Optional[str] = None
    color_code: Optional[str] = None
    display_order: Optional[int] = 0
    attendance_required: Optional[bool] = False

    @field_validator('start_time', 'end_time')
    def validate_time_format(cls, v):
        """Validate time format HH:MM"""
        try:
            time.fromisoformat(v)
            return v
        except ValueError:
            raise ValueError('Time must be in HH:MM format')

    @field_validator('end_time')
    def validate_end_after_start(cls, v, values):
        """Ensure end time is after start time"""
        if 'start_time' in values.data:
            start = time.fromisoformat(values.data['start_time'])
            end = time.fromisoformat(v)
            if end <= start:
                raise ValueError('End time must be after start time')
        return v

class EventSessionUpdate(BaseModel):
    """Schema for updating an event session"""
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    session_type: Optional[str] = None
    presenter: Optional[str] = None
    location: Optional[str] = None
    color_code: Optional[str] = None
    display_order: Optional[int] = None
    attendance_required: Optional[bool] = None
    is_active: Optional[bool] = None

    @field_validator('start_time', 'end_time')
    def validate_time_format(cls, v):
        """Validate time format HH:MM"""
        if v is not None:
            try:
                time.fromisoformat(v)
                return v
            except ValueError:
                raise ValueError('Time must be in HH:MM format')
        return v

class EventSessionResponse(BaseModel):
    """Schema for event session response"""
    id: int
    parent_event_id: int
    title: str
    description: Optional[str]
    start_time: str
    end_time: str
    session_type: Optional[str]
    presenter: Optional[str]
    location: Optional[str]
    color_code: Optional[str]
    display_order: int
    is_active: bool
    attendance_required: bool
    created_at: datetime
    updated_at: datetime

    @field_validator('start_time', 'end_time', mode='before')
    @classmethod
    def format_time_iso(cls, v):
        if isinstance(v, time):
            return v.isoformat()
        return v

    class Config:
        from_attributes = True

class EventWithSessionsResponse(BaseModel):
    """Schema for event with its sessions"""
    id: int
    title: str
    description: Optional[str]
    event_type: str
    start_date: str
    end_date: Optional[str]
    start_time: Optional[str]
    end_time: Optional[str]
    is_all_day: bool
    color_code: str
    sessions: List[EventSessionResponse] = []

    class Config:
        from_attributes = True

class SessionAttendanceCreate(BaseModel):
    """Schema for creating session attendance"""
    session_id: int
    student_id: int
    status: str = "pending"
    participation_score: Optional[int] = None
    notes: Optional[str] = None

class SessionAttendanceResponse(BaseModel):
    """Schema for session attendance response"""
    id: int
    session_id: int
    student_id: int
    status: str
    participation_score: Optional[int]
    notes: Optional[str]
    marked_at: Optional[datetime]
    marked_by: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True