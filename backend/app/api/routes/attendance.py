from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, case, extract
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional
from datetime import datetime, date, timedelta
from collections import defaultdict
from app.core.database import get_db
from app.models import AttendanceRecord, Student, Subject, Faculty, AttendanceStatus, AttendanceMethod, User, AcademicEvent, EventType, UserRole, ClassSchedule
from app.utils.attendance import normalize_attendance_status
from app.api.dependencies import get_current_user
from app.services.auto_absent_service import auto_absent_service
from app.services.automatic_semester import AutomaticSemesterService
from app.services.accurate_attendance_calculator import calculate_subject_wise_attendance

router = APIRouter(prefix="/attendance", tags=["attendance"])

@router.get("")
async def get_attendance_records(
    student_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    status: Optional[str] = None,
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get attendance records with optional filters, including student and subject names."""
    
    # Auto-filter for students: if the current user is a student, only show their own records
    if current_user.role == UserRole.student:
        # Find the student record for this user
        student_query = select(Student).where(Student.user_id == current_user.id)
        student_result = await db.execute(student_query)
        student = student_result.scalar_one_or_none()
        if student:
            # Override student_id filter to current student's ID
            student_id = student.id
        else:
            # Student record not found, return empty
            return {
                "records": [],
                "total": 0,
                "hasMore": False
            }
    
    # Join with Student, User, Subject, and ClassSchedule tables to get names and semester info
    # Also check for cancelled classes in academic_events
    query = select(
        AttendanceRecord,
        Student.student_id.label('student_number'),
        User.full_name.label('student_name'),
        Subject.name.label('subject_name'),
        Subject.code.label('subject_code'),
        AcademicEvent.id.label('cancelled_event_id'),
        # Use the PostgreSQL ->> operator which works for json and jsonb to get text
        AcademicEvent.notification_settings.op('->>')('cancellation_reason').label('cancellation_reason')
    ).join(
        Student, AttendanceRecord.student_id == Student.id
    ).join(
        User, Student.user_id == User.id
    ).outerjoin(
        Subject, AttendanceRecord.subject_id == Subject.id
    ).outerjoin(
        ClassSchedule, and_(
            ClassSchedule.subject_id == Subject.id,
            ClassSchedule.faculty_id == Student.faculty_id
        )
    ).outerjoin(
        AcademicEvent, and_(
            AcademicEvent.subject_id == AttendanceRecord.subject_id,
            func.date(AcademicEvent.start_date) == AttendanceRecord.date,
            AcademicEvent.event_type == EventType.CANCELLED_CLASS,
            AcademicEvent.is_active == True
        )
    )
    
    # Apply filters
    conditions = []
    if student_id:
        conditions.append(AttendanceRecord.student_id == student_id)
    if subject_id:
        conditions.append(AttendanceRecord.subject_id == subject_id)
    if faculty_id:
        conditions.append(Student.faculty_id == faculty_id)
    if semester:
        conditions.append(ClassSchedule.semester == semester)
    if status:
        # Normalize status to match enum values
        status_lower = status.lower()
        if status_lower in ['present', 'absent', 'late', 'cancelled']:
            conditions.append(AttendanceRecord.status == status_lower)
    if date:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
        conditions.append(AttendanceRecord.date == target_date)
    if start_date and end_date:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        conditions.append(and_(
            AttendanceRecord.date >= start,
            AttendanceRecord.date <= end
        ))
    
    # Apply search filter (case-insensitive) against student name and student_number
    if search:
        pattern = f"%{search.lower()}%"
        conditions.append(or_(
            func.lower(User.full_name).like(pattern),
            func.lower(Student.student_id).like(pattern)
        ))

    if conditions:
        query = query.where(and_(*conditions))
    
    # Use distinct to prevent duplicates from ClassSchedule join
    query = query.distinct()
    
    # Get total count before applying pagination
    # Count with same joins/filters to reflect search and joins
    # Use distinct count to prevent duplicates from ClassSchedule join
    count_query = select(func.count(func.distinct(AttendanceRecord.id))).select_from(AttendanceRecord)
    count_query = count_query.join(Student, AttendanceRecord.student_id == Student.id)
    count_query = count_query.join(User, Student.user_id == User.id)
    count_query = count_query.outerjoin(Subject, AttendanceRecord.subject_id == Subject.id)
    count_query = count_query.outerjoin(
        ClassSchedule, and_(
            ClassSchedule.subject_id == Subject.id,
            ClassSchedule.faculty_id == Student.faculty_id
        )
    )
    if conditions:
        count_query = count_query.where(and_(*conditions))
    total_count_result = await db.execute(count_query)
    total_count = total_count_result.scalar() or 0
    
    # Order by date descending (most recent first), then by id descending
    query = query.order_by(AttendanceRecord.date.desc(), AttendanceRecord.id.desc())
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    records = result.all()
    
    # Transform to match frontend expectations with student and subject names
    attendance_list = []
    for record_data in records:
        record = record_data[0]  # AttendanceRecord object
        student_number = record_data[1]  # student_id from Student table
        student_name = record_data[2] or "Unknown Student"  # full name from User table
        subject_name = record_data[3] or "Unknown Subject"  # subject name
        subject_code = record_data[4] or "N/A"  # subject code
        cancelled_event_id = record_data[5]  # cancelled event ID (if exists)
        cancellation_reason = record_data[6]  # cancellation reason (if exists)
        
        # DEBUG: Log the subject_id value
        print(f"[DEBUG BACKEND] Record ID {record.id}: subject_id = {record.subject_id}, type = {type(record.subject_id)}")
        print(f"[DEBUG BACKEND] Converted subjectId = {str(record.subject_id) if record.subject_id and record.subject_id != 0 else ''}")
        print(f"[DEBUG BACKEND] Status: raw={record.status}, value={record.status.value if hasattr(record.status, 'value') else str(record.status)}, lower={record.status.value.lower() if hasattr(record.status, 'value') else str(record.status).lower()}")
        
        attendance_list.append({
            "id": str(record.id),
            "studentId": str(record.student_id),
            "studentNumber": student_number,  # Student ID (e.g., "STU001")
            "studentName": student_name,      # Full name from User table
            "subjectId": str(record.subject_id) if record.subject_id and record.subject_id != 0 else "",
            "subjectName": subject_name,      # Subject name
            "subjectCode": subject_code,      # Subject code
            "classId": str(record.subject_id) if record.subject_id and record.subject_id != 0 else "",  # Keep for backward compatibility
            "date": record.date.strftime("%Y-%m-%d"),
            "timeIn": record.time_in.strftime("%H:%M:%S") if record.time_in else None,
            "timeOut": record.time_out.strftime("%H:%M:%S") if record.time_out else None,
            "status": record.status.value.lower() if hasattr(record.status, 'value') else str(record.status).lower(),
            "method": record.method.value.lower() if hasattr(record.method, 'value') else str(record.method).lower(),
            "confidence_score": float(record.confidence_score) if record.confidence_score else None,
            "location": record.location,
            "notes": record.notes,
            "marked_by": str(record.marked_by) if record.marked_by else "system",
            "is_cancelled": cancelled_event_id is not None,
            "cancellation_reason": cancellation_reason
        })
    
    return {
        "records": attendance_list,
        "total": total_count,
        "skip": skip,
        "limit": limit,
        "hasMore": (skip + limit) < total_count
    }

@router.get("/summary")
async def get_attendance_summary(
    student_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get semester-based attendance summary statistics."""
    
    # Apply filters for the base query
    conditions = []
    
    # If student_id is not provided and current user is a student, get their student_id
    if not student_id and current_user.role == UserRole.student:
        # Find the student record for this user
        student_query = select(Student).where(Student.user_id == current_user.id)
        student_result = await db.execute(student_query)
        student_record = student_result.scalar_one_or_none()
        
        if student_record:
            student_id = student_record.id
        else:
            raise HTTPException(
                status_code=404,
                detail="Student record not found for current user"
            )
    
    if student_id:
        conditions.append(AttendanceRecord.student_id == student_id)
    
    # If no date range provided, use automatic semester detection
    if not start_date or not end_date:
        period = AutomaticSemesterService.get_current_period()
        start = period.start_date
        end = period.end_date
    else:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    
    conditions.append(and_(
        AttendanceRecord.date >= start,
        AttendanceRecord.date <= end
    ))

    # Calculate total academic days using new dynamic calculation
    # Only count CLASS events with attendance_required=TRUE
    async def get_academic_days_from_calendar(start_date: date, end_date: date) -> int:
        """Get total academic days from calendar events (class days with attendance required)"""
        class_days_query = select(func.count(AcademicEvent.id)).where(
            and_(
                AcademicEvent.start_date >= start_date,
                AcademicEvent.start_date <= end_date,
                AcademicEvent.event_type == EventType.CLASS,
                AcademicEvent.attendance_required == True,  # NEW: Only count attendance-required days
                AcademicEvent.is_active == True
            )
        )
        
        result = await db.execute(class_days_query)
        return result.scalar() or 0
    
    total_semester_days = await get_academic_days_from_calendar(start, end)

    # Get all unique academic days when student had attendance records
    unique_days_query = select(
        AttendanceRecord.date,
        func.count(AttendanceRecord.id).label('record_count'),
        func.sum(
            case((AttendanceRecord.status == 'present', 1), else_=0)
        ).label('present_count')
    ).where(and_(*conditions)).group_by(AttendanceRecord.date)
    
    result = await db.execute(unique_days_query)
    daily_attendance = result.all()
    
    # Calculate attendance metrics based on actual semester days
    days_with_attendance_records = len(daily_attendance)  # Days student had classes
    days_present = 0
    days_with_partial_attendance = 0
    
    for day_record in daily_attendance:
        date_obj = day_record.date
        total_subjects_that_day = day_record.record_count
        present_subjects_that_day = day_record.present_count
        
        # NEW RULE: All subjects attended = present, none = absent, anything in between = partial
        if present_subjects_that_day == total_subjects_that_day:
            days_present += 1
        if present_subjects_that_day > 0 and present_subjects_that_day < total_subjects_that_day:
            days_with_partial_attendance += 1
    
    # Calculate percentages based on total semester days
    attendance_percentage = (days_present / total_semester_days * 100) if total_semester_days > 0 else 0
    partial_attendance_percentage = (days_with_partial_attendance / total_semester_days * 100) if total_semester_days > 0 else 0
    
    # Get detailed status breakdown for additional info
    status_query = select(
        AttendanceRecord.status,
        func.count().label('count')
    ).where(and_(*conditions)).group_by(AttendanceRecord.status)
    
    status_result = await db.execute(status_query)
    status_counts = status_result.all()
    
    # Count individual records for detailed breakdown
    present_records = 0
    absent_records = 0
    late_records = 0
    excused_records = 0
    
    for status_row in status_counts:
        status_name = status_row[0].value.lower() if hasattr(status_row[0], 'value') else str(status_row[0]).lower()
        count = status_row[1]
        if status_name == 'present':
            present_records = count
        elif status_name == 'absent':
            absent_records = count
        elif status_name == 'late':
            late_records = count
        elif status_name == 'excused':
            excused_records = count
    
    total_records = present_records + absent_records + late_records + excused_records
    
    return {
        # SEMESTER-BASED METRICS (Primary)
        "present": days_present,  # Days with ALL subjects attended
        "absent": total_semester_days - days_present - days_with_partial_attendance,  # Days with NO attendance
        "late": 0,  # Not applicable for day-based calculation
        "excused": 0,  # Could be enhanced to track excused days
        "total": total_semester_days,  # Total academic days in semester
        "percentage_present": round(attendance_percentage, 1),
        
        # ADDITIONAL SEMESTER METRICS
        "days_with_any_attendance": days_with_partial_attendance,
        "partial_attendance_percentage": round(partial_attendance_percentage, 1),
        "semester_start_date": start.isoformat(),
        "semester_end_date": end.isoformat(),
        "days_with_records": days_with_attendance_records,  # Days student actually had classes
        
        # DETAILED RECORD-BASED METRICS (For detailed views)
        "present_records": present_records,
        "absent_records": absent_records,
        "late_records": late_records,
        "excused_records": excused_records,
        "total_records": total_records,
        "percentage_present_records": round((present_records / total_records * 100) if total_records > 0 else 0, 1)
    }

@router.post("")
async def create_attendance_record(
    attendance_data: dict,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new attendance record."""
    # Validate required fields
    if "subject_id" not in attendance_data or attendance_data["subject_id"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="subject_id is required and cannot be null"
        )
    
    # Create new attendance record with proper field structure
    current_time = datetime.now()
    attendance = AttendanceRecord(
        student_id=attendance_data["student_id"],
        date=current_time.date(),  # Date only
        time_in=current_time,  # Time when attendance was marked
        status=attendance_data["status"].upper(),
        marked_by=current_user.id,
        confidence_score=attendance_data.get("confidence_score", 1.0),
        notes=attendance_data.get("notes"),
        subject_id=attendance_data["subject_id"]  # Now required (validated above)
    )
    
    db.add(attendance)
    await db.commit()
    await db.refresh(attendance)
    
    return {
        "id": str(attendance.id),
        "studentId": str(attendance.student_id),
        "classId": "1",  # Default class ID
        "date": attendance.date.strftime("%Y-%m-%d"),
    "status": attendance.status.value.lower() if hasattr(attendance.status, 'value') else str(attendance.status).lower(),
        "confidence_score": attendance.confidence_score,
        "marked_by": str(attendance.marked_by)
    }

@router.get("/students-by-subject")
async def get_students_by_subject(
    faculty_id: int,
    semester: int,
    subject_id: int,
    date: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get students by faculty, semester, and subject with their attendance status."""
    # If no date provided, use today
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
    
    target_date = datetime.strptime(date, "%Y-%m-%d").date()
    today = datetime.now().date()
    
    # SYSTEM INACTIVE DETECTION: Check if system had ANY activity on this date
    # Query for any attendance record created on the same day as target_date
    global_activity_query = select(func.count(AttendanceRecord.id)).where(
        and_(
            func.date(AttendanceRecord.date) == target_date,
            func.date(AttendanceRecord.created_at) == target_date
        )
    )
    global_activity_result = await db.execute(global_activity_query)
    system_was_active = (global_activity_result.scalar() or 0) > 0
    
    print(f"[SYSTEM DETECTION] Date: {target_date}, Today: {today}, System Active: {system_was_active}")
    
    # Get students by faculty and semester
    students_query = select(Student).options(
        selectinload(Student.user)
    ).where(
        and_(
            Student.faculty_id == faculty_id,
            Student.semester == semester
        )
    )
    
    students_result = await db.execute(students_query)
    students = students_result.scalars().all()
    
    # Get attendance records for these students on the specified date and subject
    attendance_query = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.subject_id == subject_id,
            AttendanceRecord.date == target_date,
            AttendanceRecord.student_id.in_([s.id for s in students])
        )
    )
    
    attendance_result = await db.execute(attendance_query)
    attendance_records = attendance_result.scalars().all()
    
    # Create a map of student_id to attendance status
    attendance_map = {record.student_id: record.status for record in attendance_records}
    
    # Prepare response
    students_with_attendance = []
    for student in students:
        # Determine default status intelligently
        if student.id in attendance_map:
            status = attendance_map[student.id]
        elif target_date > today:
            status = "no_data"  # Future date
        elif target_date == today:
            status = "no_data"  # Today - classes may not have happened
        elif not system_was_active and target_date < today:
            status = "system_inactive"  # Past date with no system activity
            print(f"[DEBUG] Student {student.id} on {target_date}: SYSTEM_INACTIVE")
        else:
            status = "absent"  # Past date, system was active, but student has no record
            print(f"[DEBUG] Student {student.id} on {target_date}: ABSENT (system was active)")
        students_with_attendance.append({
            "id": student.id,
            "student_id": student.student_id,
            "name": student.user.full_name if student.user else "Unknown",
            "email": student.user.email if student.user else "",
            "semester": student.semester,
            "status": status.value.lower() if hasattr(status, 'value') else str(status).lower(),
            "faculty_id": student.faculty_id
        })
    
    return {
        "students": students_with_attendance,
        "date": date,
        "faculty_id": faculty_id,
        "semester": semester,
        "subject_id": subject_id
    }

@router.get("/calendar")
async def get_calendar_attendance(
    year: int,
    month: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get pre-aggregated attendance data for calendar display.
    Returns daily summaries for a specific month, optimized for calendar views.
    """
    try:
        # Get student for current user
        student_id = None
        student_record = None
        if current_user.role == UserRole.student:
            student_query = select(Student).options(
                selectinload(Student.faculty_rel)
            ).where(Student.user_id == current_user.id)
            student_result = await db.execute(student_query)
            student_record = student_result.scalar_one_or_none()
            
            if student_record:
                student_id = student_record.id
            else:
                raise HTTPException(
                    status_code=404,
                    detail="Student record not found for current user"
                )
        else:
            raise HTTPException(
                status_code=403,
                detail="Calendar endpoint is only available for students"
            )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting student record: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving student information: {str(e)}"
        )

    if not student_record.faculty_id or not student_record.semester:
        raise HTTPException(
            status_code=400,
            detail=f"Student {current_user.full_name} is not enrolled in a faculty or semester."
        )

    try:
        # Calculate month date range
        try:
            start_date = date(year, month, 1)
            # Get last day of month
            if month == 12:
                end_date = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(year, month + 1, 1) - timedelta(days=1)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid year or month"
            )
        
        # Fetch all academic events for the student's faculty and semester in the month
        # This is the correct way to determine if there are classes on a specific day
        events_query = select(AcademicEvent).where(
            and_(
                AcademicEvent.start_date.between(start_date, end_date),
                or_(
                    AcademicEvent.faculty_id == student_record.faculty_id,
                    AcademicEvent.faculty_id == None  # Global events
                )
            )
        )
        events_result = await db.execute(events_query)
        all_month_events = events_result.scalars().all()
        
        # Group events by date
        daily_events = defaultdict(list)
        for event in all_month_events:
            daily_events[event.start_date.strftime("%Y-%m-%d")].append(event)
        
        print(f"Found {len(all_month_events)} academic events for the month")
        
        # Get attendance records for the month - note: date is DateTime, need to convert
        records_query = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.student_id == student_id,
                func.date(AttendanceRecord.date) >= start_date,
                func.date(AttendanceRecord.date) <= end_date
            )
        ).order_by(AttendanceRecord.date)
        
        result = await db.execute(records_query)
        all_records = result.scalars().all()
        
        print(f"Found {len(all_records)} attendance records for the month")
        
        # Group by date and calculate summaries
        daily_summaries = defaultdict(lambda: {
            'total': 0, 'present': 0, 'absent': 0, 'late': 0, 'excused': 0
        })
        
        for record in all_records:
            # Convert datetime to date for grouping
            date_str = record.date.date().strftime("%Y-%m-%d") if hasattr(record.date, 'date') else record.date.strftime("%Y-%m-%d")
            daily_summaries[date_str]['total'] += 1
            
            status = record.status.value.lower() if hasattr(record.status, 'value') else str(record.status).lower()
            if status == 'present':
                daily_summaries[date_str]['present'] += 1
            elif status == 'absent':
                daily_summaries[date_str]['absent'] += 1
            elif status == 'late':
                daily_summaries[date_str]['late'] += 1
            elif status == 'excused':
                daily_summaries[date_str]['excused'] += 1
        
        # Convert to the expected format
        calendar_data = []
        current_day = start_date
        today = date.today()
        while current_day <= end_date:
            date_str = current_day.strftime("%Y-%m-%d")
            summary = daily_summaries.get(date_str)
            
            # Get academic events for this specific day
            events_for_day = daily_events.get(date_str, [])
            class_events_for_day = [e for e in events_for_day if e.event_type == EventType.CLASS]
            holiday_event = next((e for e in events_for_day if e.event_type == EventType.HOLIDAY), None)
            
            # Count scheduled classes based on actual academic events
            scheduled_classes_count = len(class_events_for_day)

            status = 'no_data'
            present_count = absent_count = late_count = excused_count = 0
            
            # Check if the current date is in the future
            is_future = current_day > today

            # Check for holidays first
            if holiday_event:
                status = 'holiday'
            elif scheduled_classes_count > 0:
                # This day has CLASS events - check actual attendance records
                if not summary:
                    # No attendance records for a CLASS day
                    if is_future:
                        status = 'no_data'
                    else:
                        # Past CLASS day with no records = absent
                        status = 'absent'
                        absent_count = 1  # Mark as absent for the day
                else:
                    # We have attendance records - analyze them
                    present_count = summary.get('present', 0)
                    late_count = summary.get('late', 0)
                    absent_count = summary.get('absent', 0)
                    excused_count = summary.get('excused', 0)
                    total_records = present_count + late_count + absent_count + excused_count
                    
                    # Get expected number of subjects for this student's semester/faculty
                    expected_subjects_query = select(func.count(func.distinct(ClassSchedule.subject_id))).where(
                        and_(
                            ClassSchedule.faculty_id == student_record.faculty_id,
                            ClassSchedule.semester == student_record.semester,
                            ClassSchedule.is_active == True
                        )
                    )
                    expected_result = await db.execute(expected_subjects_query)
                    expected_subjects = expected_result.scalar() or 0

                    if is_future:
                        # Future CLASS day - don't mark as absent yet
                        status = 'no_data'
                    elif absent_count > 0 and (present_count > 0 or late_count > 0):
                        # Mix of present/late AND absent = partial attendance
                        status = 'partial'
                    elif total_records < expected_subjects and absent_count == 0:
                        # Missing some records but none explicitly marked absent
                        # This means partial attendance (some classes not attended)
                        status = 'partial'
                    elif absent_count == 0 and total_records >= expected_subjects:
                        # All expected subjects attended (present or late) = present for the day
                        status = 'present'
                    elif absent_count > 0 and (present_count == 0 and late_count == 0):
                        # Only absences = absent for the day
                        status = 'absent'
                    elif present_count == 0 and late_count == 0 and absent_count == 0:
                        # No meaningful records = treat as absent
                        status = 'absent'
                    else:
                        # Fallback for edge cases
                        status = 'partial'
            elif summary:
                # Records exist on a day with no scheduled events (e.g., extra class)
                present_count = summary.get('present', 0)
                late_count = summary.get('late', 0)
                attended_count = present_count + late_count
                if attended_count > 0:
                    status = 'present' # Considered present as they attended something
            # else: no events and no records = no_data (default)
                
            calendar_data.append({
                'date': date_str,
                'status': status,
                'total_classes': scheduled_classes_count,
                'present_count': present_count,
                'absent_count': absent_count,
                'late_count': late_count,
                'excused_count': excused_count
            })
            current_day += timedelta(days=1)

        # Sort by date
        calendar_data.sort(key=lambda x: x['date'])
        
        print(f"Returning {len(calendar_data)} calendar entries")
        
        return {
            'calendar_data': calendar_data,
            'month': month,
            'year': year
        }
    except Exception as e:
        print(f"Error in calendar attendance processing: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error processing calendar data: {str(e)}"
        )

@router.get("/{attendance_id}")
async def get_attendance_record(
    attendance_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific attendance record."""
    result = await db.execute(select(AttendanceRecord).where(AttendanceRecord.id == attendance_id))
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendance record not found"
        )
    
    return {
        "id": str(record.id),
        "studentId": str(record.student_id),
        "classId": "1",
        "date": record.date.strftime("%Y-%m-%d"),
        "status": record.status.value.lower() if hasattr(record.status, 'value') else str(record.status).lower(),
        "confidence_score": record.confidence_score,
        "marked_by": str(record.marked_by)
    }

@router.post("/mark-bulk")
async def mark_bulk_attendance(
    attendance_data: dict,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark attendance for multiple students at once.
    
    If marking on a system-inactive date (no real-time records), automatically:
    1. Fill all subjects for marked students
    2. Cascade to all students in same faculty+semester
    """
    subject_id = attendance_data.get("subject_id")
    date_str = attendance_data.get("date", datetime.now().strftime("%Y-%m-%d"))
    student_attendance = attendance_data.get("students", [])  # List of {student_id, status}
    
    # DEBUG LOGGING
    print(f"\n{'='*80}")
    print(f"MARK-BULK ATTENDANCE CALLED")
    print(f"{'='*80}")
    print(f"Subject ID: {subject_id}")
    print(f"Date: {date_str}")
    print(f"Number of students in request: {len(student_attendance)}")
    print(f"Students data: {student_attendance}")
    print(f"Marked by user: {current_user.email} (ID: {current_user.id})")
    
    target_date = datetime.strptime(date_str, "%Y-%m-%d")
    target_date_only = target_date.date()
    
    # Get cohort info from first student to check cascade for THIS cohort only
    if not student_attendance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No students provided in request"
        )
    
    first_student_id = student_attendance[0].get("student_id")
    first_student_query = select(Student).where(Student.id == first_student_id)
    first_student_result = await db.execute(first_student_query)
    first_student = first_student_result.scalar_one_or_none()
    
    if not first_student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student {first_student_id} not found"
        )
    
    cohort_faculty_id = first_student.faculty_id
    cohort_semester = first_student.semester
    
    print(f"Cohort: Faculty ID {cohort_faculty_id}, Semester {cohort_semester}")
    
    # STEP 1: Detect if this is a system-inactive date (recovery mode)
    # Check for ANY existing records FOR THIS COHORT ONLY (not just real-time) to avoid cascade conflicts
    existing_records_check = (
        select(AttendanceRecord)
        .join(Student, AttendanceRecord.student_id == Student.id)
        .where(
            and_(
                func.date(AttendanceRecord.date) == target_date_only,
                Student.faculty_id == cohort_faculty_id,
                Student.semester == cohort_semester
            )
        )
        .limit(1)
    )
    existing_result = await db.execute(existing_records_check)
    has_any_records = existing_result.scalar_one_or_none() is not None
    
    # Only trigger cascade if there are NO records at all for this date IN THIS COHORT
    is_recovery_mode = not has_any_records
    
    print(f"Existing records on date: {has_any_records}")
    print(f"Recovery Mode (CASCADE): {is_recovery_mode}")
    print(f"{'='*80}\n")
    
    # NORMAL MODE: Save only explicit records (existing behavior)
    if not is_recovery_mode:
        print("  → NORMAL MODE: Saving only explicit records\n")
        created_records = []
        updated_records = []
        
        for student_data in student_attendance:
            student_id = student_data.get("student_id")
            status = student_data.get("status", "present")
            
            print(f"  Processing student_id={student_id}, status={status}")
            
            # Check if attendance record already exists
            existing_record_query = select(AttendanceRecord).where(
                and_(
                    AttendanceRecord.student_id == student_id,
                    AttendanceRecord.subject_id == subject_id,
                    AttendanceRecord.date == target_date_only
                )
            )
            
            result = await db.execute(existing_record_query)
            existing_record = result.scalar_one_or_none()
            
            if existing_record:
                print(f"    → Updating existing record (ID: {existing_record.id})")
                existing_record.status = AttendanceStatus(status.lower())
                existing_record.marked_by = current_user.id
                updated_records.append(existing_record.id)
            else:
                print(f"    → Creating new record")
                new_record = AttendanceRecord(
                    student_id=student_id,
                    subject_id=subject_id,
                    date=target_date_only,
                    time_in=target_date,
                    status=AttendanceStatus(status.lower()),
                    marked_by=current_user.id,
                    method=AttendanceMethod.manual
                )
                db.add(new_record)
                created_records.append(student_id)
        
        print(f"\n  Committing changes...")
        await db.commit()
        print(f"  ✓ Committed successfully")
        print(f"  Created: {len(created_records)} records")
        print(f"  Updated: {len(updated_records)} records")
        print(f"{'='*80}\n")
        
        return {
            "message": "Bulk attendance marked successfully",
            "mode": "normal",
            "created_records": len(created_records),
            "updated_records": len(updated_records),
            "date": date_str,
            "subject_id": subject_id
        }
    
    # CASCADE MODE: Auto-fill entire cohort
    print("  → CASCADE MODE: Auto-filling cohort\n")
    
    try:
        # Cohort info already fetched above (cohort_faculty_id, cohort_semester)
        print(f"  Cohort: Faculty ID {cohort_faculty_id}, Semester {cohort_semester}")
        
        # STEP 2: Get all students in cohort
        cohort_students_query = select(Student).where(
            and_(
                Student.faculty_id == cohort_faculty_id,
                Student.semester == cohort_semester
            )
        )
        cohort_students_result = await db.execute(cohort_students_query)
        all_students = cohort_students_result.scalars().all()
        
        print(f"  Total students in cohort: {len(all_students)}")
        
        # STEP 3: Get all subjects for cohort
        cohort_subjects_query = (
            select(ClassSchedule.subject_id)
            .distinct()
            .where(
                and_(
                    ClassSchedule.faculty_id == cohort_faculty_id,
                    ClassSchedule.semester == cohort_semester,
                    ClassSchedule.is_active == True
                )
            )
        )
        cohort_subjects_result = await db.execute(cohort_subjects_query)
        all_subject_ids = [row[0] for row in cohort_subjects_result.all()]
        
        print(f"  Total subjects in cohort: {len(all_subject_ids)}")
        
        # STEP 4: Build explicit records map from request
        explicit_records = {}  # (student_id, subject_id) -> status
        for student_data in student_attendance:
            sid = student_data.get("student_id")
            status_val = student_data.get("status", "present")
            explicit_records[(sid, subject_id)] = status_val
        
        print(f"  Explicit records from admin: {len(explicit_records)}")
        
        # STEP 5: Check for existing records to avoid conflicts
        existing_records_query = (
            select(AttendanceRecord)
            .join(Student, AttendanceRecord.student_id == Student.id)
            .where(
                and_(
                    AttendanceRecord.date == target_date_only,
                    Student.faculty_id == cohort_faculty_id,
                    Student.semester == cohort_semester
                )
            )
        )
        existing_records_result = await db.execute(existing_records_query)
        existing_records = existing_records_result.scalars().all()
        existing_combos = {(rec.student_id, rec.subject_id) for rec in existing_records}
        
        print(f"  Existing records on this date (cohort-specific): {len(existing_combos)}")
        
        # STEP 6: Build cascade records (all students × all subjects)
        records_to_create = []
        cascade_count = 0
        
        for student in all_students:
            for subj_id in all_subject_ids:
                combo = (student.id, subj_id)
                
                # Skip if record already exists
                if combo in existing_combos:
                    continue
                
                # Use explicit status if provided, otherwise absent
                if combo in explicit_records:
                    status_val = explicit_records[combo]
                else:
                    status_val = "absent"
                    cascade_count += 1
                
                records_to_create.append({
                    'student_id': student.id,
                    'subject_id': subj_id,
                    'date': target_date_only,
                    'time_in': datetime.now(),
                    'status': status_val.lower(),
                    'marked_by': current_user.id,
                    'method': 'manual',
                    'created_at': datetime.now(),
                    'updated_at': datetime.now()
                })
        
        print(f"  Total records to create: {len(records_to_create)}")
        print(f"    - Explicit (from admin): {len(explicit_records)}")
        print(f"    - Auto-absent (cascade): {cascade_count}")
        
        # STEP 7: Bulk insert with transaction safety
        if records_to_create:
            from sqlalchemy import insert
            insert_stmt = insert(AttendanceRecord).values(records_to_create)
            await db.execute(insert_stmt)
            await db.commit()
            print(f"  ✓ Bulk insert committed successfully")
        else:
            print(f"  ⚠ No new records to create (all already exist)")
        
        print(f"{'='*80}\n")
        
        return {
            "message": "Cascade attendance marked successfully",
            "mode": "cascade",
            "cohort": f"Faculty {cohort_faculty_id} Semester {cohort_semester}",
            "affected_students": len(all_students),
            "affected_subjects": len(all_subject_ids),
            "explicit_records": len(explicit_records),
            "auto_absent_records": cascade_count,
            "total_records_created": len(records_to_create),
            "date": date_str
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"  ✗ CASCADE FAILED: {str(e)}")
        print(f"{'='*80}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cascade attendance marking failed: {str(e)}"
        )

@router.post("/auto-absent")
async def trigger_auto_absent(
    target_date: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually trigger auto-absent processing for expired classes.
    
    Admin-only endpoint to process all expired classes and mark students
    as absent if they missed the attendance window.
    
    Args:
        target_date: Optional date in YYYY-MM-DD format (defaults to today)
    """
    # Check if user has admin privileges
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can trigger auto-absent processing"
        )
    
    try:
        # Process auto-absent for the specified date (or today)
        if target_date:
            # Validate date format
            try:
                process_date = datetime.strptime(target_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use YYYY-MM-DD"
                )
        else:
            process_date = date.today()
        
        # Temporarily override today's date in service if needed
        original_date = date.today()
        
        result = await auto_absent_service.process_auto_absent_for_today(db)
        
        return {
            "success": True,
            "message": "Auto-absent processing completed successfully",
            "processing_date": process_date.isoformat(),
            "triggered_by": current_user.email,
            "triggered_at": datetime.now().isoformat(),
            **result
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing auto-absent: {str(e)}"
        )

@router.get("/auto-absent/stats")
async def get_auto_absent_stats(
    target_date: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get statistics about auto-absent records for a specific date.
    
    Args:
        target_date: Optional date in YYYY-MM-DD format (defaults to today)
    """
    try:
        if target_date:
            # Validate date format
            try:
                process_date = datetime.strptime(target_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use YYYY-MM-DD"
                )
        else:
            process_date = None  # Service will use today
        
        stats = await auto_absent_service.get_auto_absent_stats(db, process_date)
        
        return {
            "success": True,
            "stats": stats,
            "requested_by": current_user.email,
            "requested_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving auto-absent stats: {str(e)}"
        )


@router.get("/student-subject-breakdown/{student_id}")
async def get_student_subject_breakdown(
    student_id: int,
    month: Optional[int] = None,  # Optional month filter (1-12), defaults to current month
    year: Optional[int] = None,   # Optional year filter, defaults to current year
    accurate: bool = True,  # NEW: Use accurate calculation (classes held vs just records)
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get subject attendance breakdown for a specific student, filtered by month/year (defaults to current month).
    
    Args:
        accurate: If True (default), calculates attendance based on total classes HELD (more accurate).
                  If False, uses old method (only counts student's own records).
    """
    try:
        # If accurate calculation requested, use the new service
        if accurate:
            # Use accurate calculation service
            subject_breakdown = await calculate_subject_wise_attendance(
                db=db,
                student_id=student_id
            )
            
            # Filter by month/year if specified
            if month is not None or year is not None:
                from datetime import date as date_class
                today = date_class.today()
                target_month = month if month is not None else today.month
                target_year = year if year is not None else today.year
                
                # Return with metadata
                return {
                    "month": target_month,
                    "year": target_year,
                    "month_name": date_class(target_year, target_month, 1).strftime("%B"),
                    "subjects": subject_breakdown,
                    "calculation_method": "accurate_classes_held"
                }
            
            return {
                "subjects": subject_breakdown,
                "calculation_method": "accurate_classes_held"
            }
        
        # OLD METHOD (kept for compatibility) - Falls through to existing logic below
        from datetime import date as date_class
        today = date_class.today()
        target_month = month if month is not None else today.month
        target_year = year if year is not None else today.year
        
        # Validate month
        if target_month < 1 or target_month > 12:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Month must be between 1 and 12"
            )
        
        # Check if current user can access this student's data
        if current_user.role == UserRole.student:
            # Students can only view their own data
            student_query = select(Student).where(Student.user_id == current_user.id)
            student_result = await db.execute(student_query)
            current_student = student_result.scalar_one_or_none()
            if not current_student or current_student.id != student_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this student's data"
                )
        
        # Get all subjects for the student's faculty and semester
        student_result = await db.execute(
            select(Student).options(joinedload(Student.user)).where(Student.id == student_id)
        )
        student = student_result.scalar_one_or_none()
        
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        
        print(f"[DEBUG] Student: {student.user.full_name if student.user else 'Unknown'}, Faculty ID: {student.faculty_id}, Semester: {student.semester}")
        
        # Get subjects for student's faculty AND semester using ClassSchedule
        # Select specific columns to avoid JSON column issues
        subjects_query = (
            select(Subject.id, Subject.name, Subject.code, Subject.description, Subject.credits, Subject.faculty_id)
            .join(ClassSchedule, Subject.id == ClassSchedule.subject_id)
            .where(
                and_(
                    Subject.faculty_id == student.faculty_id,
                    ClassSchedule.faculty_id == student.faculty_id,
                    ClassSchedule.semester == student.semester
                )
            )
            .distinct()  # Avoid duplicate subjects if they have multiple schedule entries
        )
        subjects_result = await db.execute(subjects_query)
        subject_rows = subjects_result.all()
        
        print(f"[DEBUG] Found {len(subject_rows)} subjects for faculty {student.faculty_id}, semester {student.semester}")
        for row in subject_rows[:5]:  # Log first 5 subjects
            print(f"  - {row.name} (ID: {row.id}, Faculty: {row.faculty_id})")
        
        subject_breakdown = []

        for subject_row in subject_rows:
            subject_id = subject_row.id
            subject_name = subject_row.name
            subject_code = subject_row.code
            subject_credits = subject_row.credits or 3

            # Get student's attendance records for this subject (filtered by month/year)
            attendance_query = select(AttendanceRecord).where(
                and_(
                    AttendanceRecord.student_id == student_id,
                    AttendanceRecord.subject_id == subject_id,
                    extract('month', AttendanceRecord.date) == target_month,
                    extract('year', AttendanceRecord.date) == target_year
                )
            )

            attendance_result = await db.execute(attendance_query)
            attendance_records = attendance_result.scalars().all()

            present_count = late_count = absent_count = excused_count = 0

            for record in attendance_records:
                status = normalize_attendance_status(record.status)
                if status == "present":
                    present_count += 1
                elif status == "late":
                    late_count += 1
                elif status == "absent":
                    absent_count += 1
                elif status == "excused":
                    excused_count += 1

            # Calculate total_classes as the ACTUAL number of classes held for this subject in the target month
            # Query distinct dates where students from the SAME faculty and semester have attendance
            # This ensures we only count classes relevant to this student's faculty/semester
            total_classes_query = (
                select(func.count(func.distinct(AttendanceRecord.date)))
                .join(Student, AttendanceRecord.student_id == Student.id)
                .where(
                    and_(
                        AttendanceRecord.subject_id == subject_id,
                        Student.faculty_id == student.faculty_id,
                        Student.semester == student.semester,
                        extract('month', AttendanceRecord.date) == target_month,
                        extract('year', AttendanceRecord.date) == target_year
                    )
                )
            )
            total_classes_result = await db.execute(total_classes_query)
            total_classes = total_classes_result.scalar() or 0
            
            # If no classes have been held for this subject at all, skip it
            if total_classes == 0:
                continue

            # Calculate attendance metrics for this subject
            # attended = classes where student was present (on time or late)
            # effective_total = total classes minus excused absences
            attended = present_count + late_count
            effective_total = total_classes - excused_count
            effective_total = effective_total if effective_total > 0 else total_classes

            attendance_percentage = (attended / effective_total * 100) if effective_total else 0

            subject_breakdown.append({
                "subject_id": subject_id,
                "subject_name": subject_name,
                "subject_code": subject_code,
                "total_classes": total_classes,
                "attended": attended,
                "present": present_count,
                "absent": absent_count,
                "late": late_count,
                "excused": excused_count,
                "attendance_percentage": round(attendance_percentage, 2),
                "credits": subject_credits
            })
        
        # Return data with metadata indicating the time period
        return {
            "month": target_month,
            "year": target_year,
            "month_name": date_class(target_year, target_month, 1).strftime("%B"),
            "subjects": subject_breakdown
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[ERROR] Exception in get_student_subject_breakdown: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving student subject breakdown: {str(e)}"
        )
