"""
Student Attendance Calendar API

Provides comprehensive attendance calendar data for individual students,
including daily status, monthly summaries, and attendance statistics.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import date, datetime, timedelta
from collections import defaultdict
import traceback

from app.core.database import get_db
from app.models import Student, AttendanceRecord, User, AttendanceStatus, Subject, ClassSchedule, Faculty, AcademicEvent, EventType
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/student-calendar", tags=["student-calendar"])


def detect_system_status(target_date: date, records: List[AttendanceRecord]) -> str:
    """
    Intelligently detect if the attendance system was active on a specific date
    by analyzing database forensics (created_at timestamps).
    
    This allows the system to distinguish between:
    - System downtime (no records because backend wasn't running)
    - Real absences (no records because student didn't attend)
    - Backfilled data (records created retroactively by admin)
    
    Args:
        target_date: The date of the class
        records: List of attendance records for that date
        
    Returns:
        'system_inactive': No records and no evidence of system activity
        'system_active': Records were created on the same day (system was running)
        'system_backfilled': Records exist but were created on a later date
    """
    if len(records) == 0:
        # No records at all - system was likely inactive/down
        return 'system_inactive'
    
    # Check if any records were created on the same day as the class
    same_day_records = [
        r for r in records 
        if r.created_at.date() == target_date
    ]
    
    if len(same_day_records) > 0:
        # At least one record created on the same day = system was definitely active
        return 'system_active'
    
    # All records have created_at dates AFTER the class date
    # This indicates retroactive/backfill (admin entered historical data)
    return 'system_backfilled'


@router.get("/me")
async def get_my_attendance_calendar(
    year: int = Query(..., description="Year for calendar view"),
    month: int = Query(..., description="Month for calendar view (1-12)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get attendance calendar for the currently logged-in student.
    Convenience endpoint that doesn't require passing student_id.
    """
    # Get student record for current user
    student_query = select(Student).where(Student.user_id == current_user.id)
    student_result = await db.execute(student_query)
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student record not found for current user"
        )
    
    # Call the main calendar function with the student's ID
    return await get_student_attendance_calendar(student.id, year, month, current_user, db)


@router.get("/{student_id}")
async def get_student_attendance_calendar(
    student_id: int,
    year: int = Query(..., description="Year for calendar view"),
    month: int = Query(..., description="Month for calendar view (1-12)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive attendance calendar data for a specific student.
    
    Returns:
    - Daily attendance status for each day in the month
    - Monthly statistics (total classes, present, absent, late, attendance rate)
    - Subject-wise breakdown
    - Streak information
    """
    
    try:
        print(f"[DEBUG] Fetching calendar for student_id={student_id}, year={year}, month={month}")
        
        # Verify student exists and load user relationship
        student_query = select(Student).options(
            selectinload(Student.user),
            selectinload(Student.faculty_rel)
        ).where(Student.id == student_id)
        student_result = await db.execute(student_query)
        student = student_result.scalar_one_or_none()
        
        if not student:
            print(f"[ERROR] Student with ID {student_id} not found")
            raise HTTPException(
                status_code=404,
                detail=f"Student with ID {student_id} not found"
            )
        
        print(f"[DEBUG] Student found: {student.user.full_name if student.user else 'Unknown'}, faculty_id={student.faculty_id}, semester={student.semester}")
        
        if not student.faculty_id or not student.semester:
            print(f"[ERROR] Student not enrolled: faculty_id={student.faculty_id}, semester={student.semester}")
            raise HTTPException(
                status_code=400,
                detail=f"Student {student.user.full_name} is not enrolled in a faculty or semester."
            )

        # Calculate date range for the month
        try:
            start_date = date(year, month, 1)
            if month == 12:
                end_date = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(year, month + 1, 1) - timedelta(days=1)
            print(f"[DEBUG] Date range: {start_date} to {end_date}")
        except ValueError as e:
            print(f"[ERROR] Invalid date: {e}")
            raise HTTPException(
                status_code=400,
                detail="Invalid year or month"
            )

        # Fetch all academic events for the student's faculty and semester in the month
        events_query = select(AcademicEvent).where(
            and_(
                AcademicEvent.start_date.between(start_date, end_date),
                or_(
                    AcademicEvent.faculty_id == student.faculty_id,
                    AcademicEvent.faculty_id == None # Global events
                )
            )
        )
        events_result = await db.execute(events_query)
        all_month_events = events_result.scalars().all()
        
        daily_events = defaultdict(list)
        for event in all_month_events:
            daily_events[event.start_date.strftime("%Y-%m-%d")].append(event)

        print(f"[DEBUG] Found {len(all_month_events)} total academic events for the month.")
        
        # Fetch all attendance records for the student in the month
        records_query = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.student_id == student_id,
                func.date(AttendanceRecord.date) >= start_date,
                func.date(AttendanceRecord.date) <= end_date
            )
        ).order_by(AttendanceRecord.date)
        
        result = await db.execute(records_query)
        all_records = result.scalars().all()
        
        print(f"[DEBUG] Found {len(all_records)} attendance records")
        
        # CRITICAL: Fetch ALL attendance records for the entire month (all students)
        # This is needed to detect if the system was active on any given day
        global_activity_query = select(AttendanceRecord).where(
            and_(
                func.date(AttendanceRecord.date) >= start_date,
                func.date(AttendanceRecord.date) <= end_date
            )
        ).order_by(AttendanceRecord.date)
        
        global_result = await db.execute(global_activity_query)
        all_global_records = global_result.scalars().all()
        
        # Build a map of dates with system activity (any student had attendance recorded)
        dates_with_system_activity = set()
        for record in all_global_records:
            date_obj = record.date.date() if hasattr(record.date, 'date') else record.date
            # Check if record was created on the same day (system was running that day)
            if record.created_at.date() == date_obj:
                dates_with_system_activity.add(date_obj)
        
        print(f"[DEBUG] System was active on {len(dates_with_system_activity)} days in this month")
        
        # Fetch subject information for enrichment - ONLY for student's faculty and semester
        subject_query = (
            select(Subject.id, Subject.name)
            .join(ClassSchedule, Subject.id == ClassSchedule.subject_id)
            .where(
                and_(
                    Subject.faculty_id == student.faculty_id,
                    ClassSchedule.faculty_id == student.faculty_id,
                    ClassSchedule.semester == student.semester
                )
            )
            .distinct()
        )
        subject_result = await db.execute(subject_query)
        subjects = {row.id: row.name for row in subject_result.all()}
        
        print(f"[DEBUG] Loaded {len(subjects)} subjects for faculty {student.faculty_id}, semester {student.semester}")
        
        # Group records by date
        daily_records = defaultdict(list)
        for record in all_records:
            date_obj = record.date.date() if hasattr(record.date, 'date') else record.date
            date_str = date_obj.strftime("%Y-%m-%d")
            
            status = record.status.value if hasattr(record.status, 'value') else str(record.status)
            
            daily_records[date_str].append({
                'id': record.id,
                'status': status,
                'subject_id': record.subject_id,
                'subject_name': subjects.get(record.subject_id, 'Unknown Subject'),
                'time_in': record.time_in,
                'time_out': record.time_out,
                'location': record.location,
                'notes': record.notes
            })
        
        # Build calendar data - day-by-day status
        calendar_days = []
        current = start_date
        
        print(f"[DEBUG] Building calendar days from {start_date} to {end_date}")
        
        while current <= end_date:
            date_str = current.strftime("%Y-%m-%d")
            records_for_day = daily_records.get(date_str, [])
            events_for_day = daily_events.get(date_str, [])
            
            class_events_for_day = [e for e in events_for_day if e.event_type == EventType.CLASS]
            holiday_event = next((e for e in events_for_day if e.event_type == EventType.HOLIDAY), None)

            scheduled_classes_count = len(class_events_for_day)
            
            today = date.today()
            is_future = current > today

            day_status = 'no_data'
            present_count, absent_count, late_count = 0, 0, 0

            if holiday_event:
                day_status = 'holiday'
            elif scheduled_classes_count > 0:
                # This is a CLASS day - check actual attendance records
                present_count = sum(1 for r in records_for_day if r['status'] == 'present')
                late_count = sum(1 for r in records_for_day if r['status'] == 'late')
                absent_records_count = sum(1 for r in records_for_day if r['status'] == 'absent')
                
                attended_count = present_count + late_count
                absent_count = absent_records_count
                total_records = len(records_for_day)
                
                # Get expected number of subjects for this student's semester/faculty
                expected_subjects_query = select(func.count(func.distinct(ClassSchedule.subject_id))).where(
                    and_(
                        ClassSchedule.faculty_id == student.faculty_id,
                        ClassSchedule.semester == student.semester,
                        ClassSchedule.is_active == True
                    )
                )
                expected_result = await db.execute(expected_subjects_query)
                expected_subjects = expected_result.scalar() or 0

                # INTELLIGENT DETECTION: Check if system had ANY activity on this date (from ANY student)
                system_was_active = current in dates_with_system_activity

                if is_future:
                    # Future dates or today (classes haven't happened yet)
                    day_status = 'no_data'
                elif total_records == 0 and not system_was_active and current < today:
                    # Past date: No records for this student AND no system activity at all = system was down
                    day_status = 'system_inactive'
                    print(f"[DETECTION] {current}: System was INACTIVE (no database activity from any student)")
                elif total_records == 0 and system_was_active:
                    # No records for this student BUT system was active (other students had records)
                    # This is a real absence
                    day_status = 'absent'
                    absent_count = 1
                    print(f"[DETECTION] {current}: Real ABSENCE (system active, student didn't attend)")
                elif total_records == 0 and current == today:
                    # Today but no records yet - classes may not have happened
                    day_status = 'no_data'
                elif total_records > 0:
                    # Has records - process attendance normally
                    # Check if these records were backfilled (created after the date)
                    actual_records_for_day = [r for r in all_records if (r.date.date() if hasattr(r.date, 'date') else r.date) == current]
                    backfilled = all(r.created_at.date() > current for r in actual_records_for_day)
                    if backfilled:
                        print(f"[DETECTION] {current}: Backfilled data detected (admin entered historical records)")
                    # Continue to normal processing below
                    if absent_records_count > 0 and attended_count > 0:
                        # Mix of attendance and absences = partial (some attended, some missed)
                        day_status = 'partial'
                    elif absent_records_count > 0 and attended_count == 0:
                        # Only absences, no attendance = absent for the day
                        day_status = 'absent'
                    elif total_records < expected_subjects:
                        # Has some attendance but missing records for some subjects = partial
                        # This is the key fix: if student attended 1 out of 5 classes, it's partial!
                        day_status = 'partial'
                    elif late_count > 0 and present_count == 0 and absent_records_count == 0:
                        # Only late arrivals (all classes) = late for the day
                        day_status = 'late'
                    elif present_count > 0 and absent_records_count == 0 and late_count == 0 and total_records >= expected_subjects:
                        # All records are present and we have records for all expected subjects = present for the day
                        day_status = 'present'
                    elif present_count > 0 and late_count > 0 and absent_records_count == 0 and total_records >= expected_subjects:
                        # Mix of present and late (all classes attended) = present for the day
                        day_status = 'present'
                    else:
                        # Fallback: if has any attendance but doesn't meet full criteria, mark as partial
                        day_status = 'partial' if attended_count > 0 else 'absent'

            elif records_for_day: # Records exist but no scheduled class (e.g., extra class)
                present_count = sum(1 for r in records_for_day if r['status'] == 'present')
                if present_count > 0:
                    day_status = 'present'

            calendar_days.append({
                'date': date_str,
                'day': current.day,
                'weekday': current.strftime('%A'),
                'status': day_status,
                'total_classes': scheduled_classes_count,
                'present': present_count,
                'absent': absent_count,
                'late': late_count,
                'records': records_for_day
            })
            
            current += timedelta(days=1)
        
        # Calculate monthly statistics
        total_classes_in_month = sum(day['total_classes'] for day in calendar_days if day['status'] not in ['no_data', 'holiday'])
        present_total = sum(day['present'] for day in calendar_days)
        absent_total = sum(day['absent'] for day in calendar_days)
        late_total = sum(day['late'] for day in calendar_days)
        
        excused_total = sum(1 for r in all_records if (r.status.value if hasattr(r.status, 'value') else str(r.status)) == 'excused')

        attended_total = present_total + late_total
        attendance_rate = round((attended_total / total_classes_in_month * 100), 2) if total_classes_in_month > 0 else 0.0
        
        # Subject-wise breakdown - only include subjects from student's faculty/semester
        subject_stats = defaultdict(lambda: {'total': 0, 'present': 0, 'absent': 0, 'late': 0})
        for record in all_records:
            subject_id = record.subject_id
            # Skip records for subjects not in this student's faculty/semester
            if subject_id not in subjects:
                continue
            
            subject_name = subjects.get(subject_id, 'Unknown Subject')
            status = record.status.value if hasattr(record.status, 'value') else str(record.status)
            
            subject_stats[subject_name]['total'] += 1
            if status == 'present':
                subject_stats[subject_name]['present'] += 1
            elif status == 'absent':
                subject_stats[subject_name]['absent'] += 1
            elif status == 'late':
                subject_stats[subject_name]['late'] += 1
        
        subject_breakdown = []
        for subject_name, stats in subject_stats.items():
            subject_rate = round((stats['present'] / stats['total'] * 100), 2) if stats['total'] > 0 else 0.0
            subject_breakdown.append({
                'subject_name': subject_name,
                'total_classes': stats['total'],
                'present': stats['present'],
                'absent': stats['absent'],
                'late': stats['late'],
                'attendance_rate': subject_rate
            })
        
        # Calculate attendance streak (consecutive days present)
        current_streak = 0
        longest_streak = 0
        temp_streak = 0
        
        sorted_days = sorted(calendar_days, key=lambda x: x['date'])
        
        for day in sorted_days:
            if day['status'] == 'present':
                temp_streak += 1
                longest_streak = max(longest_streak, temp_streak)
            elif day['status'] in ['absent', 'partial', 'late']:
                temp_streak = 0
        
        if sorted_days and sorted_days[-1]['status'] == 'present':
            current_streak = temp_streak
        
        print(f"[DEBUG] Successfully built calendar with {len(calendar_days)} days, {len(subject_breakdown)} subjects")
        
        return {
            'student_id': student_id,
            'student_name': student.user.full_name if student.user else 'Unknown',
            'student_number': student.student_id,
            'year': year,
            'month': month,
            'month_name': start_date.strftime('%B'),
            'calendar_days': calendar_days,
            'statistics': {
                'total_classes': total_classes_in_month,
                'present': present_total,
                'absent': absent_total,
                'late': late_total,
                'excused': excused_total,
                'attendance_rate': attendance_rate,
                'current_streak': current_streak,
                'longest_streak': longest_streak,
                'days_with_classes': len([d for d in calendar_days if d['total_classes'] > 0])
            },
            'subject_breakdown': sorted(subject_breakdown, key=lambda x: x['total_classes'], reverse=True)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Exception in get_student_attendance_calendar: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching calendar data: {str(e)}"
        )


@router.get("/{student_id}/summary")
async def get_student_attendance_summary(
    student_id: int,
    start_date: Optional[date] = Query(None, description="Start date for summary (defaults to semester start)"),
    end_date: Optional[date] = Query(None, description="End date for summary (defaults to today)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get overall attendance summary for a student across a date range.
    Useful for semester-wide or year-wide statistics.
    """
    
    try:
        # Verify student exists and load user relationship
        student_query = select(Student).options(
            selectinload(Student.user)
        ).where(Student.id == student_id)
        student_result = await db.execute(student_query)
        student = student_result.scalar_one_or_none()
        
        if not student:
            raise HTTPException(
                status_code=404,
                detail=f"Student with ID {student_id} not found"
            )
        
        # Default date range: current semester or year
        if not start_date:
            # Default to 6 months ago
            start_date = date.today() - timedelta(days=180)
        if not end_date:
            end_date = date.today()
        
        # Fetch all attendance records in range
        records_query = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.student_id == student_id,
                func.date(AttendanceRecord.date) >= start_date,
                func.date(AttendanceRecord.date) <= end_date
            )
        )
        
        result = await db.execute(records_query)
        all_records = result.scalars().all()
        
        # Calculate statistics
        total = len(all_records)
        present = sum(1 for r in all_records if (r.status.value if hasattr(r.status, 'value') else str(r.status)) == 'present')
        absent = sum(1 for r in all_records if (r.status.value if hasattr(r.status, 'value') else str(r.status)) == 'absent')
        late = sum(1 for r in all_records if (r.status.value if hasattr(r.status, 'value') else str(r.status)) == 'late')
        excused = sum(1 for r in all_records if (r.status.value if hasattr(r.status, 'value') else str(r.status)) == 'excused')
        
        attendance_rate = round((present / total * 100), 2) if total > 0 else 0.0
        
        return {
            'student_id': student_id,
            'student_name': student.user.full_name if student.user else 'Unknown',
            'period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'days': (end_date - start_date).days + 1
            },
            'statistics': {
                'total_classes': total,
                'present': present,
                'absent': absent,
                'late': late,
                'excused': excused,
                'attendance_rate': attendance_rate
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Exception in get_student_attendance_summary: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching summary data: {str(e)}"
        )
