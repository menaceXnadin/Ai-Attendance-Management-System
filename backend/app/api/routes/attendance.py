from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta
from collections import defaultdict
from app.core.database import get_db
from app.models import AttendanceRecord, Student, Subject, Faculty, AttendanceStatus, AttendanceMethod, User, AcademicEvent, EventType, UserRole, ClassSchedule
from app.api.dependencies import get_current_user
from app.services.auto_absent_service import auto_absent_service

router = APIRouter(prefix="/attendance", tags=["attendance"])

@router.get("")
async def get_attendance_records(
    student_id: Optional[int] = None,
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get attendance records with optional filters, including student and subject names."""
    # Join with Student, User, and Subject tables to get names
    query = select(
        AttendanceRecord,
        Student.student_id.label('student_number'),
        User.full_name.label('student_name'),
        Subject.name.label('subject_name'),
        Subject.code.label('subject_code')
    ).join(
        Student, AttendanceRecord.student_id == Student.id
    ).join(
        User, Student.user_id == User.id
    ).outerjoin(
        Subject, AttendanceRecord.subject_id == Subject.id
    )
    
    # Apply filters
    conditions = []
    if student_id:
        conditions.append(AttendanceRecord.student_id == student_id)
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
    
    if conditions:
        query = query.where(and_(*conditions))
    
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
        
        # DEBUG: Log the subject_id value
        print(f"[DEBUG BACKEND] Record ID {record.id}: subject_id = {record.subject_id}, type = {type(record.subject_id)}")
        print(f"[DEBUG BACKEND] Converted subjectId = {str(record.subject_id) if record.subject_id and record.subject_id != 0 else ''}")
        
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
            "marked_by": str(record.marked_by) if record.marked_by else "system"
        })
    
    return attendance_list

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
    
    # If no date range provided, use semester dates (assume Aug 1 - Dec 15 for current semester)
    if not start_date or not end_date:
        # For current semester - you can adjust these dates based on your academic calendar
        current_year = datetime.now().year
        if datetime.now().month >= 8:  # Fall semester
            start = date(current_year, 8, 1)
            end = date(current_year, 12, 15)
        else:  # Spring semester
            start = date(current_year, 1, 15)
            end = date(current_year, 5, 30)
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
        
        # Consider a day "present" if student attended majority of classes that day
        if present_subjects_that_day >= (total_subjects_that_day * 0.5):
            days_present += 1
        if present_subjects_that_day > 0:
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
        "present": days_present,  # Days with majority attendance
        "absent": total_semester_days - days_with_partial_attendance,  # Days with no attendance
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
        subject_id=attendance_data.get("subject_id")  # Include subject_id if provided
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
        status = attendance_map.get(student.id, "absent")  # Default to absent if no record
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
    # Get student ID for current user if they're a student
    student_id = None
    if current_user.role == UserRole.student:
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
    else:
        raise HTTPException(
            status_code=403,
            detail="Calendar endpoint is only available for students"
        )
    
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
    for date_str, summary in daily_summaries.items():
        # Determine overall status for the day
        total = summary['total']
        present = summary['present']
        absent = summary['absent'] 
        late = summary['late']
        excused = summary['excused']
        
        if total == 0:
            status = 'no_data'
        elif present == total:
            status = 'present'
        elif present == 0:
            status = 'absent'
        else:
            status = 'partial'
            
        calendar_data.append({
            'date': date_str,
            'status': status,
            'total_classes': total,
            'present_count': present,
            'absent_count': absent,
            'late_count': late,
            'excused_count': excused
        })
    
    # Sort by date
    calendar_data.sort(key=lambda x: x['date'])
    
    return {
        'calendar_data': calendar_data,
        'month': month,
        'year': year
    }

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
    """Mark attendance for multiple students at once."""
    subject_id = attendance_data.get("subject_id")
    date_str = attendance_data.get("date", datetime.now().strftime("%Y-%m-%d"))
    student_attendance = attendance_data.get("students", [])  # List of {student_id, status}
    
    target_date = datetime.strptime(date_str, "%Y-%m-%d")
    
    created_records = []
    updated_records = []
    
    for student_data in student_attendance:
        student_id = student_data.get("student_id")
        status = student_data.get("status", "present")
        
        # Check if attendance record already exists
        existing_record_query = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.student_id == student_id,
                AttendanceRecord.subject_id == subject_id,
                AttendanceRecord.date == target_date.date()
            )
        )
        
        result = await db.execute(existing_record_query)
        existing_record = result.scalar_one_or_none()
        
        if existing_record:
            # Update existing record
            existing_record.status = AttendanceStatus(status.lower())
            existing_record.marked_by = current_user.id
            updated_records.append(existing_record.id)
        else:
            # Create new record with proper field structure
            new_record = AttendanceRecord(
                student_id=student_id,
                subject_id=subject_id,
                date=target_date.date(),  # Date only
                time_in=target_date,  # Time when attendance was marked
                status=AttendanceStatus(status.lower()),
                marked_by=current_user.id,
                method=AttendanceMethod.manual
            )
            db.add(new_record)
            created_records.append(student_id)
    
    await db.commit()
    
    return {
        "message": "Bulk attendance marked successfully",
        "created_records": len(created_records),
        "updated_records": len(updated_records),
        "date": date_str,
        "subject_id": subject_id
    }

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
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get semester-wise subject attendance breakdown for a specific student."""
    try:
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
            select(Student).options(selectinload(Student.user)).where(Student.id == student_id)
        )
        student = student_result.scalar_one_or_none()
        
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        
        # Get subjects for student's faculty AND semester using ClassSchedule
        # Select specific columns to avoid JSON column issues
        subjects_query = (
            select(Subject.id, Subject.name, Subject.code, Subject.description, Subject.credits, Subject.faculty_id)
            .join(ClassSchedule, Subject.id == ClassSchedule.subject_id)
            .where(
                and_(
                    Subject.faculty_id == student.faculty_id,
                    ClassSchedule.semester == student.semester
                )
            )
            .distinct()  # Avoid duplicate subjects if they have multiple schedule entries
        )
        subjects_result = await db.execute(subjects_query)
        subject_rows = subjects_result.all()
        
        subject_breakdown = []
        
        for subject_row in subject_rows:
            # Create a subject object from the row data
            subject_id = subject_row.id
            subject_name = subject_row.name
            subject_code = subject_row.code
            subject_credits = subject_row.credits or 3
            
            # Get attendance records for this subject using simple query
            attendance_query = select(AttendanceRecord).where(
                and_(
                    AttendanceRecord.student_id == student_id,
                    AttendanceRecord.subject_id == subject_id
                )
            )
            
            attendance_result = await db.execute(attendance_query)
            attendance_records = attendance_result.scalars().all()
            
            # Calculate stats manually to avoid SQL function issues
            total_classes = len(attendance_records)
            attended = sum(1 for record in attendance_records if str(record.status).upper() == 'PRESENT')
            absent = sum(1 for record in attendance_records if str(record.status).upper() == 'ABSENT')
            late = sum(1 for record in attendance_records if str(record.status).upper() == 'LATE')
            
            # Calculate attendance percentage
            attendance_percentage = (attended / total_classes * 100) if total_classes > 0 else 0
            
            subject_breakdown.append({
                "subject_id": subject_id,
                "subject_name": subject_name,
                "subject_code": subject_code,
                "total_classes": total_classes,
                "attended": attended,
                "absent": absent,
                "late": late,
                "attendance_percentage": round(attendance_percentage, 2),
                "credits": subject_credits  # Already defaulted to 3 above
            })
        
        return subject_breakdown
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving student subject breakdown: {str(e)}"
        )
