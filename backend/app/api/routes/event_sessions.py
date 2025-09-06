#!/usr/bin/env python3
"""
Event Sessions API
FastAPI endpoints for managing event sessions and attendance
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Optional
from datetime import datetime, time

from app.core.database import get_db
from app.models.calendar import EventSession, SessionAttendance, AcademicEvent
from app.models import User
from app.schemas.event_sessions import (
    EventSessionCreate, 
    EventSessionUpdate, 
    EventSessionResponse,
    EventWithSessionsResponse,
    SessionAttendanceCreate,
    SessionAttendanceResponse
)
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/event-sessions", tags=["event-sessions"])

def require_admin_or_faculty(current_user: User = Depends(get_current_user)):
    """Require admin or faculty access"""
    if current_user.role.value not in ["admin", "faculty"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    return current_user

# Event Session Management

@router.post("/events/{event_id}/sessions", response_model=EventSessionResponse)
async def create_event_session(
    event_id: int,
    session_data: EventSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_faculty)
):
    """Create a new session for an event"""
    # Verify parent event exists
    result = await db.execute(select(AcademicEvent).filter(AcademicEvent.id == event_id))
    parent_event = result.scalar_one_or_none()
    if not parent_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent event not found"
        )
    
    # Create new session with event_id from URL
    new_session = EventSession(
        parent_event_id=event_id,
        title=session_data.title,
        description=session_data.description,
        start_time=time.fromisoformat(session_data.start_time),
        end_time=time.fromisoformat(session_data.end_time),
        session_type=session_data.session_type,
        presenter=session_data.presenter,
        location=session_data.location,
        color_code=session_data.color_code,
        display_order=session_data.display_order or 0,
        attendance_required=session_data.attendance_required or False
    )
    
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    return new_session

@router.get("/events/{event_id}/sessions", response_model=List[EventSessionResponse])
async def get_event_sessions(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all sessions for an event"""
    # Verify parent event exists
    result = await db.execute(select(AcademicEvent).filter(AcademicEvent.id == event_id))
    parent_event = result.scalar_one_or_none()
    if not parent_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent event not found"
        )
    
    result = await db.execute(
        select(EventSession)
        .filter(
            EventSession.parent_event_id == event_id,
            EventSession.is_active == True
        )
        .order_by(EventSession.display_order, EventSession.start_time)
    )
    sessions = result.scalars().all()
    
    return sessions

@router.get("/events/{event_id}/with-sessions", response_model=EventWithSessionsResponse)
async def get_event_with_sessions(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get event with all its sessions"""
    # Get parent event
    result = await db.execute(select(AcademicEvent).filter(AcademicEvent.id == event_id))
    parent_event = result.scalar_one_or_none()
    if not parent_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Get sessions
    result = await db.execute(
        select(EventSession)
        .filter(
            EventSession.parent_event_id == event_id,
            EventSession.is_active == True
        )
        .order_by(EventSession.display_order, EventSession.start_time)
    )
    sessions = result.scalars().all()
    
    # Build response
    event_response = EventWithSessionsResponse(
        id=parent_event.id,
        title=parent_event.title,
        description=parent_event.description,
        event_type=parent_event.event_type,
        start_date=parent_event.start_date,
        end_date=parent_event.end_date,
        start_time=parent_event.start_time,
        end_time=parent_event.end_time,
        is_all_day=parent_event.is_all_day,
        color_code=parent_event.color_code,
        sessions=[EventSessionResponse.from_attributes(session) for session in sessions]
    )
    
    return event_response

@router.put("/sessions/{session_id}", response_model=EventSessionResponse)
async def update_event_session(
    session_id: int,
    session_data: EventSessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_faculty)
):
    """Update an event session"""
    result = await db.execute(select(EventSession).filter(EventSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Update fields
    update_data = session_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(session, field, value)
    
    session.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)
    
    return session

@router.delete("/sessions/{session_id}")
async def delete_event_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_faculty)
):
    """Delete (deactivate) an event session"""
    result = await db.execute(select(EventSession).filter(EventSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    session.is_active = False
    session.updated_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Session deleted successfully"}

# Session Attendance Management

@router.post("/sessions/{session_id}/attendance", response_model=SessionAttendanceResponse)
async def mark_session_attendance(
    session_id: int,
    attendance_data: SessionAttendanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_faculty)
):
    """Mark attendance for a session"""
    # Verify session exists
    result = await db.execute(
        select(EventSession).filter(
            EventSession.id == session_id,
            EventSession.is_active == True
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Check if attendance already exists
    result = await db.execute(
        select(SessionAttendance).filter(
            SessionAttendance.session_id == session_id,
            SessionAttendance.student_id == attendance_data.student_id
        )
    )
    existing_attendance = result.scalar_one_or_none()
    
    if existing_attendance:
        # Update existing attendance
        existing_attendance.status = attendance_data.status
        existing_attendance.participation_score = attendance_data.participation_score
        existing_attendance.notes = attendance_data.notes
        existing_attendance.marked_at = datetime.utcnow()
        existing_attendance.marked_by = current_user.id
        
        await db.commit()
        await db.refresh(existing_attendance)
        return existing_attendance
    else:
        # Create new attendance record
        new_attendance = SessionAttendance(
            session_id=session_id,
            student_id=attendance_data.student_id,
            status=attendance_data.status,
            participation_score=attendance_data.participation_score,
            notes=attendance_data.notes,
            marked_at=datetime.utcnow(),
            marked_by=current_user.id
        )
        
        db.add(new_attendance)
        await db.commit()
        await db.refresh(new_attendance)
        return new_attendance

@router.get("/sessions/{session_id}/attendance", response_model=List[SessionAttendanceResponse])
async def get_session_attendance(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get attendance records for a session"""
    # Verify session exists
    result = await db.execute(
        select(EventSession).filter(
            EventSession.id == session_id,
            EventSession.is_active == True
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    result = await db.execute(
        select(SessionAttendance).filter(SessionAttendance.session_id == session_id)
    )
    attendance_records = result.scalars().all()
    
    return attendance_records

@router.get("/students/{student_id}/session-attendance", response_model=List[SessionAttendanceResponse])
async def get_student_session_attendance(
    student_id: int,
    event_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get session attendance records for a student"""
    query = select(SessionAttendance).filter(SessionAttendance.student_id == student_id)
    
    if event_id:
        # Filter by specific event sessions
        query = query.join(EventSession).filter(
            EventSession.parent_event_id == event_id,
            EventSession.is_active == True
        )
    
    result = await db.execute(query)
    attendance_records = result.scalars().all()
    return attendance_records