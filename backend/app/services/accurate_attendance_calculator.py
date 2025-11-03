"""
Accurate Attendance Calculator Service
Calculates attendance based on ACTUAL classes held (not just records created)

Key Features:
1. Counts total classes HELD for faculty/semester
2. Filters out system_inactive days
3. Filters out holidays and non-class events
4. Only counts EventType.CLASS events
5. Compares against ALL students to determine what was actually held
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, case, distinct
from datetime import date, datetime
from typing import Dict, Optional
from collections import defaultdict

from app.models import (
    Student, AttendanceRecord, AttendanceStatus, 
    AcademicEvent, EventType, Subject
)


async def get_total_classes_held(
    db: AsyncSession,
    faculty_id: int,
    semester: int,
    start_date: date,
    end_date: date
) -> int:
    """
    Calculate total number of classes ACTUALLY HELD for a faculty/semester.
    
    Logic:
    1. Count distinct (date, period, subject_id) combinations
    2. Only from dates where:
       - EventType = CLASS (not holiday, exam, etc.)
       - System was active (attendance records exist from ANY student)
       - Date is within semester range
    3. Filter by faculty and semester
    
    Returns:
        Total number of unique class sessions held
    """
    
    # Step 1: Get all dates with CLASS events (not holidays, exams, etc.)
    class_event_dates_query = select(distinct(AcademicEvent.start_date)).where(
        and_(
            AcademicEvent.event_type == EventType.CLASS,
            AcademicEvent.is_active == True,
            AcademicEvent.faculty_id == faculty_id,
            AcademicEvent.start_date >= start_date,
            AcademicEvent.start_date <= end_date
        )
    )
    
    class_dates_result = await db.execute(class_event_dates_query)
    class_event_dates = set(row[0] for row in class_dates_result.all())
    
    # Step 2: Get all dates where system was active (any student has records)
    active_dates_query = select(
        func.distinct(func.date(AttendanceRecord.date)).label('active_date')
    ).join(
        Student, AttendanceRecord.student_id == Student.id
    ).where(
        and_(
            Student.faculty_id == faculty_id,
            Student.semester == semester,
            func.date(AttendanceRecord.date) >= start_date,
            func.date(AttendanceRecord.date) <= end_date
        )
    )
    
    active_dates_result = await db.execute(active_dates_query)
    system_active_dates = set(row.active_date for row in active_dates_result.all())
    
    # Step 3: Valid class dates = CLASS events AND system was active
    # If no class events defined, fall back to dates with attendance records
    if class_event_dates:
        valid_class_dates = class_event_dates.intersection(system_active_dates)
    else:
        # Fallback: use system active dates (for systems without event management)
        valid_class_dates = system_active_dates
    
    # Step 4: Exclude explicit holidays
    holiday_dates_query = select(distinct(AcademicEvent.start_date)).where(
        and_(
            AcademicEvent.event_type.in_([EventType.HOLIDAY, EventType.CANCELLED_CLASS]),
            AcademicEvent.is_active == True,
            AcademicEvent.start_date >= start_date,
            AcademicEvent.start_date <= end_date
        )
    )
    
    holiday_dates_result = await db.execute(holiday_dates_query)
    holiday_dates = set(row[0] for row in holiday_dates_result.all())
    
    # Remove holidays from valid dates
    valid_class_dates = valid_class_dates - holiday_dates
    
    # Step 5: Count total class sessions on valid dates
    # Use attendance records from OTHER students to determine what classes were held
    total_classes_query = select(
        func.count(distinct(
            func.concat(
                func.date(AttendanceRecord.date), '|',
                func.coalesce(AttendanceRecord.period, 0), '|',
                func.coalesce(AttendanceRecord.subject_id, 0)
            )
        ))
    ).join(
        Student, AttendanceRecord.student_id == Student.id
    ).where(
        and_(
            Student.faculty_id == faculty_id,
            Student.semester == semester,
            func.date(AttendanceRecord.date).in_(valid_class_dates) if valid_class_dates else False
        )
    )
    
    result = await db.execute(total_classes_query)
    total_held = result.scalar() or 0
    
    return total_held


async def calculate_accurate_attendance(
    db: AsyncSession,
    student_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> Dict:
    """
    Calculate accurate attendance percentage for a student.
    
    CORRECTED APPROACH:
    - Aggregates from subject-wise breakdown (only subjects student is enrolled in)
    - Uses total classes HELD per subject (not just student's records)
    - Properly accounts for unmarked absences
    
    Args:
        db: Database session
        student_id: Student ID
        start_date: Start of period (defaults to semester start)
        end_date: End of period (defaults to today)
        
    Returns:
        Dictionary with accurate attendance metrics
    """
    
    # Get subject-wise breakdown (this correctly filters to student's enrolled subjects)
    subject_breakdown = await calculate_subject_wise_attendance(
        db=db,
        student_id=student_id,
        start_date=start_date,
        end_date=end_date
    )
    
    if not subject_breakdown:
        return {
            "total_classes_held": 0,
            "classes_attended": 0,
            "present_count": 0,
            "late_count": 0,
            "marked_absent_count": 0,
            "total_absences": 0,
            "unmarked_absences": 0,
            "attendance_percentage": 0.0,
            "risk_level": "unknown",
            "calculation_method": "accurate_per_subject_aggregate",
            "subjects": []
        }
    
    # Aggregate totals from subject breakdown
    total_classes_held = sum(s["total_classes"] for s in subject_breakdown)
    classes_attended = sum(s["attended"] for s in subject_breakdown)
    present_count = sum(s["present"] for s in subject_breakdown)
    late_count = sum(s["late"] for s in subject_breakdown)
    total_absences = sum(s["absent"] for s in subject_breakdown)
    
    # Calculate unmarked absences
    # Note: Need to get actual marked absent count
    student_query = select(Student).where(Student.id == student_id)
    student_result = await db.execute(student_query)
    student = student_result.scalar_one()
    
    if not start_date:
        end_date_val = end_date if end_date else date.today()
        current_year = end_date_val.year
        if student.semester % 2 == 1:
            start_date = date(current_year if end_date_val.month >= 8 else current_year - 1, 8, 1)
        else:
            start_date = date(current_year, 1, 1)
    
    if not end_date:
        end_date = date.today()
    
    # Get marked absent count
    marked_absent_query = select(func.count()).where(
        and_(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.status == AttendanceStatus.absent,
            func.date(AttendanceRecord.date) >= start_date,
            func.date(AttendanceRecord.date) <= end_date
        )
    )
    marked_absent_result = await db.execute(marked_absent_query)
    marked_absent_count = marked_absent_result.scalar() or 0
    
    unmarked_absences = total_absences - marked_absent_count
    excused_count = 0  # Not tracked in current implementation
    
    # Calculate percentage
    attendance_percentage = (classes_attended / total_classes_held * 100) if total_classes_held > 0 else 0
    
    # Determine risk level
    if attendance_percentage >= 90:
        risk_level = "low"
    elif attendance_percentage >= 80:
        risk_level = "medium"
    elif attendance_percentage >= 75:
        risk_level = "moderate"
    elif attendance_percentage >= 60:
        risk_level = "high"
    else:
        risk_level = "critical"
    
    # Get date range for metadata (from first subject if available)
    if subject_breakdown:
        # Note: start_date/end_date passed to calculate_subject_wise_attendance
        pass
    
    return {
        "total_classes_held": total_classes_held,
        "classes_attended": classes_attended,
        "present_count": present_count,
        "late_count": late_count,
        "marked_absent_count": marked_absent_count,
        "excused_count": excused_count,
        "total_absences": total_absences,
        "unmarked_absences": unmarked_absences,
        "attendance_percentage": round(attendance_percentage, 2),
        "risk_level": risk_level,
        "calculation_method": "accurate_per_subject_aggregate",
        "subjects": subject_breakdown
    }


async def calculate_subject_wise_attendance(
    db: AsyncSession,
    student_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> list:
    """
    Calculate accurate subject-wise attendance using calendar logic.
    
    CORRECTED APPROACH (matches student_calendar endpoint):
    1. Find dates with CLASS events
    2. Detect system activity (real-time) OR manual attendance
    3. Count classes held = active days × subjects scheduled per day
    4. Count student's actual attendance
    """
    
    # Get student
    student_query = select(Student).where(Student.id == student_id)
    student_result = await db.execute(student_query)
    student = student_result.scalar_one_or_none()
    
    if not student:
        return []
    
    # Date range
    if not end_date:
        end_date = date.today()
    if not start_date:
        # Default to current semester start
        current_year = end_date.year
        if student.semester % 2 == 1:
            start_date = date(current_year if end_date.month >= 8 else current_year - 1, 8, 1)
        else:
            start_date = date(current_year, 1, 1)
    
    # STEP 1: Get CLASS events from calendar
    from app.models import AcademicEvent, EventType
    events_query = select(AcademicEvent).where(
        and_(
            AcademicEvent.start_date >= start_date,
            AcademicEvent.start_date <= end_date,
            or_(
                AcademicEvent.faculty_id == student.faculty_id,
                AcademicEvent.faculty_id.is_(None)
            ),
            AcademicEvent.event_type == EventType.CLASS
        )
    )
    events_result = await db.execute(events_query)
    class_event_dates = {event.start_date for event in events_result.scalars().all()}
    
    # STEP 2: Detect system activity and manual attendance (same logic as student_calendar)
    global_activity_query = select(
        AttendanceRecord,
        Student.faculty_id,
        Student.semester
    ).join(
        Student, AttendanceRecord.student_id == Student.id
    ).where(
        and_(
            func.date(AttendanceRecord.date) >= start_date,
            func.date(AttendanceRecord.date) <= end_date
        )
    )
    
    global_result = await db.execute(global_activity_query)
    all_global_records = global_result.all()
    
    dates_with_system_activity = set()
    dates_with_manual_attendance = set()
    
    for record, record_faculty_id, record_semester in all_global_records:
        record_date = record.date.date() if hasattr(record.date, 'date') else record.date
        
        # System activity = record created same day as class
        if record.created_at.date() == record_date:
            dates_with_system_activity.add(record_date)
        
        # Manual attendance for THIS faculty+semester
        method = record.method.value if hasattr(record.method, 'value') else str(record.method) if record.method else None
        if method and method.lower() == 'manual':
            if record_faculty_id == student.faculty_id and record_semester == student.semester:
                dates_with_manual_attendance.add(record_date)
    
    # Dates with classes held = (system OR manual) AND class_event
    dates_with_classes_held = (dates_with_system_activity | dates_with_manual_attendance) & class_event_dates
    
    # STEP 3: Get class schedules to determine subjects per day
    from app.models import ClassSchedule
    schedules_query = select(ClassSchedule).where(
        and_(
            ClassSchedule.faculty_id == student.faculty_id,
            ClassSchedule.semester == student.semester,
            ClassSchedule.is_active == True
        )
    )
    schedules_result = await db.execute(schedules_query)
    class_schedules = schedules_result.scalars().all()
    
    # Group schedules by day of week and subject
    from collections import defaultdict
    schedules_by_day_subject = defaultdict(set)
    for schedule in class_schedules:
        day_name = schedule.day_of_week.name if hasattr(schedule.day_of_week, 'name') else str(schedule.day_of_week).upper()
        schedules_by_day_subject[day_name].add(schedule.subject_id)
    
    # STEP 4: Count classes held per subject (iterate through active days)
    classes_held_per_subject = defaultdict(int)
    
    for class_date in dates_with_classes_held:
        day_name = class_date.strftime('%A').upper()
        subjects_for_day = schedules_by_day_subject.get(day_name, set())
        
        for subject_id in subjects_for_day:
            classes_held_per_subject[subject_id] += 1
    
    # STEP 5: Get student's actual attendance records
    student_records_query = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.student_id == student_id,
            func.date(AttendanceRecord.date) >= start_date,
            func.date(AttendanceRecord.date) <= end_date
        )
    )
    student_records_result = await db.execute(student_records_query)
    student_records = student_records_result.scalars().all()
    
    # Count attendance by subject
    subject_attendance = defaultdict(lambda: {'present': 0, 'late': 0, 'absent': 0})
    for record in student_records:
        if record.subject_id:
            status = record.status
            if status == AttendanceStatus.present:
                subject_attendance[record.subject_id]['present'] += 1
            elif status == AttendanceStatus.late:
                subject_attendance[record.subject_id]['late'] += 1
            elif status == AttendanceStatus.absent:
                subject_attendance[record.subject_id]['absent'] += 1
    
    # STEP 6: Build subject breakdown
    subject_breakdown = []
    
    # Get all subject IDs from schedule (not just ones with records!)
    all_subject_ids = set()
    for subjects in schedules_by_day_subject.values():
        all_subject_ids.update(subjects)
    
    for subject_id in all_subject_ids:
        # Get subject info
        subject_query = select(Subject).where(Subject.id == subject_id)
        subject_result = await db.execute(subject_query)
        subject = subject_result.scalar_one_or_none()
        
        if not subject:
            continue
        
        total_held = classes_held_per_subject.get(subject_id, 0)
        
        if total_held == 0:
            continue  # Skip subjects with no classes held
        
        attendance = subject_attendance.get(subject_id, {'present': 0, 'late': 0, 'absent': 0})
        present = attendance['present']
        late = attendance['late']
        absent_marked = attendance['absent']
        
        attended = present + late
        absent_total = total_held - attended  # Total absent = held - attended
        
        percentage = (attended / total_held * 100) if total_held > 0 else 0
        
        subject_breakdown.append({
            "subject_id": subject_id,
            "subject_name": subject.name,
            "subject_code": subject.code,
            "total_classes": total_held,
            "attended": attended,
            "present": present,
            "late": late,
            "absent": absent_total,
            "attendance_percentage": round(percentage, 2)
        })
    
    return subject_breakdown
