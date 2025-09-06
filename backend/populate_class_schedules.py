#!/usr/bin/env python3
"""
Comprehensive Class Schedule Population Script
Automatically populates class schedules for all semesters using existing database data
"""

import sys
import os
from datetime import time, datetime, date
from typing import List, Dict, Tuple

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.schedule import ClassSchedule, DayOfWeek
from app.models import Subject, Student, Faculty
from app.models.calendar import AcademicEvent, EventType
from sqlalchemy.orm import joinedload

class TimeSlot:
    """Represents a time slot for classes"""
    def __init__(self, start_hour: int, start_minute: int, duration_minutes: int = 90):
        self.start_time = time(start_hour, start_minute)
        end_hour = start_hour + (start_minute + duration_minutes) // 60
        end_minute = (start_minute + duration_minutes) % 60
        self.end_time = time(end_hour, end_minute)
    
    def __str__(self):
        return f"{self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')}"

class ClassSchedulePopulator:
    """Main class for populating class schedules"""
    
    def __init__(self):
        self.db = SessionLocal()
        self.current_year = 2025
        
        # Define standard time slots for different class periods
        self.time_slots = [
            TimeSlot(8, 0, 90),   # 08:00 - 09:30
            TimeSlot(9, 45, 90),  # 09:45 - 11:15
            TimeSlot(11, 30, 90), # 11:30 - 13:00
            TimeSlot(14, 0, 90),  # 14:00 - 15:30 (After lunch)
            TimeSlot(15, 45, 90), # 15:45 - 17:15
            TimeSlot(17, 30, 90), # 17:30 - 19:00
        ]
        
        # Define classrooms
        self.classrooms = [
            "Room 101", "Room 102", "Room 103", "Room 104", "Room 105",
            "Lab A", "Lab B", "Lab C", "Computer Lab 1", "Computer Lab 2",
            "Lecture Hall 1", "Lecture Hall 2", "Seminar Room 1", "Seminar Room 2"
        ]
        
        # Define working days (Monday to Friday)
        self.working_days = [
            DayOfWeek.MONDAY,
            DayOfWeek.TUESDAY, 
            DayOfWeek.WEDNESDAY,
            DayOfWeek.THURSDAY,
            DayOfWeek.FRIDAY
        ]
    
    def get_semester_info(self) -> List[Dict]:
        """Define semester information"""
        return [
            {
                "semester": 1,
                "name": "First Semester",
                "start_date": date(2025, 8, 1),
                "end_date": date(2025, 12, 15),
                "academic_year": 2025
            },
            {
                "semester": 2,
                "name": "Second Semester", 
                "start_date": date(2026, 1, 10),
                "end_date": date(2026, 5, 20),
                "academic_year": 2026
            },
            {
                "semester": 3,
                "name": "Third Semester",
                "start_date": date(2026, 8, 1),
                "end_date": date(2026, 12, 15),
                "academic_year": 2026
            },
            {
                "semester": 4,
                "name": "Fourth Semester",
                "start_date": date(2027, 1, 10),
                "end_date": date(2027, 5, 20),
                "academic_year": 2027
            },
            {
                "semester": 5,
                "name": "Fifth Semester",
                "start_date": date(2027, 8, 1),
                "end_date": date(2027, 12, 15),
                "academic_year": 2027
            },
            {
                "semester": 6,
                "name": "Sixth Semester",
                "start_date": date(2028, 1, 10),
                "end_date": date(2028, 5, 20),
                "academic_year": 2028
            },
            {
                "semester": 7,
                "name": "Seventh Semester",
                "start_date": date(2028, 8, 1),
                "end_date": date(2028, 12, 15),
                "academic_year": 2028
            },
            {
                "semester": 8,
                "name": "Eighth Semester",
                "start_date": date(2029, 1, 10),
                "end_date": date(2029, 5, 20),
                "academic_year": 2029
            }
        ]
    
    def get_subjects_by_semester(self, semester: int) -> List[Subject]:
        """Get subjects that should be taught in a given semester"""
        # For now, we'll assign subjects to semesters based on their IDs
        # In a real system, subjects would have a semester field
        all_subjects = self.db.query(Subject).options(joinedload(Subject.faculty)).all()
        
        # Distribute subjects across semesters (this is a simple distribution)
        subjects_per_semester = len(all_subjects) // 8 + 1
        start_idx = (semester - 1) * subjects_per_semester
        end_idx = start_idx + subjects_per_semester
        
        semester_subjects = all_subjects[start_idx:end_idx]
        
        # Ensure we have at least some subjects for each semester
        if not semester_subjects and all_subjects:
            # If we run out of subjects, cycle back to the beginning
            semester_subjects = all_subjects[:min(3, len(all_subjects))]
        
        return semester_subjects
    
    def assign_instructor_name(self, subject: Subject) -> str:
        """Generate instructor name based on subject and faculty"""
        if subject.faculty:
            return f"Prof. {subject.faculty.name[:10]} Faculty"
        return "Prof. TBA"
    
    def clear_existing_schedules(self):
        """Clear existing class schedules to avoid duplicates"""
        print("🗑️  Clearing existing class schedules...")
        count = self.db.query(ClassSchedule).count()
        self.db.query(ClassSchedule).delete()
        self.db.commit()
        print(f"✅ Cleared {count} existing schedule entries")
    
    def populate_schedules(self):
        """Main method to populate all class schedules"""
        print("🚀 Starting Class Schedule Population...")
        
        # Get all data
        semesters = self.get_semester_info()
        
        total_schedules = 0
        classroom_idx = 0
        
        for semester_info in semesters:
            semester = semester_info["semester"]
            academic_year = semester_info["academic_year"]
            
            print(f"\n📚 Processing Semester {semester} ({semester_info['name']})...")
            
            # Get subjects for this semester
            subjects = self.get_subjects_by_semester(semester)
            
            if not subjects:
                print(f"⚠️  No subjects found for semester {semester}")
                continue
            
            print(f"📖 Found {len(subjects)} subjects for semester {semester}")
            
            # Distribute subjects across days and time slots
            schedule_idx = 0
            
            for subject in subjects:
                # Assign 2-3 classes per week for each subject
                classes_per_week = 2 if len(subjects) > 10 else 3
                
                for class_num in range(classes_per_week):
                    # Rotate through days and time slots
                    day = self.working_days[schedule_idx % len(self.working_days)]
                    time_slot = self.time_slots[schedule_idx % len(self.time_slots)]
                    classroom = self.classrooms[classroom_idx % len(self.classrooms)]
                    
                    # Create schedule entry
                    schedule = ClassSchedule(
                        subject_id=subject.id,
                        faculty_id=subject.faculty_id or 1,  # Default to first faculty if none
                        day_of_week=day,
                        start_time=time_slot.start_time,
                        end_time=time_slot.end_time,
                        semester=semester,
                        academic_year=academic_year,
                        classroom=classroom,
                        instructor_name=self.assign_instructor_name(subject),
                        is_active=True,
                        notes=f"Auto-generated for {semester_info['name']}"
                    )
                    
                    # Check for conflicts before adding
                    existing = self.db.query(ClassSchedule).filter(
                        ClassSchedule.day_of_week == day,
                        ClassSchedule.start_time == time_slot.start_time,
                        ClassSchedule.classroom == classroom,
                        ClassSchedule.academic_year == academic_year
                    ).first()
                    
                    if not existing:
                        self.db.add(schedule)
                        total_schedules += 1
                        
                        print(f"  ✅ {subject.name} - {day.value.title()} {time_slot} in {classroom}")
                    else:
                        print(f"  ⚠️  Conflict: {subject.name} - {day.value.title()} {time_slot} in {classroom} (skipped)")
                    
                    schedule_idx += 1
                    classroom_idx += 1
            
            # Commit after each semester
            self.db.commit()
            print(f"💾 Committed schedules for semester {semester}")
        
        print(f"\n🎉 Schedule population completed!")
        print(f"📊 Total schedules created: {total_schedules}")
        
        # Show summary
        self.show_summary()
    
    def show_summary(self):
        """Show a summary of created schedules"""
        print("\n📋 SCHEDULE SUMMARY")
        print("=" * 50)
        
        for semester_info in self.get_semester_info():
            semester = semester_info["semester"]
            count = self.db.query(ClassSchedule).filter(ClassSchedule.semester == semester).count()
            print(f"Semester {semester}: {count} class schedules")
        
        print("\n📅 SAMPLE SCHEDULES")
        print("=" * 50)
        
        sample_schedules = self.db.query(ClassSchedule).options(
            joinedload(ClassSchedule.subject)
        ).limit(10).all()
        
        for schedule in sample_schedules:
            subject_name = schedule.subject.name if schedule.subject else "Unknown"
            print(f"• {subject_name}")
            print(f"  📅 {schedule.day_of_week.value.title()}")
            print(f"  🕐 {schedule.time_slot_display}")
            print(f"  🏫 {schedule.classroom}")
            print(f"  👨‍🏫 {schedule.instructor_name}")
            print(f"  🎓 Semester {schedule.semester}")
            print()
    
    def cleanup(self):
        """Clean up database connection"""
        self.db.close()

def main():
    """Main execution function"""
    populator = ClassSchedulePopulator()
    
    try:
        # Ask for confirmation
        print("🎯 CLASS SCHEDULE POPULATION TOOL")
        print("=" * 40)
        print("This will:")
        print("• Clear all existing class schedules")
        print("• Create new schedules for all 8 semesters")
        print("• Assign proper timings, classrooms, and instructors")
        print("• Use existing subjects and faculties from database")
        
        response = input("\n❓ Do you want to continue? (y/N): ").strip().lower()
        
        if response != 'y':
            print("❌ Operation cancelled.")
            return
        
        # Clear existing schedules
        populator.clear_existing_schedules()
        
        # Populate new schedules
        populator.populate_schedules()
        
        print("\n✅ Class schedule population completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during schedule population: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        populator.cleanup()

if __name__ == "__main__":
    main()