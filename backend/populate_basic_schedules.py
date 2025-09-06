#!/usr/bin/env python3
"""
Simplified Class Schedule Population Script
Creates a basic class schedule avoiding constraint conflicts
"""

import sys
import os
from datetime import time

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.schedule import ClassSchedule, DayOfWeek
from app.models import Subject, Faculty
from sqlalchemy.orm import joinedload

def populate_basic_schedules():
    """Create a basic class schedule for all subjects"""
    db = SessionLocal()
    
    try:
        print("🚀 Creating Basic Class Schedules...")
        
        # Clear existing schedules
        count = db.query(ClassSchedule).count()
        if count > 0:
            print(f"🗑️  Clearing {count} existing schedules...")
            db.query(ClassSchedule).delete()
            db.commit()
        
        # Get all subjects and faculties
        subjects = db.query(Subject).options(joinedload(Subject.faculty)).all()
        faculties = db.query(Faculty).all()
        
        print(f"📚 Found {len(subjects)} subjects")
        print(f"🏫 Found {len(faculties)} faculties")
        
        if not subjects:
            print("❌ No subjects found in database")
            return
        
        # Define time slots (6 time slots per day)
        time_slots = [
            (time(8, 0), time(9, 30)),   # 08:00 - 09:30
            (time(9, 45), time(11, 15)), # 09:45 - 11:15
            (time(11, 30), time(13, 0)), # 11:30 - 13:00
            (time(14, 0), time(15, 30)), # 14:00 - 15:30
            (time(15, 45), time(17, 15)), # 15:45 - 17:15
            (time(17, 30), time(19, 0))  # 17:30 - 19:00
        ]
        
        # Define working days
        days = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, 
                DayOfWeek.THURSDAY, DayOfWeek.FRIDAY]
        
        # Define classrooms
        classrooms = [
            "Room 101", "Room 102", "Room 103", "Room 104", "Room 105",
            "Lab A", "Lab B", "Lab C", 
            "Computer Lab 1", "Computer Lab 2",
            "Lecture Hall 1", "Lecture Hall 2"
        ]
        
        # Create schedules for all subjects
        total_created = 0
        slot_index = 0
        classroom_index = 0
        
        for semester in range(1, 9):  # Semesters 1-8
            semester_subjects = subjects[((semester-1) * len(subjects)//8):((semester) * len(subjects)//8)]
            
            if not semester_subjects:
                # If no subjects for this semester, assign a few from the beginning
                semester_subjects = subjects[:min(3, len(subjects))]
            
            print(f"\\n📖 Semester {semester}: {len(semester_subjects)} subjects")
            
            for subject in semester_subjects:
                # Create 2 classes per week for each subject
                for class_count in range(2):
                    day = days[slot_index % len(days)]
                    start_time, end_time = time_slots[slot_index % len(time_slots)]
                    classroom = classrooms[classroom_index % len(classrooms)]
                    
                    # Use subject's faculty or default to first faculty
                    faculty_id = subject.faculty_id if subject.faculty_id else (faculties[0].id if faculties else 1)
                    
                    # Create unique instructor name to avoid faculty conflicts
                    instructor_name = f"Prof. {subject.name[:10]} Instructor"
                    
                    schedule = ClassSchedule(
                        subject_id=subject.id,
                        faculty_id=faculty_id,
                        day_of_week=day,
                        start_time=start_time,
                        end_time=end_time,
                        semester=semester,
                        academic_year=2025 + ((semester-1) // 2),  # Spread across years
                        classroom=classroom,
                        instructor_name=instructor_name,
                        is_active=True,
                        notes=f"Auto-generated for Semester {semester}"
                    )
                    
                    db.add(schedule)
                    total_created += 1
                    
                    print(f"  ✅ {subject.name} - {day.value.title()} {start_time}-{end_time} in {classroom}")
                    
                    # Increment indices to avoid conflicts
                    slot_index += 1
                    classroom_index += 1
        
        # Commit all schedules
        db.commit()
        print(f"\\n🎉 Successfully created {total_created} class schedules!")
        
        # Show summary
        print("\\n📊 Schedule Summary:")
        for semester in range(1, 9):
            count = db.query(ClassSchedule).filter(ClassSchedule.semester == semester).count()
            print(f"  Semester {semester}: {count} schedules")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    populate_basic_schedules()