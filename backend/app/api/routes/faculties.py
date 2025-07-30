from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.database import get_sync_db
from app.models import Faculty
from app.schemas import FacultyCreate, FacultyOut

router = APIRouter(prefix="/faculties", tags=["faculties"])

@router.get("/", response_model=list[FacultyOut])
def get_faculties(db: Session = Depends(get_sync_db)):
    return db.query(Faculty).all()

@router.post("/", response_model=FacultyOut)
def create_faculty(faculty: FacultyCreate, db: Session = Depends(get_sync_db)):
    if db.query(Faculty).filter_by(name=faculty.name).first():
        raise HTTPException(status_code=400, detail="Faculty already exists")
    new_faculty = Faculty(name=faculty.name, description=faculty.description)
    db.add(new_faculty)
    db.commit()
    db.refresh(new_faculty)
    return new_faculty

@router.delete("/{faculty_id}", response_model=FacultyOut)
def delete_faculty(faculty_id: int, db: Session = Depends(get_sync_db)):
    faculty = db.query(Faculty).get(faculty_id)
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    db.delete(faculty)
    db.commit()
    return faculty
