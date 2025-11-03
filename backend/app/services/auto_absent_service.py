"""
Auto-Absent Service for Attendance Management System

This service automatically marks students as absent when they miss 
attendance marking within the specified time window for their classes.

Features:
- Processes all expired classes for current day
- Creates absent attendance records for students who missed marking
- Runs as background task or can be triggered manually
- Logs all auto-absent operations for audit trail
"""

from datetime import datetime, date, time, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, text
from sqlalchemy.orm import selectinload
import logging

from app.core.database import get_db
from app.models import (
    ClassSchedule, 
    AttendanceRecord, 
    Student, 
    Subject, 
    AttendanceStatus, 
    AttendanceMethod,
    DayOfWeek,
    AcademicEvent,
    EventType
)

# Configure logging
logger = logging.getLogger(__name__)

class AutoAbsentService:
    """Service to automatically mark students absent for missed classes"""
    
    def __init__(self):
        # No grace period: attendance must be completed within the class period
        # Kept for backward compatibility but unused in expiration logic
        self.attendance_window_minutes = 0
        
    async def process_auto_absent_for_today(self, db: AsyncSession) -> Dict[str, Any]:
        """
        Process all expired classes for today and mark absent students
        
        Returns:
            Dict with processing results and statistics
        """
        today = date.today()
        current_time = datetime.now().time()
        
        logger.info(f"Starting auto-absent processing for {today} at {current_time}")
        
        try:
            # Check if today is a holiday or cancelled day
            is_holiday = await self._is_holiday_or_cancelled(db, today)
            if is_holiday:
                logger.info(f"Skipping auto-absent: {today} is a holiday or cancelled day")
                return {
                    "success": True,
                    "processed_date": today.isoformat(),
                    "expired_classes": 0,
                    "students_marked_absent": 0,
                    "new_records_created": 0,
                    "message": "No processing needed - today is a holiday or cancelled day"
                }
            
            # NEW: Check if today has a CLASS event (valid class day)
            has_class_event = await self._has_class_event(db, today)
            if not has_class_event:
                logger.info(f"Skipping auto-absent: {today} has no CLASS event (not a class day)")
                return {
                    "success": True,
                    "processed_date": today.isoformat(),
                    "expired_classes": 0,
                    "students_marked_absent": 0,
                    "new_records_created": 0,
                    "message": "No processing needed - today has no CLASS event in calendar"
                }
            
            # Get today's expired class schedules
            expired_schedules = await self._get_expired_schedules(db, today, current_time)
            logger.info(f"Found {len(expired_schedules)} expired class schedules")
            
            if not expired_schedules:
                return {
                    "success": True,
                    "processed_date": today.isoformat(),
                    "expired_classes": 0,
                    "students_marked_absent": 0,
                    "new_records_created": 0,
                    "message": "No expired classes found for today"
                }
            
            # Process each expired schedule
            total_absent_records = 0
            total_students_affected = 0
            total_already_marked = 0
            class_details = []
            
            for schedule in expired_schedules:
                result = await self._process_schedule_auto_absent(db, schedule, today)
                
                total_absent_records += result["records_created"]
                total_students_affected += result["students_affected"]
                total_already_marked += result.get("students_already_marked", 0)
                class_details.append(result)
                
                logger.info(
                    f"Processed {schedule.subject.name if schedule.subject else 'Unknown'} "
                    f"({schedule.start_time}-{schedule.end_time}): "
                    f"{result['records_created']} absent records created"
                )
            
            # Commit all changes
            await db.commit()
            
            # Create clear message based on results
            if total_absent_records == 0 and total_already_marked > 0:
                message = f"No new records needed. All {total_already_marked} students across {len(expired_schedules)} classes already have attendance records (previously marked or auto-absent)."
            elif total_absent_records > 0:
                message = f"Successfully marked {total_students_affected} students absent across {len(expired_schedules)} classes. {total_absent_records} new records created."
            else:
                message = f"Processed {len(expired_schedules)} expired classes with no students requiring absent records."
            
            logger.info(
                f"Auto-absent processing completed. "
                f"Total: {total_absent_records} records, {total_students_affected} students"
            )
            
            return {
                "success": True,
                "processed_date": today.isoformat(),
                "expired_classes": len(expired_schedules),
                "students_marked_absent": total_students_affected,
                "new_records_created": total_absent_records,
                "students_already_marked": total_already_marked,
                "class_details": class_details,
                "message": message
            }
            
        except Exception as e:
            logger.error(f"Error in auto-absent processing: {str(e)}")
            await db.rollback()
            raise
    
    async def _is_holiday_or_cancelled(self, db: AsyncSession, target_date: date) -> bool:
        """
        Check if the target date is a holiday or has cancelled classes
        
        Returns:
            True if it's a holiday or all classes are cancelled for the day
        """
        # Check for holiday or cancelled day events (no specific subject = affects all classes)
        # Note: CLASS events are NOT checked here - they represent regular class days
        event_query = select(AcademicEvent).where(
            and_(
                AcademicEvent.start_date == target_date,
                AcademicEvent.event_type.in_([EventType.HOLIDAY, EventType.CANCELLED_CLASS]),
                AcademicEvent.is_active == True,
                AcademicEvent.subject_id.is_(None)  # Null subject_id = affects entire day
            )
        )
        
        result = await db.execute(event_query)
        holiday_event = result.scalar_one_or_none()
        
        return holiday_event is not None
    
    async def _has_class_event(self, db: AsyncSession, target_date: date) -> bool:
        """
        Check if the target date has a CLASS event (indicates it's a valid class day)
        
        Returns:
            True if there's an active CLASS event for this date
        """
        class_event_query = select(AcademicEvent).where(
            and_(
                AcademicEvent.start_date == target_date,
                AcademicEvent.event_type == EventType.CLASS,
                AcademicEvent.is_active == True
            )
        )
        
        result = await db.execute(class_event_query)
        class_event = result.scalar_one_or_none()
        
        return class_event is not None
    
    async def _get_expired_schedules(
        self, 
        db: AsyncSession, 
        target_date: date, 
        current_time: time
    ) -> List[ClassSchedule]:
        """Get all class schedules that have expired (past class end time)"""
        
        # Map weekday to DayOfWeek enum
        weekday = target_date.weekday()
        day_map = {
            0: DayOfWeek.MONDAY,
            1: DayOfWeek.TUESDAY, 
            2: DayOfWeek.WEDNESDAY,
            3: DayOfWeek.THURSDAY,
            4: DayOfWeek.FRIDAY,
            5: DayOfWeek.SATURDAY,
            6: DayOfWeek.SUNDAY
        }
        today_enum = day_map[weekday]
        
        # Determine expired schedules strictly by class end time (no grace period)
        # We find schedules where current_time >= end_time
        query = select(ClassSchedule).options(
            selectinload(ClassSchedule.subject),
            selectinload(ClassSchedule.faculty)
        ).where(
            and_(
                ClassSchedule.day_of_week == today_enum,
                ClassSchedule.academic_year == target_date.year,
                ClassSchedule.is_active == True,
                # Expired when current time is at or past the class end time
                (
                    func.extract('hour', ClassSchedule.end_time) * 60 +
                    func.extract('minute', ClassSchedule.end_time)
                ) <= (current_time.hour * 60 + current_time.minute)
            )
        )
        
        result = await db.execute(query)
        schedules = result.scalars().all()
        
        return list(schedules)
    
    async def _process_schedule_auto_absent(
        self, 
        db: AsyncSession, 
        schedule: ClassSchedule, 
        target_date: date
    ) -> Dict[str, Any]:
        """Process a single schedule and mark absent students"""
        
        # Check if this specific subject is cancelled on this date
        cancellation_query = select(AcademicEvent).where(
            and_(
                AcademicEvent.start_date == target_date,
                AcademicEvent.event_type == EventType.CANCELLED_CLASS,
                AcademicEvent.subject_id == schedule.subject_id,
                AcademicEvent.is_active == True
            )
        )
        cancellation_result = await db.execute(cancellation_query)
        is_cancelled = cancellation_result.scalar_one_or_none() is not None
        
        if is_cancelled:
            logger.info(
                f"Skipping {schedule.subject.name if schedule.subject else 'Unknown'} "
                f"({schedule.start_time}-{schedule.end_time}): class is cancelled"
            )
            return {
                "schedule_id": schedule.id,
                "subject_name": schedule.subject.name if schedule.subject else "Unknown",
                "time_slot": f"{schedule.start_time}-{schedule.end_time}",
                "semester": schedule.semester,
                "students_affected": 0,
                "records_created": 0,
                "message": "Class cancelled - no absent records created"
            }
        
        # Get all students for this semester AND faculty
        # IMPORTANT: Only get students who have this subject (to prevent cross-faculty contamination)
        students_query = select(Student).where(
            and_(
                Student.semester == schedule.semester,
                Student.faculty_id == schedule.faculty_id,
                Student.faculty_id == schedule.subject.faculty_id if schedule.subject else schedule.faculty_id  # Ensure subject belongs to student's faculty
            )
        )
        result = await db.execute(students_query)
        semester_students = result.scalars().all()
        
        if not semester_students:
            return {
                "schedule_id": schedule.id,
                "subject_name": schedule.subject.name if schedule.subject else "Unknown",
                "time_slot": f"{schedule.start_time}-{schedule.end_time}",
                "semester": schedule.semester,
                "students_affected": 0,
                "records_created": 0,
                "message": "No students found for this semester"
            }
        
        # Find students who already have attendance records for this schedule today
        existing_attendance_query = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.subject_id == schedule.subject_id,
                AttendanceRecord.date == target_date,
                AttendanceRecord.student_id.in_([s.id for s in semester_students])
            )
        )
        result = await db.execute(existing_attendance_query)
        existing_records = result.scalars().all()
        
        # Get student IDs who already have attendance records
        students_with_attendance = {record.student_id for record in existing_records}
        
        # Find students who need to be marked absent
        students_to_mark_absent = [
            student for student in semester_students 
            if student.id not in students_with_attendance
        ]
        
        if not students_to_mark_absent:
            return {
                "schedule_id": schedule.id,
                "subject_name": schedule.subject.name if schedule.subject else "Unknown",
                "time_slot": f"{schedule.start_time}-{schedule.end_time}",
                "semester": schedule.semester,
                "students_affected": 0,
                "records_created": 0,
                "students_already_marked": len(students_with_attendance),
                "total_students": len(semester_students),
                "message": "All students already have attendance records"
            }
        
        # Create absent records for missing students using raw SQL with proper enum casting
        # Use ON CONFLICT DO NOTHING to prevent duplicates if scheduler runs multiple times
        new_records_count = 0
        skipped_duplicates = 0
        
        for student in students_to_mark_absent:
            # Use raw SQL with ON CONFLICT to prevent duplicate records
            # Unique constraint should be on (student_id, subject_id, date)
            result = await db.execute(
                text("""
                    INSERT INTO attendance_records 
                    (student_id, subject_id, date, time_in, time_out, status, method, confidence_score, location, notes, marked_by)
                    VALUES 
                    (:student_id, :subject_id, :date, NULL, NULL, 'absent'::attendance_status, 'other'::attendance_method, NULL, :location, :notes, NULL)
                    ON CONFLICT (student_id, subject_id, date) DO NOTHING
                    RETURNING id
                """),
                {
                    "student_id": student.id,
                    "subject_id": schedule.subject_id,
                    "date": target_date,
                    "location": "AUTO_ABSENT_SYSTEM",
                    "notes": f"Automatically marked absent - did not mark within class period (class: {schedule.start_time}-{schedule.end_time})"
                }
            )
            
            # Check if record was actually created (RETURNING id will be None if conflict)
            if result.fetchone() is not None:
                new_records_count += 1
            else:
                skipped_duplicates += 1
            
            # Commit every 5 operations to avoid transaction issues
            if (new_records_count + skipped_duplicates) % 5 == 0:
                await db.commit()
        
        logger.info(
            f"Processed {schedule.subject.name if schedule.subject else 'Unknown'} "
            f"[Faculty: {schedule.faculty_id}, Semester: {schedule.semester}] "
            f"({schedule.start_time}-{schedule.end_time}): "
            f"Created {new_records_count} records, Skipped {skipped_duplicates} duplicates"
        )
        
        return {
            "schedule_id": schedule.id,
            "subject_name": schedule.subject.name if schedule.subject else "Unknown",
            "time_slot": f"{schedule.start_time}-{schedule.end_time}",
            "semester": schedule.semester,
            "students_affected": len(students_to_mark_absent),
            "records_created": new_records_count,
            "message": f"Marked {len(students_to_mark_absent)} students absent"
        }
    
    async def get_auto_absent_stats(self, db: AsyncSession, target_date: Optional[date] = None) -> Dict[str, Any]:
        """Get statistics about auto-absent records for a specific date"""
        
        if target_date is None:
            target_date = date.today()
        
        # Count auto-absent records (identified by location = "AUTO_ABSENT_SYSTEM")
        auto_absent_query = select(func.count(AttendanceRecord.id)).where(
            and_(
                AttendanceRecord.date == target_date,
                AttendanceRecord.status == AttendanceStatus.absent,  # Use enum value
                AttendanceRecord.location == "AUTO_ABSENT_SYSTEM"
            )
        )
        result = await db.execute(auto_absent_query)
        auto_absent_count = result.scalar() or 0
        
        # Count total absent records for comparison
        total_absent_query = select(func.count(AttendanceRecord.id)).where(
            and_(
                AttendanceRecord.date == target_date,
                AttendanceRecord.status == AttendanceStatus.absent  # Use enum value
            )
        )
        result = await db.execute(total_absent_query)
        total_absent_count = result.scalar() or 0
        
        # Count total attendance records for the day
        total_records_query = select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.date == target_date
        )
        result = await db.execute(total_records_query)
        total_records = result.scalar() or 0
        
        return {
            "date": target_date.isoformat(),
            "auto_absent_records": auto_absent_count,
            "total_absent_records": total_absent_count,
            "manual_absent_records": total_absent_count - auto_absent_count,
            "total_attendance_records": total_records,
            "auto_absent_percentage": round((auto_absent_count / total_records * 100) if total_records > 0 else 0, 2)
        }

# Singleton instance
auto_absent_service = AutoAbsentService()