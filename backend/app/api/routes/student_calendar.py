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
        
        # CRITICAL: Fetch ALL attendance records with student info for faculty+semester filtering
        # This is needed to detect if the system was active on any given day
        global_activity_query = (
            select(
                AttendanceRecord,
                Student.faculty_id.label('student_faculty_id'),
                Student.semester.label('student_semester')
            )
            .join(Student, AttendanceRecord.student_id == Student.id)
            .where(
                and_(
                    func.date(AttendanceRecord.date) >= start_date,
                    func.date(AttendanceRecord.date) <= end_date
                )
            )
            .order_by(AttendanceRecord.date)
        )
        
        global_result = await db.execute(global_activity_query)
        all_global_records = global_result.all()
        
        # Build a map of dates with system activity or manual attendance
        # FACULTY+SEMESTER SPECIFIC LOGIC: 
        # Only count manual attendance for THIS student's faculty and semester
        # This prevents CS Sem 1 manual attendance from affecting IT Sem 1 or CS Sem 2
        dates_with_system_activity = set()
        dates_with_manual_attendance = set()
        
        for row in all_global_records:
            # Unpack tuple: (AttendanceRecord, faculty_id, semester)
            record = row[0]
            record_faculty_id = row[1]
            record_semester = row[2]
            
            date_obj = record.date.date() if hasattr(record.date, 'date') else record.date
            
            # Check if record was created on the same day (real-time system activity)
            if record.created_at.date() == date_obj:
                dates_with_system_activity.add(date_obj)
            
            # Check if this is manual attendance for THIS faculty+semester
            # Manual attendance indicates classes were held, just marked retroactively
            method = record.method.value if hasattr(record.method, 'value') else str(record.method) if record.method else None
            if method and method.lower() == 'manual':
                # Only count if it's from a student in the SAME faculty AND semester
                if (record_faculty_id == student.faculty_id and 
                    record_semester == student.semester):
                    dates_with_manual_attendance.add(date_obj)
        
        # Combine: day is "active" if it has real-time OR manual attendance for this faculty+semester
        dates_with_classes_held = dates_with_system_activity.union(dates_with_manual_attendance)
        
        print(f"[DEBUG] Days with real-time system activity: {len(dates_with_system_activity)}")
        print(f"[DEBUG] Days with manual attendance (Faculty {student.faculty_id}, Sem {student.semester}): {len(dates_with_manual_attendance)}")
        print(f"[DEBUG] Total days with classes held: {len(dates_with_classes_held)}")
        
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
        
        # CRITICAL FIX: Deduplicate records by subject_id for each date
        # This fixes the issue where auto-absent system created multiple records for same subject
        deduplicated_daily_records = defaultdict(list)
        for date_str, records_for_day in daily_records.items():
            # Keep only the latest record for each subject on each day
            subject_map = {}
            for record in records_for_day:
                subject_id = record['subject_id']
                # Prioritize real attendance over auto-absent, then keep latest by ID
                if subject_id not in subject_map:
                    subject_map[subject_id] = record
                else:
                    existing = subject_map[subject_id]
                    # Keep non-auto-absent over auto-absent
                    if existing['location'] == 'AUTO_ABSENT_SYSTEM' and record['location'] != 'AUTO_ABSENT_SYSTEM':
                        subject_map[subject_id] = record
                    # If both same type, keep the one with higher ID (more recent)
                    elif record['id'] > existing['id']:
                        subject_map[subject_id] = record
            
            deduplicated_daily_records[date_str] = list(subject_map.values())
        
        daily_records = deduplicated_daily_records
        print(f"[DEBUG] After deduplication: {sum(len(v) for v in daily_records.values())} total records")
        
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

                # INTELLIGENT DETECTION: Check if classes were held on this date
                # Classes are considered "held" if:
                # 1. System was active (real-time records), OR
                # 2. Manual attendance exists (admin marked retroactively)
                classes_were_held = current in dates_with_classes_held

                if is_future:
                    # Future dates or today (classes haven't happened yet)
                    day_status = 'no_data'
                elif total_records == 0 and not classes_were_held and current < today:
                    # Past date: No records AND no evidence classes were held = system was down
                    day_status = 'system_inactive'
                    print(f"[DETECTION] {current}: System was INACTIVE (no attendance from any student)")
                elif total_records == 0 and classes_were_held:
                    # No records for this student BUT classes were held (other students have records)
                    # This is a real absence
                    day_status = 'absent'
                    absent_count = 1
                    print(f"[DETECTION] {current}: Real ABSENCE (classes held, student didn't attend)")
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

            # Total classes should be the actual number of attendance records (subjects) for that day
            total_classes_for_day = len(records_for_day) if records_for_day else 0
            
            calendar_days.append({
                'date': date_str,
                'day': current.day,
                'weekday': current.strftime('%A'),
                'status': day_status,
                'total_classes': total_classes_for_day,
                'present': present_count,
                'absent': absent_count,
                'late': late_count,
                'records': records_for_day
            })
            
            current += timedelta(days=1)
        
        # Calculate monthly statistics - COUNT UNIQUE DAYS, NOT RECORDS!
        # A day is "present" if student attended at least some classes
        # A day is "absent" if student missed ALL classes on that day
        # A day is "late" if student was late to at least one class
        
        days_present = sum(1 for day in calendar_days if day['status'] == 'present')
        days_absent = sum(1 for day in calendar_days if day['status'] == 'absent')
        days_late = sum(1 for day in calendar_days if day['status'] == 'late')
        days_partial = sum(1 for day in calendar_days if day['status'] == 'partial')
        
        # Total class days = days with status indicating classes were held
        total_class_days = sum(1 for day in calendar_days if day['status'] not in ['no_data', 'holiday', 'system_inactive'])
        
        # Days attended = present + late + partial (any attendance counts)
        days_attended = days_present + days_late + days_partial
        
        # Attendance rate based on days, not individual records
        attendance_rate = round((days_attended / total_class_days * 100), 2) if total_class_days > 0 else 0.0
        
        # Subject-wise breakdown - Count classes held (CLASS days × subjects scheduled)
        
        # Get class schedules for this student's faculty/semester
        schedules_query = select(ClassSchedule).where(
            and_(
                ClassSchedule.faculty_id == student.faculty_id,
                ClassSchedule.semester == student.semester,
                ClassSchedule.is_active == True
            )
        )
        schedules_result = await db.execute(schedules_query)
        class_schedules = schedules_result.scalars().all()
        
        # Group schedules by day of week
        schedules_by_day = defaultdict(list)
        for schedule in class_schedules:
            day = schedule.day_of_week.name if hasattr(schedule.day_of_week, 'name') else str(schedule.day_of_week).upper()
            subject_name = subjects.get(schedule.subject_id, 'Unknown Subject')
            schedules_by_day[day].append(subject_name)
        
        # Count classes held per subject (CLASS event days ONLY where classes were actually held)
        classes_held_per_subject = defaultdict(int)
        
        # Iterate through the month and count CLASS days where classes were held
        current = start_date
        while current <= end_date:
            date_str = current.strftime("%Y-%m-%d")
            events_for_day = daily_events.get(date_str, [])
            
            # Check if this day has a CLASS event (not a holiday)
            has_class = any(e.event_type == EventType.CLASS for e in events_for_day)
            is_holiday = any(e.event_type == EventType.HOLIDAY for e in events_for_day)
            
            # CRITICAL FIX: Count days where classes were ACTUALLY HELD
            # This includes both real-time system activity AND manual attendance
            classes_were_held_on_date = current in dates_with_classes_held
            
            if has_class and not is_holiday and classes_were_held_on_date:
                # Get the day of week and count subjects scheduled for this day
                day_name = current.strftime('%A').upper()
                subjects_for_day = schedules_by_day.get(day_name, [])
                
                for subject_name in subjects_for_day:
                    classes_held_per_subject[subject_name] += 1
            
            current += timedelta(days=1)
        
        print(f"[DEBUG] Classes held per subject (real-time + manual): {dict(classes_held_per_subject)}")
        
        # Count actual attendance status per subject
        subject_stats = defaultdict(lambda: {'present': 0, 'absent': 0, 'late': 0})
        
        for record in all_records:
            subject_id = record.subject_id
            # Skip records for subjects not in this student's faculty/semester
            if subject_id not in subjects:
                continue
            
            subject_name = subjects.get(subject_id, 'Unknown Subject')
            status = record.status.value if hasattr(record.status, 'value') else str(record.status)
            
            if status == 'present':
                subject_stats[subject_name]['present'] += 1
            elif status == 'absent':
                subject_stats[subject_name]['absent'] += 1
            elif status == 'late':
                subject_stats[subject_name]['late'] += 1
        
        # Build subject breakdown using classes held as total
        subject_breakdown = []
        for subject_name in subjects.values():
            total_classes = classes_held_per_subject.get(subject_name, 0)
            
            if total_classes == 0:
                continue  # Skip subjects with no classes held in this month
            
            stats = subject_stats.get(subject_name, {'present': 0, 'absent': 0, 'late': 0})
            present = stats['present']
            late = stats['late']
            absent = stats['absent']
            attended = present + late
            subject_rate = round((attended / total_classes * 100), 2) if total_classes > 0 else 0.0
            
            subject_breakdown.append({
                'subject_name': subject_name,
                'total_classes': total_classes,  # Classes held (CLASS event days)
                'present': present,
                'absent': absent,
                'late': late,
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
                'total_classes': total_class_days,  # Now counting unique days
                'present': days_present,  # Days fully present
                'absent': days_absent,  # Days fully absent
                'late': days_late,  # Days with late arrival
                'partial': days_partial,  # Days with partial attendance
                'attendance_rate': attendance_rate,
                'current_streak': current_streak,
                'longest_streak': longest_streak,
                'days_with_classes': total_class_days
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
        
        # Calculate statistics - COUNT UNIQUE DAYS, NOT INDIVIDUAL RECORDS
        # Group records by date
        from collections import defaultdict
        records_by_date = defaultdict(list)
        for record in all_records:
            record_date = record.date.date() if isinstance(record.date, datetime) else record.date
            records_by_date[record_date].append(record)
        
        # Count days based on overall status
        days_present = 0
        days_absent = 0
        days_late = 0
        days_partial = 0
        
        for date_key, day_records in records_by_date.items():
            present_count = sum(1 for r in day_records if r.status.value == 'present')
            absent_count = sum(1 for r in day_records if r.status.value == 'absent')
            late_count = sum(1 for r in day_records if r.status.value == 'late')
            total_records = len(day_records)
            
            # Determine day status
            if absent_count == total_records:
                # All classes absent = absent day
                days_absent += 1
            elif present_count == total_records:
                # All classes present = present day
                days_present += 1
            elif late_count == total_records:
                # All classes late = late day
                days_late += 1
            elif present_count > 0 or late_count > 0:
                # Mix of attendance = partial day
                days_partial += 1
            else:
                # Shouldn't happen, but count as absent
                days_absent += 1
        
        total_class_days = len(records_by_date)
        days_attended = days_present + days_late + days_partial
        attendance_rate = round((days_attended / total_class_days * 100), 2) if total_class_days > 0 else 0.0
        
        return {
            'student_id': student_id,
            'student_name': student.user.full_name if student.user else 'Unknown',
            'period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'days': (end_date - start_date).days + 1
            },
            'statistics': {
                'total_classes': total_class_days,
                'present': days_present,
                'absent': days_absent,
                'late': days_late,
                'partial': days_partial,
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
