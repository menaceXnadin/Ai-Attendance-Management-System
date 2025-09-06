from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date
from app.core.database import get_db
from app.models import AttendanceRecord, Student, Subject, Faculty, AttendanceStatus, AttendanceMethod
from app.api.dependencies import get_current_user

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
    """Get attendance records with optional filters."""
    query = select(AttendanceRecord)
    
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
    records = result.scalars().all()
    
    # Transform to match frontend expectations
    attendance_list = []
    for record in records:
        attendance_list.append({
            "id": str(record.id),
            "studentId": str(record.student_id),
            "classId": "1",  # Default class ID since we don't have subjects
            "date": record.date.strftime("%Y-%m-%d"),
            "status": record.status.value.lower() if hasattr(record.status, 'value') else str(record.status).lower(),
            "confidence_score": record.confidence_score,
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
    """Get attendance summary statistics."""
    query = select(AttendanceRecord.status, func.count().label('count'))
    
    # Apply filters
    conditions = []
    if student_id:
        conditions.append(AttendanceRecord.student_id == student_id)
    if start_date and end_date:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        conditions.append(and_(
            AttendanceRecord.date >= start,
            AttendanceRecord.date <= end
        ))
    
    if conditions:
        query = query.where(and_(*conditions))
    
    query = query.group_by(AttendanceRecord.status)
    result = await db.execute(query)
    status_counts = result.all()
    
    # Initialize counters
    present = 0
    absent = 0
    late = 0
    excused = 0
    
    # Count by status
    for status_row in status_counts:
        status_name = status_row[0].value.lower() if hasattr(status_row[0], 'value') else str(status_row[0]).lower()
        count = status_row[1]
        if status_name == 'present':
            present = count
        elif status_name == 'absent':
            absent = count
        elif status_name == 'late':
            late = count
        elif status_name == 'excused':
            excused = count
    
    total = present + absent + late + excused
    percentage_present = (present / total * 100) if total > 0 else 0
    
    return {
        "present": present,
        "absent": absent,
        "late": late,
        "excused": excused,
        "total": total,
        "percentage_present": round(percentage_present, 1)
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
