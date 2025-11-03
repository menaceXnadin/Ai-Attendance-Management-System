from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_sync_db
from app.models import Faculty, Student, Subject, AttendanceRecord, AcademicEvent
from app.schemas import FacultyCreate, FacultyOut

router = APIRouter(prefix="/faculties", tags=["faculties"])

@router.get("/", response_model=list[FacultyOut])
def get_faculties(db: Session = Depends(get_sync_db)):
    return db.query(Faculty).all()

@router.post("/", response_model=FacultyOut)
def create_faculty(faculty: FacultyCreate, db: Session = Depends(get_sync_db)):
    # Validate faculty name uniqueness
    if db.query(Faculty).filter_by(name=faculty.name).first():
        raise HTTPException(status_code=400, detail="Faculty name already exists")
    
    # Validate faculty code format (4 uppercase letters)
    code = faculty.code.upper().strip()
    if len(code) != 4 or not code.isalpha():
        raise HTTPException(status_code=400, detail="Faculty code must be exactly 4 letters")
    
    # Validate faculty code uniqueness
    if db.query(Faculty).filter_by(code=code).first():
        raise HTTPException(status_code=400, detail=f"Faculty code '{code}' already exists")
    
    new_faculty = Faculty(
        name=faculty.name,
        code=code,
        description=faculty.description
    )
    db.add(new_faculty)
    db.commit()
    db.refresh(new_faculty)
    return new_faculty

@router.get("/{faculty_id}/cascade-preview")
def get_cascade_preview(faculty_id: int, db: Session = Depends(get_sync_db)):
    """
    Preview what will be deleted if this faculty is removed.
    Returns counts of affected records to show in confirmation dialog.
    
    NOTE: As of November 2, 2025, subjects now have CASCADE DELETE configured.
    """
    faculty = db.query(Faculty).get(faculty_id)
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    
    # Count students
    student_count = db.query(func.count(Student.id)).filter(Student.faculty_id == faculty_id).scalar()
    
    # Count subjects (NOW CASCADE DELETES)
    subject_count = db.query(func.count(Subject.id)).filter(Subject.faculty_id == faculty_id).scalar()
    
    # Count attendance records for students in this faculty
    student_ids = db.query(Student.id).filter(Student.faculty_id == faculty_id).subquery()
    attendance_count = db.query(func.count(AttendanceRecord.id)).filter(
        AttendanceRecord.student_id.in_(student_ids)
    ).scalar()
    
    # Count academic events
    event_count = db.query(func.count(AcademicEvent.id)).filter(
        AcademicEvent.faculty_id == faculty_id
    ).scalar()
    
    return {
        "faculty_id": faculty_id,
        "faculty_name": faculty.name,
        "faculty_code": faculty.code,
        "will_delete": {
            "students": student_count,
            "subjects": subject_count,  # MOVED: Now cascade deletes with faculty
            "attendance_records": attendance_count,
        },
        "will_orphan": {
            "academic_events": event_count,  # Events will have faculty_id set to NULL
        },
        "is_safe_to_delete": student_count == 0,
        "warning": f"Deleting this faculty will permanently remove {student_count} students, {subject_count} subjects, and {attendance_count} attendance records!" if student_count > 0 or subject_count > 0 else None
    }

@router.delete("/{faculty_id}")
def delete_faculty(faculty_id: int, force: bool = False, db: Session = Depends(get_sync_db)):
    """
    Delete a faculty. Requires force=true if faculty has students.
    """
    faculty = db.query(Faculty).get(faculty_id)
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    
    # Check if faculty has students
    student_count = db.query(func.count(Student.id)).filter(Student.faculty_id == faculty_id).scalar()
    
    if student_count > 0 and not force:
        raise HTTPException(
            status_code=400, 
            detail={
                "message": "Cannot delete faculty with students",
                "student_count": student_count,
                "suggestion": "Transfer students to another faculty first, or use force=true to confirm deletion"
            }
        )
    
    # Proceed with deletion
    db.delete(faculty)
    db.commit()
    
    return {
        "success": True,
        "message": f"Faculty '{faculty.name}' deleted successfully",
        "deleted_students": student_count
    }
