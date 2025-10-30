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
    DayOfWeek
)

# Configure logging
logger = logging.getLogger(__name__)

class AutoAbsentService:
    """Service to automatically mark students absent for missed classes"""
    
    def __init__(self):
        self.attendance_window_minutes = 30  # Allow 30 minutes after class start for attendance
        
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
            class_details = []
            
            for schedule in expired_schedules:
                result = await self._process_schedule_auto_absent(db, schedule, today)
                
                total_absent_records += result["records_created"]
                total_students_affected += result["students_affected"]
                class_details.append(result)
                
                logger.info(
                    f"Processed {schedule.subject.name if schedule.subject else 'Unknown'} "
                    f"({schedule.start_time}-{schedule.end_time}): "
                    f"{result['records_created']} absent records created"
                )
            
            # Commit all changes
            await db.commit()
            
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
                "class_details": class_details,
                "message": f"Successfully processed {len(expired_schedules)} expired classes"
            }
            
        except Exception as e:
            logger.error(f"Error in auto-absent processing: {str(e)}")
            await db.rollback()
            raise
    
    async def _get_expired_schedules(
        self, 
        db: AsyncSession, 
        target_date: date, 
        current_time: time
    ) -> List[ClassSchedule]:
        """Get all class schedules that have expired (past attendance window)"""
        
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
        
        # Calculate window end time (class start + window)
        # We need to find schedules where current_time > (start_time + window)
        
        query = select(ClassSchedule).options(
            selectinload(ClassSchedule.subject),
            selectinload(ClassSchedule.faculty)
        ).where(
            and_(
                ClassSchedule.day_of_week == today_enum,
                ClassSchedule.academic_year == target_date.year,
                ClassSchedule.is_active == True,
                # Check if attendance window has passed
                func.extract('hour', ClassSchedule.start_time) * 60 + 
                func.extract('minute', ClassSchedule.start_time) + 
                self.attendance_window_minutes < 
                current_time.hour * 60 + current_time.minute
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
        
        # Get all students for this semester AND faculty
        students_query = select(Student).where(
            and_(
                Student.semester == schedule.semester,
                Student.faculty_id == schedule.faculty_id
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
                "message": "All students already have attendance records"
            }
        
        # Create absent records for missing students using raw SQL with proper enum casting
        new_records_count = 0
        for student in students_to_mark_absent:
            # Use raw SQL to properly handle PostgreSQL enums
            await db.execute(
                text("""
                    INSERT INTO attendance_records 
                    (student_id, subject_id, date, time_in, time_out, status, method, confidence_score, location, notes, marked_by)
                    VALUES 
                    (:student_id, :subject_id, :date, NULL, NULL, 'absent'::attendance_status, 'other'::attendance_method, NULL, :location, :notes, NULL)
                """),
                {
                    "student_id": student.id,
                    "subject_id": schedule.subject_id,
                    "date": target_date,
                    "location": "AUTO_ABSENT_SYSTEM",
                    "notes": f"Automatically marked absent - missed attendance window (class: {schedule.start_time}-{schedule.end_time})"
                }
            )
            new_records_count += 1
            
            # Commit every 5 records to avoid transaction issues
            if new_records_count % 5 == 0:
                await db.commit()
        
        logger.info(
            f"Created {new_records_count} absent records for "
            f"{schedule.subject.name if schedule.subject else 'Unknown'} "
            f"({schedule.start_time}-{schedule.end_time})"
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