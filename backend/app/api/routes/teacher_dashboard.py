"""
Teacher Dashboard API Routes
Provides teacher-specific endpoints for viewing their courses, schedules, attendance, and analytics.
Implements subject-based teacher assignment with proper authorization.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, distinct
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timedelta
from app.core.database import get_db
from app.models import (
    Teacher, ClassSchedule, Subject, AttendanceRecord, Student, Faculty, 
    AttendanceStatus, AttendanceMethod, User, UserRole, AcademicEvent
)
from app.models.calendar import EventType
from app.api.dependencies import get_current_teacher, require_teacher_role, get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/teacher", tags=["Teacher Dashboard"])


# Pydantic models for request/response
class AttendanceMarkRequest(BaseModel):
    student_id: int
    subject_id: int
    date: datetime
    status: str  # present, absent, late
    period: Optional[int] = None
    time_slot: Optional[str] = None
    notes: Optional[str] = None


class BulkAttendanceMarkRequest(BaseModel):
    subject_id: int
    semester: int
    faculty_id: int
    date: datetime
    period: Optional[int] = None
    time_slot: Optional[str] = None
    attendance_records: List[Dict[str, Any]]  # [{"student_id": 1, "status": "present"}, ...]


class TeacherNotificationRequest(BaseModel):
    title: str
    message: str
    subject_id: int
    semester: int
    priority: str = "medium"  # low, medium, high
    type: str = "info"  # info, warning, success, danger


class CancelClassRequest(BaseModel):
    schedule_id: int
    date: str  # YYYY-MM-DD format
    reason: Optional[str] = "Teacher unavailable"
    notify_students: bool = True


@router.get("/dashboard")
async def get_teacher_dashboard(
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get teacher dashboard overview with key statistics and information.
    """
    # Get teacher's schedules
    schedules_result = await db.execute(
        select(ClassSchedule)
        .where(ClassSchedule.teacher_id == current_teacher.id)
        .where(ClassSchedule.is_active == True)
    )
    schedules = schedules_result.scalars().all()
    
    # Get unique subjects taught
    subject_ids = list(set([s.subject_id for s in schedules]))
    subjects_result = await db.execute(
        select(Subject).where(Subject.id.in_(subject_ids))
    )
    subjects = subjects_result.scalars().all()
    
    # Get UNIQUE students across all classes
    # Use DISTINCT to count unique students only once even if they appear in multiple schedules
    unique_faculty_semester_pairs = set()
    for schedule in schedules:
        unique_faculty_semester_pairs.add((schedule.faculty_id, schedule.semester))
    
    total_students = 0
    for faculty_id, semester in unique_faculty_semester_pairs:
        students_count_result = await db.execute(
            select(func.count(Student.id))
            .where(Student.faculty_id == faculty_id)
            .where(Student.semester == semester)
        )
        total_students += students_count_result.scalar_one()
    
    # Get today's classes
    today = datetime.now().date()
    current_day = today.strftime("%A").lower()
    
    today_schedules = [s for s in schedules if s.day_of_week.value == current_day]

    # Determine cancellations for today (per subject + faculty)
    subject_ids_today = list({s.subject_id for s in today_schedules})
    cancellations_by_key: Dict[tuple, AcademicEvent] = {}
    if subject_ids_today:
        events_result = await db.execute(
            select(AcademicEvent)
            .where(
                and_(
                    AcademicEvent.event_type == EventType.CANCELLED_CLASS,
                    AcademicEvent.start_date == today,
                    AcademicEvent.subject_id.in_(subject_ids_today),
                    AcademicEvent.is_active == True,
                )
            )
        )
        events = events_result.scalars().all()
        for ev in events:
            cancellations_by_key[(ev.subject_id, ev.faculty_id)] = ev
    
    # Get recent attendance statistics (last 7 days) - ONLY for this teacher's marked attendance
    week_ago = datetime.now() - timedelta(days=7)
    
    # Get student IDs that belong to this teacher's classes
    student_ids_set = set()
    for faculty_id, semester in unique_faculty_semester_pairs:
        students_result = await db.execute(
            select(Student.id)
            .where(Student.faculty_id == faculty_id)
            .where(Student.semester == semester)
        )
        student_ids_set.update([s for s in students_result.scalars().all()])
    
    # Now get attendance records for these students in the teacher's subjects
    if student_ids_set:
        attendance_stats_result = await db.execute(
            select(
                AttendanceRecord.status,
                func.count(AttendanceRecord.id).label("count")
            )
            .where(AttendanceRecord.date >= week_ago)
            .where(AttendanceRecord.subject_id.in_(subject_ids))
            .where(AttendanceRecord.student_id.in_(list(student_ids_set)))
            .group_by(AttendanceRecord.status)
        )
        attendance_stats = {row.status.value: row.count for row in attendance_stats_result.all()}
    else:
        attendance_stats = {}
    
    # Get teacher's faculty info
    faculty_name = None
    if current_teacher.faculty_id:
        faculty_result = await db.execute(
            select(Faculty).where(Faculty.id == current_teacher.faculty_id)
        )
        faculty = faculty_result.scalar_one_or_none()
        if faculty:
            faculty_name = faculty.name
    
    # Get teacher's email from user
    email = None
    phone = current_teacher.phone_number
    if current_teacher.user_id:
        user_result = await db.execute(
            select(User).where(User.id == current_teacher.user_id)
        )
        user = user_result.scalar_one_or_none()
        if user:
            email = user.email
    
    return {
        "teacher": {
            "id": current_teacher.id,
            "teacher_id": current_teacher.teacher_id,
            "name": current_teacher.name,
            "email": email,
            "phone": phone,
            "department": current_teacher.department,
            "office_location": current_teacher.office_location,
            "faculty_id": current_teacher.faculty_id,
            "faculty_name": faculty_name
        },
        "stats": {
            "total_subjects": len(subjects),
            "total_classes": len(schedules),
            "total_students": total_students,
            "classes_today": len(today_schedules)
        },
        "attendance_last_7_days": {
            "present": attendance_stats.get("present", 0),
            "absent": attendance_stats.get("absent", 0),
            "late": attendance_stats.get("late", 0)
        },
        "subjects": [
            {
                "id": s.id,
                "name": s.name,
                "code": s.code,
                "credits": s.credits,
                "semesters": sorted(list(set([
                    sch.semester for sch in schedules if sch.subject_id == s.id
                ])))  # List of semesters this subject is taught in
            } for s in subjects
        ],
        "today_schedule": [
            {
                "id": s.id,
                "subject_name": next((sub.name for sub in subjects if sub.id == s.subject_id), "Unknown"),
                "start_time": s.start_time.strftime("%H:%M"),
                "end_time": s.end_time.strftime("%H:%M"),
                "classroom": s.classroom,
                "semester": s.semester,
                # Cancellation status for THIS date only
                "is_cancelled": (
                    (s.subject_id, s.faculty_id) in cancellations_by_key
                ),
                "cancellation_reason": (
                    cancellations_by_key.get((s.subject_id, s.faculty_id)).notification_settings.get("cancellation_reason")
                    if (s.subject_id, s.faculty_id) in cancellations_by_key and cancellations_by_key.get((s.subject_id, s.faculty_id)).notification_settings
                    else None
                ),
            } for s in today_schedules
        ]
    }


@router.get("/schedule")
async def get_teacher_schedule(
    day_of_week: str = Query(None, description="Filter by day (monday, tuesday, etc.)"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get teacher's class schedule, optionally filtered by day.
    """
    query = select(ClassSchedule).where(
        and_(
            ClassSchedule.teacher_id == current_teacher.id,
            ClassSchedule.is_active == True
        )
    )
    
    if day_of_week:
        query = query.where(ClassSchedule.day_of_week == day_of_week.lower())
    
    result = await db.execute(query)
    schedules = result.scalars().all()
    
    # Get subjects for these schedules
    subject_ids = list(set([s.subject_id for s in schedules]))
    subjects_result = await db.execute(
        select(Subject).where(Subject.id.in_(subject_ids))
    )
    subjects = {s.id: s for s in subjects_result.scalars().all()}
    
    return [
        {
            "id": schedule.id,
            "day_of_week": schedule.day_of_week.value,
            "start_time": schedule.start_time.strftime("%H:%M"),
            "end_time": schedule.end_time.strftime("%H:%M"),
            "classroom": schedule.classroom,
            "semester": schedule.semester,
            "academic_year": schedule.academic_year,
            "subject": {
                "id": subjects[schedule.subject_id].id,
                "name": subjects[schedule.subject_id].name,
                "code": subjects[schedule.subject_id].code
            } if schedule.subject_id in subjects else None
        }
        for schedule in schedules
    ]


@router.get("/subjects/{subject_id}/students")
async def get_subject_students(
    subject_id: int,
    semester: int = Query(..., description="Semester number"),
    faculty_id: int = Query(None, description="Faculty ID filter"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of students enrolled in a specific subject.
    Teacher must be teaching this subject.
    """
    # Verify teacher teaches this subject (may have multiple schedules for same subject)
    schedule_result = await db.execute(
        select(ClassSchedule).where(
            and_(
                ClassSchedule.teacher_id == current_teacher.id,
                ClassSchedule.subject_id == subject_id,
                ClassSchedule.semester == semester
            )
        ).limit(1)
    )
    schedule = schedule_result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not teaching this subject"
        )
    
    # Get students in this faculty and semester with eager-loaded user to avoid async lazy loads
    query = select(Student).options(
        selectinload(Student.user)
    ).where(
        and_(
            Student.faculty_id == schedule.faculty_id,
            Student.semester == semester
        )
    )
    
    result = await db.execute(query)
    students = result.scalars().all()
    
    return [
        {
            "id": s.id,
            "student_id": s.student_id,
            "name": s.user.full_name if s.user else "Unknown",
            "email": s.user.email if s.user else "Unknown",
            "semester": s.semester,
            "year": s.year
        }
        for s in students
    ]


@router.get("/subjects/{subject_id}/students-with-attendance")
async def get_subject_students_with_attendance(
    subject_id: int,
    semester: int = Query(..., description="Semester number"),
    date: Optional[str] = Query(None, description="Date for attendance (YYYY-MM-DD)"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get students enrolled in a subject WITH their attendance status for a specific date.
    Similar to admin endpoint but with teacher authorization.
    """
    # Verify teacher teaches this subject
    schedule_result = await db.execute(
        select(ClassSchedule).where(
            and_(
                ClassSchedule.teacher_id == current_teacher.id,
                ClassSchedule.subject_id == subject_id,
                ClassSchedule.semester == semester
            )
        ).limit(1)
    )
    schedule = schedule_result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not teaching this subject"
        )
    
    # If no date provided, use today
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
    
    target_date = datetime.strptime(date, "%Y-%m-%d").date()
    today = datetime.now().date()
    
    # Check if system had ANY activity on this date
    global_activity_query = select(func.count(AttendanceRecord.id)).where(
        and_(
            func.date(AttendanceRecord.date) == target_date,
            func.date(AttendanceRecord.created_at) == target_date
        )
    )
    global_activity_result = await db.execute(global_activity_query)
    system_was_active = (global_activity_result.scalar() or 0) > 0
    
    # Get students in this faculty and semester
    students_query = select(Student).options(
        selectinload(Student.user)
    ).where(
        and_(
            Student.faculty_id == schedule.faculty_id,
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
            status_value = attendance_map[student.id]
        elif target_date > today:
            status_value = "no_data"  # Future date
        elif target_date == today:
            status_value = "no_data"  # Today - classes may not have happened yet
        elif not system_was_active and target_date < today:
            status_value = "system_inactive"  # Past date with no system activity
        else:
            status_value = "absent"  # Past date, system was active, but student has no record
        
        students_with_attendance.append({
            "id": student.id,
            "student_id": student.student_id,
            "name": student.user.full_name if student.user else "Unknown",
            "email": student.user.email if student.user else "",
            "semester": student.semester,
            "attendance_status": status_value.value.lower() if hasattr(status_value, 'value') else str(status_value).lower(),
            "faculty_id": student.faculty_id
        })
    
    # Check if class is cancelled for this date
    cancellation_check = await db.execute(
        select(AcademicEvent).where(
            and_(
                AcademicEvent.event_type == EventType.CANCELLED_CLASS,
                AcademicEvent.start_date == target_date,
                AcademicEvent.subject_id == subject_id,
                AcademicEvent.is_active == True
            )
        )
    )
    cancellation_event = cancellation_check.scalar_one_or_none()
    
    is_cancelled = cancellation_event is not None
    cancellation_reason = None
    if is_cancelled and cancellation_event.notification_settings:
        cancellation_reason = cancellation_event.notification_settings.get('cancellation_reason')
    
    return {
        "students": students_with_attendance,
        "date": date,
        "semester": semester,
        "subject_id": subject_id,
        "total_students": len(students_with_attendance),
        "present_count": sum(1 for s in students_with_attendance if s["attendance_status"] == "present"),
        "absent_count": sum(1 for s in students_with_attendance if s["attendance_status"] == "absent"),
        "is_cancelled": is_cancelled,
        "cancellation_reason": cancellation_reason
    }


@router.get("/subjects/{subject_id}/attendance")
async def get_subject_attendance(
    subject_id: int,
    start_date: date = Query(None, description="Start date for filtering"),
    end_date: date = Query(None, description="End date for filtering"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get attendance records for a specific subject.
    Teacher must be teaching this subject.
    """
    # Verify teacher teaches this subject (may have multiple schedules)
    schedule_result = await db.execute(
        select(ClassSchedule).where(
            and_(
                ClassSchedule.teacher_id == current_teacher.id,
                ClassSchedule.subject_id == subject_id
            )
        ).limit(1)
    )
    schedule = schedule_result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not teaching this subject"
        )
    
    # Build attendance query with eager-loaded student and user to avoid async lazy loads
    query = select(AttendanceRecord).options(
        selectinload(AttendanceRecord.student).selectinload(Student.user)
    ).where(AttendanceRecord.subject_id == subject_id)
    
    if start_date:
        query = query.where(AttendanceRecord.date >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.where(AttendanceRecord.date <= datetime.combine(end_date, datetime.max.time()))
    
    query = query.order_by(desc(AttendanceRecord.date))
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    return [
        {
            "id": r.id,
            "student_id": r.student.student_id,
            "student_name": r.student.user.full_name if r.student.user else "Unknown",
            "date": r.date.isoformat(),
            "status": r.status.value,
            "method": r.method.value,
            "confidence_score": float(r.confidence_score) if r.confidence_score else None,
            "period": r.period,
            "time_slot": r.time_slot
        }
        for r in records
    ]


@router.get("/subjects/{subject_id}/analytics")
async def get_subject_analytics(
    subject_id: int,
    semester: int = Query(..., description="Semester number"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get analytics for a specific subject including attendance patterns.
    Teacher must be teaching this subject.
    """
    # Verify teacher teaches this subject (may have multiple schedules)
    schedule_result = await db.execute(
        select(ClassSchedule).where(
            and_(
                ClassSchedule.teacher_id == current_teacher.id,
                ClassSchedule.subject_id == subject_id,
                ClassSchedule.semester == semester
            )
        ).limit(1)
    )
    schedule = schedule_result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not teaching this subject"
        )
    
    # Get students in this class with eager-loaded user
    students_result = await db.execute(
        select(Student).options(
            selectinload(Student.user)
        ).where(
            and_(
                Student.faculty_id == schedule.faculty_id,
                Student.semester == semester
            )
        )
    )
    students = students_result.scalars().all()
    student_ids = [s.id for s in students]
    
    # Get attendance statistics
    attendance_result = await db.execute(
        select(
            AttendanceRecord.status,
            func.count(AttendanceRecord.id).label("count")
        )
        .where(
            and_(
                AttendanceRecord.subject_id == subject_id,
                AttendanceRecord.student_id.in_(student_ids)
            )
        )
        .group_by(AttendanceRecord.status)
    )
    attendance_stats = {row.status.value: row.count for row in attendance_result.all()}
    
    # Calculate per-student attendance
    student_attendance = []
    for student in students:
        student_records = await db.execute(
            select(AttendanceRecord)
            .where(
                and_(
                    AttendanceRecord.student_id == student.id,
                    AttendanceRecord.subject_id == subject_id
                )
            )
        )
        records = student_records.scalars().all()
        
        total_classes = len(records)
        present_count = sum(1 for r in records if r.status == AttendanceStatus.present)
        absent_count = sum(1 for r in records if r.status == AttendanceStatus.absent)
        late_count = sum(1 for r in records if r.status == AttendanceStatus.late)
        
        attendance_percentage = (present_count / total_classes * 100) if total_classes > 0 else 0
        
        student_attendance.append({
            "student_id": student.student_id,
            "student_name": student.user.full_name if student.user else "Unknown",
            "total_classes": total_classes,
            "present": present_count,
            "absent": absent_count,
            "late": late_count,
            "attendance_percentage": round(attendance_percentage, 2)
        })
    
    # Sort by attendance percentage
    student_attendance.sort(key=lambda x: x["attendance_percentage"], reverse=True)
    
    return {
        "subject_id": subject_id,
        "total_students": len(students),
        "overall_stats": {
            "present": attendance_stats.get("present", 0),
            "absent": attendance_stats.get("absent", 0),
            "late": attendance_stats.get("late", 0)
        },
        "student_attendance": student_attendance
    }


# ============================================================================
# ENHANCED ATTENDANCE ENDPOINTS
# ============================================================================

@router.post("/attendance/mark")
async def mark_attendance(
    attendance_data: AttendanceMarkRequest,
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark attendance for a single student.
    Teacher must be assigned to teach this subject.
    """
    # Verify teacher teaches this subject
    schedule_result = await db.execute(
        select(ClassSchedule).where(
            and_(
                ClassSchedule.teacher_id == current_teacher.id,
                ClassSchedule.subject_id == attendance_data.subject_id
            )
        )
    )
    schedule = schedule_result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to mark attendance for this subject"
        )
    
    # Verify student exists and is in the correct faculty/semester
    student_result = await db.execute(
        select(Student).where(Student.id == attendance_data.student_id)
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Verify student is in the class (matching faculty and semester)
    if student.faculty_id != schedule.faculty_id or student.semester != schedule.semester:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is not enrolled in this class"
        )
    
    # Normalize status
    status_value = attendance_data.status.lower()
    if status_value not in ["present", "absent", "late"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status. Must be 'present', 'absent', or 'late'"
        )
    
    # Check if attendance record already exists for this student, subject, date, and period
    existing_record = await db.execute(
        select(AttendanceRecord).where(
            and_(
                AttendanceRecord.student_id == attendance_data.student_id,
                AttendanceRecord.subject_id == attendance_data.subject_id,
                AttendanceRecord.date == attendance_data.date,
                AttendanceRecord.period == attendance_data.period
            )
        )
    )
    existing = existing_record.scalar_one_or_none()
    
    if existing:
        # Update existing record
        existing.status = AttendanceStatus[status_value]
        existing.method = AttendanceMethod.manual
        existing.marked_by = current_user.id
        existing.time_in = datetime.now()
        existing.time_slot = attendance_data.time_slot
        existing.notes = attendance_data.notes
        await db.commit()
        await db.refresh(existing)
        
        return {
            "success": True,
            "message": "Attendance updated successfully",
            "attendance_id": existing.id,
            "updated": True
        }
    else:
        # Create new record
        new_record = AttendanceRecord(
            student_id=attendance_data.student_id,
            subject_id=attendance_data.subject_id,
            date=attendance_data.date,
            time_in=datetime.now(),
            period=attendance_data.period,
            time_slot=attendance_data.time_slot,
            status=AttendanceStatus[status_value],
            method=AttendanceMethod.manual,
            marked_by=current_user.id,
            notes=attendance_data.notes
        )
        db.add(new_record)
        await db.commit()
        await db.refresh(new_record)
        
        return {
            "success": True,
            "message": "Attendance marked successfully",
            "attendance_id": new_record.id,
            "updated": False
        }


@router.post("/attendance/bulk-mark")
async def bulk_mark_attendance(
    bulk_data: BulkAttendanceMarkRequest,
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark attendance for multiple students at once.
    Teacher must be assigned to teach this subject.
    """
    # Verify teacher teaches this subject
    schedule_result = await db.execute(
        select(ClassSchedule).where(
            and_(
                ClassSchedule.teacher_id == current_teacher.id,
                ClassSchedule.subject_id == bulk_data.subject_id,
                ClassSchedule.semester == bulk_data.semester,
                ClassSchedule.faculty_id == bulk_data.faculty_id
            )
        )
    )
    schedule = schedule_result.scalars().first()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to mark attendance for this subject/class"
        )
    
    # Process each attendance record
    success_count = 0
    failed_count = 0
    errors = []
    
    for record in bulk_data.attendance_records:
        try:
            student_id = record.get("student_id")
            status_value = record.get("status", "present").lower()
            
            if status_value not in ["present", "absent", "late"]:
                errors.append(f"Student {student_id}: Invalid status")
                failed_count += 1
                continue
            
            # Verify student exists
            student_result = await db.execute(
                select(Student).where(Student.id == student_id)
            )
            student = student_result.scalar_one_or_none()
            if not student:
                errors.append(f"Student {student_id}: Not found")
                failed_count += 1
                continue
            
            # Check if record exists
            existing_record = await db.execute(
                select(AttendanceRecord).where(
                    and_(
                        AttendanceRecord.student_id == student_id,
                        AttendanceRecord.subject_id == bulk_data.subject_id,
                        AttendanceRecord.date == bulk_data.date,
                        AttendanceRecord.period == bulk_data.period
                    )
                )
            )
            existing = existing_record.scalar_one_or_none()
            
            if existing:
                # Update
                existing.status = AttendanceStatus[status_value]
                existing.method = AttendanceMethod.manual
                existing.marked_by = current_user.id
                existing.time_in = datetime.now()
                existing.time_slot = bulk_data.time_slot
            else:
                # Create new
                new_record = AttendanceRecord(
                    student_id=student_id,
                    subject_id=bulk_data.subject_id,
                    date=bulk_data.date,
                    time_in=datetime.now(),
                    period=bulk_data.period,
                    time_slot=bulk_data.time_slot,
                    status=AttendanceStatus[status_value],
                    method=AttendanceMethod.manual,
                    marked_by=current_user.id
                )
                db.add(new_record)
            
            success_count += 1
            
        except Exception as e:
            errors.append(f"Student {record.get('student_id')}: {str(e)}")
            failed_count += 1
    
    await db.commit()
    
    return {
        "success": True,
        "message": f"Bulk attendance marking completed",
        "total_processed": len(bulk_data.attendance_records),
        "success_count": success_count,
        "failed_count": failed_count,
        "errors": errors if errors else None
    }


@router.get("/attendance/my-classes")
async def get_teacher_classes_for_attendance(
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all classes (subject + semester + faculty combinations) taught by the teacher.
    This is used to populate the attendance interface.
    """
    # Get all schedules for this teacher
    schedules_result = await db.execute(
        select(ClassSchedule).options(
            selectinload(ClassSchedule.subject),
            selectinload(ClassSchedule.faculty)
        ).where(
            and_(
                ClassSchedule.teacher_id == current_teacher.id,
                ClassSchedule.is_active == True
            )
        )
    )
    schedules = schedules_result.scalars().all()
    
    # Group by subject + semester + faculty
    classes_dict = {}
    for schedule in schedules:
        key = f"{schedule.subject_id}_{schedule.semester}_{schedule.faculty_id}"
        if key not in classes_dict:
            # Count students in this class
            student_count_result = await db.execute(
                select(func.count(Student.id)).where(
                    and_(
                        Student.faculty_id == schedule.faculty_id,
                        Student.semester == schedule.semester
                    )
                )
            )
            student_count = student_count_result.scalar_one()
            
            classes_dict[key] = {
                "subject_id": schedule.subject_id,
                "subject_name": schedule.subject.name if schedule.subject else "Unknown",
                "subject_code": schedule.subject.code if schedule.subject else "N/A",
                "semester": schedule.semester,
                "faculty_id": schedule.faculty_id,
                "faculty_name": schedule.faculty.name if schedule.faculty else "Unknown",
                "academic_year": schedule.academic_year,
                "student_count": student_count,
                "schedules": []
            }
        
        # Add schedule time info
        classes_dict[key]["schedules"].append({
            "day": schedule.day_of_week.value,
            "start_time": schedule.start_time.strftime("%H:%M"),
            "end_time": schedule.end_time.strftime("%H:%M"),
            "classroom": schedule.classroom
        })
    
    return list(classes_dict.values())


# ============================================================================
# CALENDAR ENDPOINTS (VIEW-ONLY for Teachers)
# ============================================================================

@router.get("/calendar")
async def get_teacher_calendar(
    start_date: date = Query(..., description="Start date for calendar view"),
    end_date: date = Query(..., description="End date for calendar view"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get calendar events for the teacher's assigned subjects.
    Teachers can VIEW calendar but cannot edit (read-only).
    """
    # Get teacher's subject IDs
    schedules_result = await db.execute(
        select(ClassSchedule.subject_id).where(
            and_(
                ClassSchedule.teacher_id == current_teacher.id,
                ClassSchedule.is_active == True
            )
        ).distinct()
    )
    subject_ids = [row[0] for row in schedules_result.all()]
    
    if not subject_ids:
        return []
    
    # Get academic events for these subjects
    events_result = await db.execute(
        select(AcademicEvent).options(
            selectinload(AcademicEvent.subject),
            selectinload(AcademicEvent.faculty)
        ).where(
            and_(
                AcademicEvent.subject_id.in_(subject_ids),
                AcademicEvent.start_date >= start_date,
                AcademicEvent.end_date <= end_date
            )
        ).order_by(AcademicEvent.start_date)
    )
    events = events_result.scalars().all()
    
    return [
        {
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "event_type": event.event_type.value,
            "start_date": event.start_date.isoformat(),
            "end_date": event.end_date.isoformat(),
            "subject_id": event.subject_id,
            "subject_name": event.subject.name if event.subject else None,
            "faculty_id": event.faculty_id,
            "faculty_name": event.faculty.name if event.faculty else None,
            "is_holiday": event.is_holiday,
            "read_only": True  # Indicate this is read-only for teachers
        }
        for event in events
    ]


# ============================================================================
# NOTIFICATION ENDPOINTS (Teacher-specific)
# ============================================================================

@router.post("/notifications/send")
async def send_teacher_notification(
    notification_data: TeacherNotificationRequest,
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send notification to students in a specific subject/class.
    Teacher must be assigned to teach this subject.
    """
    # Verify teacher teaches this subject
    schedule_result = await db.execute(
        select(ClassSchedule)
        .where(
            and_(
                ClassSchedule.teacher_id == current_teacher.id,
                ClassSchedule.subject_id == notification_data.subject_id,
                ClassSchedule.semester == notification_data.semester,
                ClassSchedule.is_active == True,
            )
        )
        .limit(1)
    )
    # Teacher may have multiple time slots for the same subject+semester; pick any active one
    schedule = schedule_result.scalars().first()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to send notifications for this subject"
        )
    
    # Get students in this class
    students_result = await db.execute(
        select(Student).where(
            and_(
                Student.faculty_id == schedule.faculty_id,
                Student.semester == notification_data.semester
            )
        )
    )
    students = students_result.scalars().all()
    
    if not students:
        return {
            "success": True,
            "message": "No students found in this class",
            "recipients_count": 0
        }
    
    # Import notification model
    from app.models.notifications import EnhancedNotification, NotificationScope, NotificationPriority, NotificationType
    
    # Map priority and type strings to enums
    priority_map = {
        "low": NotificationPriority.low,
        "medium": NotificationPriority.medium,
        "high": NotificationPriority.high
    }
    type_map = {
        "info": NotificationType.info,
        "warning": NotificationType.warning,
        "success": NotificationType.success,
        "danger": NotificationType.danger
    }
    
    # Create notification with subject-specific scope
    # We'll use faculty_specific scope since students are grouped by faculty
    notification = EnhancedNotification(
        title=notification_data.title,
        message=notification_data.message,
        type=type_map.get(notification_data.type, NotificationType.info),
        priority=priority_map.get(notification_data.priority, NotificationPriority.medium),
        scope=NotificationScope.faculty_specific,
        target_faculty_id=schedule.faculty_id,
        sender_id=current_user.id,
        sender_name=current_teacher.name,
        is_active=True,
        metadata={
            "subject_id": notification_data.subject_id,
            "semester": notification_data.semester,
            "sent_by_teacher": True,
            "teacher_id": current_teacher.id
        }
    )
    
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    
    return {
        "success": True,
        "message": f"Notification sent to {len(students)} students",
        "recipients_count": len(students),
        "notification_id": notification.id
    }


@router.post("/classes/cancel")
async def cancel_class(
    request: CancelClassRequest,
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancel a class for a specific date and optionally notify students.
    Creates a CANCELLED_CLASS event in the academic calendar.
    """
    # Parse date string to date object
    try:
        cancellation_date = datetime.strptime(request.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD"
        )
    
    # Verify schedule belongs to this teacher
    schedule_result = await db.execute(
        select(ClassSchedule).where(
            and_(
                ClassSchedule.id == request.schedule_id,
                ClassSchedule.teacher_id == current_teacher.id,
                ClassSchedule.is_active == True
            )
        )
    )
    schedule = schedule_result.scalar_one_or_none()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class schedule not found or you don't have permission"
        )
    
    # Get subject info
    subject_result = await db.execute(
        select(Subject).where(Subject.id == schedule.subject_id)
    )
    subject = subject_result.scalar_one_or_none()
    
    # Check if there's already a cancellation for this date
    existing_cancellation = await db.execute(
        select(AcademicEvent).where(
            and_(
                AcademicEvent.event_type == EventType.CANCELLED_CLASS,
                AcademicEvent.start_date == cancellation_date,
                AcademicEvent.subject_id == schedule.subject_id,
                AcademicEvent.faculty_id == schedule.faculty_id,
                AcademicEvent.is_active == True
            )
        )
    )
    if existing_cancellation.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This class is already marked as cancelled for this date"
        )
    
    # Create cancelled class event
    cancelled_event = AcademicEvent(
        title=f"Class Cancelled: {subject.name if subject else 'Class'}",
        description=f"Reason: {request.reason}\nTeacher: {current_teacher.name}",
        event_type=EventType.CANCELLED_CLASS,
        start_date=cancellation_date,
        end_date=cancellation_date,
        start_time=schedule.start_time,
        end_time=schedule.end_time,
        is_all_day=False,
        subject_id=schedule.subject_id,
        faculty_id=schedule.faculty_id,
        class_room=schedule.classroom,
        color_code="#6B7280",  # Gray color for cancelled classes
        is_recurring=False,
        attendance_required=False,  # No attendance needed for cancelled class
        created_by=current_user.id,
        is_active=True,
        notification_settings={
            "notify_students": request.notify_students,
            "cancellation_reason": request.reason
        }
    )
    
    db.add(cancelled_event)
    await db.commit()
    await db.refresh(cancelled_event)
    
    # Create attendance records with 'cancelled' status for all students in this class
    students_result = await db.execute(
        select(Student).where(
            and_(
                Student.faculty_id == schedule.faculty_id,
                Student.semester == schedule.semester
            )
        )
    )
    students = students_result.scalars().all()
    
    # Create cancelled attendance records for each student
    for student in students:
        # Check if attendance record already exists for this date/student/subject
        existing_attendance = await db.execute(
            select(AttendanceRecord).where(
                and_(
                    AttendanceRecord.student_id == student.id,
                    AttendanceRecord.subject_id == schedule.subject_id,
                    AttendanceRecord.date == cancellation_date
                )
            )
        )
        if not existing_attendance.scalar_one_or_none():
            # Create new cancelled attendance record
            attendance_record = AttendanceRecord(
                student_id=student.id,
                subject_id=schedule.subject_id,
                date=cancellation_date,
                status=AttendanceStatus.cancelled,
                method=AttendanceMethod.manual,
                marked_by=current_user.id,
                notes=f"Class cancelled: {request.reason}",
                location="N/A"
            )
            db.add(attendance_record)
    
    await db.commit()
    
    # Notify students if requested
    notification_id = None
    students_count = len(students)
    
    if request.notify_students:
        # Students list already fetched above when creating attendance records
        if students:
            from app.models.notifications import EnhancedNotification, NotificationScope, NotificationPriority, NotificationType
            
            # Create notification
            notification = EnhancedNotification(
                title=f"Class Cancelled: {subject.name if subject else 'Your Class'}",
                message=f"Your {subject.name if subject else 'class'} on {cancellation_date.strftime('%B %d, %Y')} at {schedule.start_time.strftime('%H:%M')} has been cancelled.\n\nReason: {request.reason}\n\nYou will be notified if the class is rescheduled.",
                type=NotificationType.warning,
                priority=NotificationPriority.high,
                scope=NotificationScope.faculty_specific,
                target_faculty_id=schedule.faculty_id,
                sender_id=current_user.id,
                sender_name=current_teacher.name,
                is_active=True,
                metadata={
                    "subject_id": schedule.subject_id,
                    "semester": schedule.semester,
                    "class_cancelled": True,
                    "cancellation_date": cancellation_date.isoformat(),
                    "original_time": schedule.start_time.strftime("%H:%M"),
                    "reason": request.reason,
                    "event_id": cancelled_event.id
                }
            )
            
            db.add(notification)
            await db.commit()
            await db.refresh(notification)
            notification_id = notification.id
    
    return {
        "success": True,
        "message": f"Class cancelled successfully{' and students notified' if request.notify_students else ''}",
        "event_id": cancelled_event.id,
        "notification_id": notification_id,
        "students_notified": students_count,
        "cancellation_date": cancellation_date.isoformat(),
        "subject_name": subject.name if subject else None
    }


@router.get("/notifications")
async def get_teacher_notifications(
    skip: int = 0,
    limit: int = 50,
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get notifications sent by this teacher or relevant to them.
    """
    from app.models.notifications import EnhancedNotification, NotificationReadReceipt
    
    # Get notifications sent by this teacher or global notifications
    notifications_result = await db.execute(
        select(EnhancedNotification).options(
            selectinload(EnhancedNotification.read_receipts)
        ).where(
            and_(
                EnhancedNotification.is_active == True,
                or_(
                    EnhancedNotification.sender_id == current_user.id,
                    EnhancedNotification.target_user_id == current_user.id
                )
            )
        ).order_by(desc(EnhancedNotification.created_at)).offset(skip).limit(limit)
    )
    notifications = notifications_result.scalars().all()
    
    return [
        {
            "id": notif.id,
            "title": notif.title,
            "message": notif.message,
            "type": notif.type.value,
            "priority": notif.priority.value,
            "scope": notif.scope.value,
            "created_at": notif.created_at.isoformat(),
            "metadata": notif.metadata,
            "is_read": any(r.user_id == current_user.id for r in notif.read_receipts)
        }
        for notif in notifications
    ]
