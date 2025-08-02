#!/usr/bin/env python3
"""Fix the math student's faculty field in the database"""

from app.core.database import get_sync_db
from app.models import Student
from sqlalchemy import update

def fix_math_student_full():
    db = next(get_sync_db())
    
    try:
        # Update student 111 to have both faculty_id = 7 and faculty = "Mathematics"
        result = db.execute(
            update(Student)
            .where(Student.id == 111)
            .values(faculty_id=7, faculty="Mathematics")
        )
        
        db.commit()
        
        print(f"✅ Updated {result.rowcount} student(s)")
        print("🎓 Student 111 now belongs to Mathematics faculty")
        
        # Verify the change
        student = db.query(Student).filter(Student.id == 111).first()
        if student:
            print(f"✅ Verified: Student {student.id}")
            print(f"   faculty_id: {student.faculty_id}")
            print(f"   faculty: {student.faculty}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_math_student_full()
