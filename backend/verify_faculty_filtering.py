#!/usr/bin/env python3

"""
Quick verification that faculty-based filtering works for all students
"""

import sys
import os
import django
from pathlib import Path

# Add the app directory to Python path
app_dir = Path(__file__).parent / "app"
sys.path.insert(0, str(app_dir))

# Setup Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

try:
    # Try FastAPI approach first
    from core.database import SessionLocal
    from models.student import Student
    from models.class_schedule import ClassSchedule  
    from models.subject import Subject
    from models.enums import DayOfWeek
    
    print("✅ Using FastAPI database connection")
    
    # Create session
    db = SessionLocal()
    
    # Get students from different faculties
    test_students = ['math2025012', 'STU2025001', 'STU2025002']
    today_day = DayOfWeek.MONDAY
    
    print("\n🔍 Faculty-based filtering verification:")
    print("=" * 50)
    
    for student_id in test_students:
        student = db.query(Student).filter(Student.student_id == student_id).first()
        if not student:
            print(f"❌ Student {student_id} not found")
            continue
            
        # Faculty-based filtering query
        schedules = db.query(ClassSchedule).join(Subject).filter(
            ClassSchedule.day_of_week == today_day,
            ClassSchedule.academic_year == 2025,
            ClassSchedule.is_active == True,
            ClassSchedule.semester == student.semester,
            Subject.faculty_id == student.faculty_id
        ).count()
        
        print(f"✅ {student_id}:")
        print(f"   Faculty: {student.faculty.name}")
        print(f"   Semester: {student.semester}")
        print(f"   Monday Schedules: {schedules}")
        print()
    
    db.close()
    print("🎉 Faculty-based filtering verification complete!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()