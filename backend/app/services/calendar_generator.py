"""
Automatic Academic Calendar Generator Service

This service automatically generates CLASS events based on class_schedules table.
It ensures the academic calendar is always up-to-date without manual intervention.

Features:
- Generates events for future dates automatically
- Respects holidays and special events
- Updates daily as time progresses
- Fully dynamic and future-proof
"""

from datetime import date, datetime, timedelta, time
from typing import List, Dict, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, delete
from sqlalchemy.orm import selectinload

from app.models import (
    AcademicEvent, EventType, ClassSchedule, DayOfWeek,
    SemesterConfiguration, Subject, Faculty, User
)

import logging

logger = logging.getLogger(__name__)


class CalendarGeneratorService:
    """Service to automatically generate and maintain academic calendar events"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_current_semester(self) -> Optional[SemesterConfiguration]:
        """Get the current active semester"""
        query = select(SemesterConfiguration).where(
            and_(
                SemesterConfiguration.is_current == True,
                SemesterConfiguration.is_active == True
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_or_create_system_user(self) -> User:
        """Get or create a system user for automated event creation"""
        query = select(User).where(User.email == "system@attendance.edu")
        result = await self.db.execute(query)
        system_user = result.scalar_one_or_none()
        
        if not system_user:
            # Create system user if doesn't exist
            from app.models import UserRole
            system_user = User(
                email="system@attendance.edu",
                full_name="System Calendar Generator",
                hashed_password="not_used_for_login",
                role=UserRole.admin,
                is_active=True
            )
            self.db.add(system_user)
            await self.db.commit()
            await self.db.refresh(system_user)
            logger.info("Created system user for calendar generation")
        
        return system_user
    
    async def check_if_holiday(self, target_date: date) -> bool:
        """Check if a date is marked as holiday"""
        query = select(AcademicEvent).where(
            and_(
                AcademicEvent.start_date == target_date,
                AcademicEvent.event_type.in_([EventType.HOLIDAY, EventType.CANCELLED_CLASS]),
                AcademicEvent.is_active == True
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None
    
    async def get_schedules_for_day(
        self, 
        target_date: date,
        semester: int,
        academic_year: int
    ) -> List[ClassSchedule]:
        """Get all class schedules for a specific day"""
        
        # Convert date to day of week
        weekday_map = {
            0: DayOfWeek.MONDAY,
            1: DayOfWeek.TUESDAY,
            2: DayOfWeek.WEDNESDAY,
            3: DayOfWeek.THURSDAY,
            4: DayOfWeek.FRIDAY,
            5: DayOfWeek.SATURDAY,
            6: DayOfWeek.SUNDAY
        }
        day_of_week = weekday_map[target_date.weekday()]
        
        # Get schedules
        query = select(ClassSchedule).options(
            selectinload(ClassSchedule.subject),
            selectinload(ClassSchedule.faculty)
        ).where(
            and_(
                ClassSchedule.day_of_week == day_of_week,
                ClassSchedule.semester == semester,
                ClassSchedule.academic_year == academic_year,
                ClassSchedule.is_active == True
            )
        ).order_by(ClassSchedule.start_time)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def event_exists(
        self,
        target_date: date,
        subject_id: int,
        start_time: time,
        end_time: time
    ) -> bool:
        """Check if an event already exists for this date/time/subject"""
        query = select(AcademicEvent).where(
            and_(
                AcademicEvent.start_date == target_date,
                AcademicEvent.subject_id == subject_id,
                AcademicEvent.start_time == start_time,
                AcademicEvent.end_time == end_time,
                AcademicEvent.event_type == EventType.CLASS,
                AcademicEvent.is_active == True
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None
    
    async def create_class_event(
        self,
        schedule: ClassSchedule,
        target_date: date,
        system_user: User
    ) -> AcademicEvent:
        """Create a single class event from schedule"""
        
        # Check if event already exists
        if await self.event_exists(
            target_date,
            schedule.subject_id,
            schedule.start_time,
            schedule.end_time
        ):
            logger.debug(f"Event already exists for {target_date} - {schedule.subject.name}")
            return None
        
        # Create event
        event = AcademicEvent(
            title=f"{schedule.subject.name} - Class",
            description=f"Regular class session for {schedule.subject.name} ({schedule.subject.code})",
            event_type=EventType.CLASS,
            start_date=target_date,
            end_date=target_date,
            start_time=schedule.start_time,
            end_time=schedule.end_time,
            is_all_day=False,
            subject_id=schedule.subject_id,
            faculty_id=schedule.faculty_id,
            class_room=schedule.classroom,
            color_code="#3B82F6",  # Blue for classes
            is_recurring=False,
            created_by=system_user.id,
            is_active=True,
            attendance_required=True,
            notification_settings={
                "auto_generated": True,
                "semester": schedule.semester,
                "academic_year": schedule.academic_year
            }
        )
        
        self.db.add(event)
        return event
    
    async def generate_events_for_date_range(
        self,
        start_date: date,
        end_date: date,
        semester: int,
        academic_year: int
    ) -> Dict[str, int]:
        """
        Generate CLASS events for a date range based on class schedules.
        
        Returns:
            Dict with statistics about events created
        """
        
        system_user = await self.get_or_create_system_user()
        
        stats = {
            "total_days": 0,
            "class_days": 0,
            "holiday_days": 0,
            "events_created": 0,
            "events_skipped": 0,
            "errors": 0
        }
        
        current_date = start_date
        
        while current_date <= end_date:
            stats["total_days"] += 1
            
            try:
                # Skip weekends (Saturday, Sunday) - configurable
                if current_date.weekday() in [5, 6]:  # Sat, Sun
                    logger.debug(f"Skipping weekend: {current_date}")
                    current_date += timedelta(days=1)
                    continue
                
                # Check if holiday
                is_holiday = await self.check_if_holiday(current_date)
                if is_holiday:
                    stats["holiday_days"] += 1
                    logger.debug(f"Skipping holiday: {current_date}")
                    current_date += timedelta(days=1)
                    continue
                
                # Get schedules for this day
                schedules = await self.get_schedules_for_day(
                    current_date, semester, academic_year
                )
                
                if not schedules:
                    logger.debug(f"No schedules found for {current_date}")
                    current_date += timedelta(days=1)
                    continue
                
                # This is a class day
                stats["class_days"] += 1
                
                # Create events for each scheduled class
                for schedule in schedules:
                    try:
                        event = await self.create_class_event(
                            schedule, current_date, system_user
                        )
                        if event:
                            stats["events_created"] += 1
                        else:
                            stats["events_skipped"] += 1
                    except Exception as e:
                        logger.error(f"Error creating event: {e}")
                        stats["errors"] += 1
                
            except Exception as e:
                logger.error(f"Error processing date {current_date}: {e}")
                stats["errors"] += 1
            
            current_date += timedelta(days=1)
        
        # Commit all events
        await self.db.commit()
        
        logger.info(f"Calendar generation complete: {stats}")
        return stats
    
    async def auto_generate_upcoming_events(
        self,
        days_ahead: int = 30
    ) -> Dict[str, int]:
        """
        Automatically generate events for upcoming days.
        This should be run daily via scheduled task.
        
        Args:
            days_ahead: Number of days into the future to generate (default: 30)
        
        Returns:
            Statistics about generation
        """
        
        semester = await self.get_current_semester()
        
        if not semester:
            logger.warning("No current semester configured")
            return {
                "error": "No current semester found",
                "events_created": 0
            }
        
        # Generate from today to X days ahead, but not beyond semester end
        today = date.today()
        end_date = min(
            today + timedelta(days=days_ahead),
            semester.end_date
        )
        
        logger.info(f"Auto-generating events from {today} to {end_date}")
        
        return await self.generate_events_for_date_range(
            start_date=today,
            end_date=end_date,
            semester=semester.semester_number,
            academic_year=semester.academic_year
        )
    
    async def generate_full_semester(self) -> Dict[str, int]:
        """
        Generate events for entire current semester.
        Use this for initial setup or regeneration.
        """
        
        semester = await self.get_current_semester()
        
        if not semester:
            logger.warning("No current semester configured")
            return {
                "error": "No current semester found",
                "events_created": 0
            }
        
        logger.info(f"Generating full semester: {semester.semester_name}")
        
        return await self.generate_events_for_date_range(
            start_date=semester.start_date,
            end_date=semester.end_date,
            semester=semester.semester_number,
            academic_year=semester.academic_year
        )
    
    async def cleanup_old_events(self, days_old: int = 90) -> int:
        """
        Clean up old auto-generated events to prevent database bloat.
        
        Args:
            days_old: Remove events older than this many days
        
        Returns:
            Number of events deleted
        """
        
        cutoff_date = date.today() - timedelta(days=days_old)
        
        # Only delete auto-generated events
        query = delete(AcademicEvent).where(
            and_(
                AcademicEvent.start_date < cutoff_date,
                AcademicEvent.event_type == EventType.CLASS,
                AcademicEvent.notification_settings['auto_generated'].astext == 'true'
            )
        )
        
        result = await self.db.execute(query)
        await self.db.commit()
        
        deleted_count = result.rowcount
        logger.info(f"Cleaned up {deleted_count} old events")
        
        return deleted_count


# Utility functions for easy access
async def auto_generate_calendar(db: AsyncSession, days_ahead: int = 30) -> Dict:
    """
    Convenience function to auto-generate upcoming calendar events.
    
    Usage:
        result = await auto_generate_calendar(db, days_ahead=30)
    """
    generator = CalendarGeneratorService(db)
    return await generator.auto_generate_upcoming_events(days_ahead)


async def generate_full_semester_calendar(db: AsyncSession) -> Dict:
    """
    Convenience function to generate entire semester calendar.
    
    Usage:
        result = await generate_full_semester_calendar(db)
    """
    generator = CalendarGeneratorService(db)
    return await generator.generate_full_semester()
