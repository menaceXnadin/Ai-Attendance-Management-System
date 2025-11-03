from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, date
from app.core.database import get_db
from app.models import Admin, AcademicEvent, EventType, ClassSchedule
from app.api.dependencies import get_current_admin
from app.services.auto_absent_service import AutoAbsentService, auto_absent_service
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter(prefix="/auto-absent", tags=["auto-absent"])

class AutoAbsentTriggerResponse(BaseModel):
    success: bool
    message: str
    records_created: int
    expired_classes_processed: int | None = None
    students_already_marked: int | None = None
    timestamp: datetime

@router.post("/trigger", response_model=AutoAbsentTriggerResponse)
async def trigger_auto_absent(
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually trigger the auto-absent system to process all expired classes.
    
    This endpoint allows admins to immediately run the auto-absent logic
    instead of waiting for the scheduled job (which runs every 30 minutes).
    
    The system will:
    1. Check for any holidays or cancellations
    2. Find all classes that have ended (past end_time with no grace period)
    3. Mark students as absent if they haven't marked attendance
    
    Only admins can trigger this endpoint.
    """
    try:
        # Run the auto-absent processing for today
        result = await auto_absent_service.process_auto_absent_for_today(db)

        return AutoAbsentTriggerResponse(
            success=bool(result.get("success", True)),
            message=result.get("message", "Auto-absent processing completed"),
            records_created=int(result.get("new_records_created", 0)),
            expired_classes_processed=int(result.get("expired_classes", 0)),
            students_already_marked=int(result.get("students_already_marked", 0)),
            timestamp=datetime.now()
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger auto-absent: {str(e)}"
        )

@router.get("/status")
async def get_auto_absent_status(
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get the current status of the auto-absent system.
    
    Returns information about:
    - Whether auto-absent scheduling is enabled
    - Current time and schedule window (07:00-20:00)
    - Number of schedules that would be processed if triggered now
    """
    try:
        # Check if auto-absent scheduler is enabled via centralized settings (.env)
        enable_auto_absent = bool(settings.enable_auto_absent_scheduler)

        # Get current time/date
        now = datetime.now()
        today = date.today()
        current_hour = now.hour
        current_minute = now.minute
        in_schedule_window = 7 <= current_hour < 20

        # If today is a full-day holiday/cancelled, nothing to process
        is_holiday = await auto_absent_service._is_holiday_or_cancelled(db, today)
        if is_holiday:
            return {
                "auto_absent_enabled": enable_auto_absent,
                "current_time": now.strftime("%Y-%m-%d %H:%M:%S"),
                "in_schedule_window": in_schedule_window,
                "schedule_window": "07:00 - 20:00",
                "expired_classes_ready_to_process": 0,
                "next_scheduled_run": "Every 30 minutes (if enabled and within window)",
                "notes": "Today is a holiday/cancelled day (full-day); nothing will be processed.",
            }

        # Get expired schedules using the same logic as the service (no grace period)
        expired_schedules = await auto_absent_service._get_expired_schedules(
            db, today, now.time()
        )

        # Filter out subject-specific cancellations (replicate service logic)
        expired_and_active = []
        for schedule in expired_schedules:
            cancel_query = select(AcademicEvent).where(
                and_(
                    AcademicEvent.start_date == today,
                    AcademicEvent.event_type == EventType.CANCELLED_CLASS,
                    AcademicEvent.subject_id == schedule.subject_id,
                    AcademicEvent.is_active == True,
                )
            )
            cancel_res = await db.execute(cancel_query)
            if cancel_res.scalar_one_or_none() is None:
                expired_and_active.append(schedule)

        return {
            "auto_absent_enabled": enable_auto_absent,
            "current_time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "in_schedule_window": in_schedule_window,
            "schedule_window": "07:00 - 20:00",
            "expired_classes_ready_to_process": len(expired_and_active),
            "next_scheduled_run": "Every 30 minutes (if enabled and within window)",
            "notes": "Classes expire at their end_time with no grace period. Full-day holidays are skipped; subject cancellations are excluded.",
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get auto-absent status: {str(e)}"
        )
