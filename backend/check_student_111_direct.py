#!/usr/bin/env python3
"""Check the database directly for student 111"""

from app.core.database import get_sync_db
from app.models import Student, Faculty
from sqlalchemy.orm import selectinload

def check_student_111():
    db = next(get_sync_db())
    
    try:
        # Query student 111 with faculty relationship
        student = db.query(Student).options(
            selectinload(Student.faculty_rel)
        ).filter(Student.id == 111).first()
        
        if student:
            print(f"📊 Student 111 details:")
            print(f"  ID: {student.id}")
            print(f"  Student ID: {student.student_id}")
            print(f"  Faculty (string): {student.faculty}")
            print(f"  Faculty ID: {student.faculty_id}")
            print(f"  Faculty Rel: {student.faculty_rel}")
            if student.faculty_rel:
                print(f"  Faculty Rel Name: {student.faculty_rel.name}")
                
            # Also check what faculty ID 7 is
            faculty_7 = db.query(Faculty).filter(Faculty.id == 7).first()
            if faculty_7:
                print(f"\n🎓 Faculty ID 7: {faculty_7.name}")
                
                # Check if there are any students with faculty_id = 7
                students_in_math = db.query(Student).filter(Student.faculty_id == 7).all()
                print(f"📈 Students with faculty_id = 7: {len(students_in_math)}")
                for s in students_in_math:
                    print(f"  - {s.id}: {s.student_id} ({s.faculty})")
            
        else:
            print("❌ Student 111 not found")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_student_111()
