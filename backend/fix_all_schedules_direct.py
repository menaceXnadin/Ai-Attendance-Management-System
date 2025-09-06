#!/usr/bin/env python3

"""
Create comprehensive schedules for ALL faculties using direct database access
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def create_schedules_direct():
    """Create schedules using direct database access"""
    
    # Import within function to avoid path issues
    sys.path.append('app')
    from core.database import SessionLocal
    from models.student import Student
    from models.class_schedule import ClassSchedule
    from models.subject import Subject
    from models.faculty import Faculty
    from models.enums import DayOfWeek
    from datetime import time
    
    db = SessionLocal()
    
    try:
        print("🔍 Checking current faculty schedules...")
        
        # Get all faculties
        faculties = db.query(Faculty).all()
        print(f"📚 Found {len(faculties)} faculties:")
        
        for faculty in faculties:
            print(f"   - {faculty.name} (ID: {faculty.id})")
        
        # Check current schedules per faculty
        for faculty in faculties:
            subjects = db.query(Subject).filter(Subject.faculty_id == faculty.id).all()
            schedules = db.query(ClassSchedule).join(Subject).filter(
                ClassSchedule.day_of_week == DayOfWeek.MONDAY,
                ClassSchedule.academic_year == 2025,
                ClassSchedule.is_active == True,
                ClassSchedule.semester == 1,
                Subject.faculty_id == faculty.id
            ).count()
            
            print(f"   {faculty.name}: {len(subjects)} subjects, {schedules} Monday schedules")
        
        print("\n🏗️ Creating missing schedules...")
        
        # Schedule templates for different faculties
        time_slots = [
            {"start": time(9, 0), "end": time(10, 0), "classroom_suffix": "101"},
            {"start": time(10, 0), "end": time(11, 0), "classroom_suffix": "102"},
            {"start": time(13, 0), "end": time(14, 0), "classroom_suffix": "103"},
            {"start": time(14, 0), "end": time(15, 0), "classroom_suffix": "104"},
            {"start": time(15, 0), "end": time(16, 0), "classroom_suffix": "105"},
        ]
        
        created_count = 0
        
        for faculty in faculties:
            # Get subjects for this faculty
            subjects = db.query(Subject).filter(Subject.faculty_id == faculty.id).limit(5).all()
            
            if not subjects:
                print(f"⚠️ No subjects for {faculty.name}, skipping")
                continue
            
            # Check existing schedules for this faculty
            existing_schedules = db.query(ClassSchedule).join(Subject).filter(
                ClassSchedule.day_of_week == DayOfWeek.MONDAY,
                ClassSchedule.academic_year == 2025,
                ClassSchedule.is_active == True,
                ClassSchedule.semester == 1,
                Subject.faculty_id == faculty.id
            ).count()
            
            if existing_schedules >= 5:
                print(f"✅ {faculty.name} already has {existing_schedules} schedules")
                continue
            
            print(f"\n🏫 Creating schedules for {faculty.name}:")
            
            # Create schedules for up to 5 subjects
            for i, subject in enumerate(subjects[:5]):
                if i < len(time_slots):
                    slot = time_slots[i]
                    
                    # Check if schedule already exists for this subject
                    existing = db.query(ClassSchedule).filter(
                        ClassSchedule.subject_id == subject.id,
                        ClassSchedule.day_of_week == DayOfWeek.MONDAY,
                        ClassSchedule.semester == 1,
                        ClassSchedule.academic_year == 2025
                    ).first()
                    
                    if existing:
                        print(f"   ⏭️ Schedule exists for {subject.name}")
                        continue
                    
                    # Create new schedule
                    new_schedule = ClassSchedule(
                        subject_id=subject.id,
                        faculty_id=faculty.id,
                        day_of_week=DayOfWeek.MONDAY,
                        start_time=slot["start"],
                        end_time=slot["end"],
                        semester=1,
                        academic_year=2025,
                        classroom=f"{faculty.name[:3].upper()}-{slot['classroom_suffix']}",
                        instructor_name=f"Prof. {faculty.name[:10]}",
                        is_active=True,
                        notes=f"Semester 1 {subject.name}"
                    )
                    
                    db.add(new_schedule)
                    created_count += 1
                    
                    print(f"   ✅ {slot['start']}-{slot['end']}: {subject.name}")
        
        # Commit all changes
        db.commit()
        
        print(f"\n🎉 Successfully created {created_count} new schedules!")
        
        # Verify results
        print("\n📊 Final verification:")
        for faculty in faculties:
            schedules = db.query(ClassSchedule).join(Subject).filter(
                ClassSchedule.day_of_week == DayOfWeek.MONDAY,
                ClassSchedule.academic_year == 2025,
                ClassSchedule.is_active == True,
                ClassSchedule.semester == 1,
                Subject.faculty_id == faculty.id
            ).count()
            
            print(f"   {faculty.name}: {schedules} Monday schedules")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        db.close()

if __name__ == "__main__":
    success = create_schedules_direct()
    if success:
        print("\n✅ All faculties now have proper schedules!")
        print("🔄 Please refresh your browser to see the updated schedules")
    else:
        print("\n❌ Failed to create schedules")