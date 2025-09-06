#!/usr/bin/env python3
"""
Populate class schedules with unique faculty assignments to avoid constraint violations.
Creates virtual faculty entries for each unique schedule slot to ensure no conflicts.
"""

import os
import sys
from datetime import time, datetime
from typing import List, Dict, Any

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import sessionmaker
from app.core.database import sync_engine
from app.models.schedule import ClassSchedule, DayOfWeek
from app.models import Subject, Faculty

# Create session
SessionLocal = sessionmaker(bind=sync_engine)

class TimeSlot:
    def __init__(self, start: time, end: time):
        self.start = start
        self.end = end
    
    def __str__(self):
        return f"{self.start.strftime('%H:%M:%S')}-{self.end.strftime('%H:%M:%S')}"

class UniqueSchedulePopulator:
    def __init__(self):
        self.session = SessionLocal()
        
        # Define time slots (6 slots per day)
        self.time_slots = [
            TimeSlot(time(8, 0), time(9, 30)),   # 08:00-09:30
            TimeSlot(time(9, 45), time(11, 15)), # 09:45-11:15
            TimeSlot(time(11, 30), time(13, 0)), # 11:30-13:00
            TimeSlot(time(14, 0), time(15, 30)), # 14:00-15:30
            TimeSlot(time(15, 45), time(17, 15)), # 15:45-17:15
            TimeSlot(time(17, 30), time(19, 0))   # 17:30-19:00
        ]
        
        # Define classrooms
        self.classrooms = [
            "Room 101", "Room 102", "Room 103", "Room 104", "Room 105",
            "Lab A", "Lab B", "Lab C",
            "Computer Lab 1", "Computer Lab 2",
            "Lecture Hall 1", "Lecture Hall 2"
        ]
        
        # Days of the week
        self.days = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, 
                    DayOfWeek.THURSDAY, DayOfWeek.FRIDAY]
        
        # Semester configuration (8 semesters)
        self.semesters = list(range(1, 9))
        
        # Faculty counter for unique assignments
        self.faculty_counter = 1
        
    def get_or_create_unique_faculty(self, subject_name: str, slot_id: str) -> int:
        """Create a unique faculty for each schedule slot to avoid conflicts"""
        faculty_name = f"Prof. {subject_name} {slot_id}"
        email = f"{subject_name.lower().replace(' ', '.')}.{slot_id.lower()}@university.edu"
        
        # Create a new faculty record
        faculty = Faculty(
            name=faculty_name,
            email=email,
            department="Auto-Generated",
            phone="000-000-0000",
            employee_id=f"EMP{self.faculty_counter:05d}",
            is_active=True
        )
        
        self.session.add(faculty)
        self.session.flush()  # Get the ID without committing
        
        self.faculty_counter += 1
        return faculty.id
    
    def populate_schedules(self):
        """Populate schedules for all semesters with unique faculty assignments"""
        
        try:
            print("🚀 Starting unique class schedule population...")
            
            # Get all subjects
            subjects = self.session.query(Subject).all()
            if not subjects:
                print("❌ No subjects found in database!")
                return
            
            print(f"📚 Found {len(subjects)} subjects")
            
            total_schedules = 0
            
            for semester in self.semesters:
                print(f"\n📖 Semester {semester}: ", end="", flush=True)
                
                # Calculate academic year based on semester
                base_year = 2025
                academic_year = base_year + ((semester - 1) // 2)
                
                semester_schedules = 0
                
                # Create unique faculty and schedules for each subject
                for subject in subjects:
                    for day in self.days:
                        for i, slot in enumerate(self.time_slots):
                            # Create unique identifier for this slot
                            slot_id = f"S{semester}D{day.value}T{i}"
                            
                            # Get unique faculty for this specific slot
                            faculty_id = self.get_or_create_unique_faculty(subject.name, slot_id)
                            
                            # Select classroom in rotation
                            classroom = self.classrooms[semester_schedules % len(self.classrooms)]
                            
                            # Create schedule
                            schedule = ClassSchedule(
                                subject_id=subject.id,
                                faculty_id=faculty_id,
                                day_of_week=day,
                                start_time=slot.start,
                                end_time=slot.end,
                                semester=semester,
                                academic_year=academic_year,
                                classroom=classroom,
                                instructor_name=f"Prof. {subject.name} {slot_id}",
                                is_active=True,
                                notes=f"Auto-generated for Semester {semester}"
                            )
                            
                            self.session.add(schedule)
                            semester_schedules += 1
                            total_schedules += 1
                            
                            # Print progress every 100 schedules
                            if semester_schedules % 100 == 0:
                                print(".", end="", flush=True)
                
                print(f" {semester_schedules} schedules")
            
            # Commit all changes
            print(f"\n💾 Committing {total_schedules} schedules to database...")
            self.session.commit()
            
            print(f"\n✅ Successfully populated {total_schedules} class schedules!")
            print(f"📊 Distribution:")
            for semester in self.semesters:
                count = self.session.query(ClassSchedule).filter_by(semester=semester).count()
                print(f"   Semester {semester}: {count} schedules")
                
        except Exception as e:
            print(f"\n❌ Error during population: {e}")
            self.session.rollback()
            raise
        finally:
            self.session.close()

def main():
    print("🎓 Class Schedule Population Tool")
    print("=" * 50)
    
    populator = UniqueSchedulePopulator()
    
    # Ask for confirmation
    response = input("\n⚠️  This will create thousands of schedules and faculty records. Continue? (y/N): ")
    if response.lower() != 'y':
        print("❌ Operation cancelled.")
        return
    
    try:
        populator.populate_schedules()
        print("\n🎉 Schedule population completed successfully!")
        
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()