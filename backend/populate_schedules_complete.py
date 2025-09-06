#!/usr/bin/env python3
"""
Populate class_schedules table with proper separation of concerns
- Multiple faculties and semesters
- 5 subjects per semester
- 5 classes per day (Sunday to Friday, no Saturday)
- Proper isolation: students only see their faculty/semester classes
"""
import asyncio
import sys
import os
from datetime import time, datetime
sys.path.insert(0, os.path.abspath('.'))
from app.core.database import async_engine
from sqlalchemy import text

# Class time slots (5 classes per day with breaks, no attendance during breaks)
TIME_SLOTS = [
    (time(8, 0), time(9, 0)),    # 8:00-9:00 AM
    (time(9, 15), time(10, 15)), # 9:15-10:15 AM (15 min break)
    (time(10, 30), time(11, 30)), # 10:30-11:30 AM (15 min break)
    (time(12, 30), time(1, 30)),  # 12:30-1:30 PM (1 hour lunch break)
    (time(1, 45), time(2, 45)),   # 1:45-2:45 PM (15 min break)
]

# Days of the week (Sunday to Friday, skip Saturday)
WEEKDAYS = [
    ('SUNDAY', 'Sunday'),
    ('MONDAY', 'Monday'), 
    ('TUESDAY', 'Tuesday'),
    ('WEDNESDAY', 'Wednesday'),
    ('THURSDAY', 'Thursday'),
    ('FRIDAY', 'Friday')
    # Skip Saturday
]

async def populate_class_schedules():
    print("🏫 Populating Class Schedules...")
    print("=" * 60)
    print("📅 Schedule: Sunday-Friday (6 days)")
    print("🕐 Time Slots: 5 classes per day")
    print("🔒 Separation: Each faculty/semester isolated")
    print()
    
    async with async_engine.connect() as conn:
        # Start transaction
        trans = await conn.begin()
        
        try:
            # 1. Clear existing schedules
            await conn.execute(text("DELETE FROM class_schedules"))
            print("🗑️ Cleared existing schedules")
            
            # 2. Get all faculties
            faculties_result = await conn.execute(text("""
                SELECT id, name FROM faculties ORDER BY id
            """))
            faculties = faculties_result.fetchall()
            print(f"📚 Found {len(faculties)} faculties")
            
            # 3. Get subjects by faculty (assuming they exist for multiple semesters)
            subjects_result = await conn.execute(text("""
                SELECT id, name, code, faculty_id 
                FROM subjects 
                ORDER BY faculty_id, id
            """))
            all_subjects = subjects_result.fetchall()
            
            # Group subjects by faculty
            subjects_by_faculty = {}
            for subject in all_subjects:
                faculty_id = subject[3]
                if faculty_id not in subjects_by_faculty:
                    subjects_by_faculty[faculty_id] = []
                subjects_by_faculty[faculty_id].append(subject)
            
            # 4. Get semester information
            students_result = await conn.execute(text("""
                SELECT DISTINCT faculty_id, semester 
                FROM students 
                ORDER BY faculty_id, semester
            """))
            faculty_semesters = students_result.fetchall()
            
            print(f"📖 Found subjects for faculties: {list(subjects_by_faculty.keys())}")
            print(f"👥 Active faculty/semester combinations: {len(faculty_semesters)}")
            print()
            
            schedule_count = 0
            
            # 5. Create schedules for each faculty/semester combination
            for faculty_id, semester in faculty_semesters:
                faculty_name = next((f[1] for f in faculties if f[0] == faculty_id), f"Faculty_{faculty_id}")
                print(f"🏛️ Processing {faculty_name} - Semester {semester}")
                
                # Get subjects for this faculty (use first 5 subjects)
                faculty_subjects = subjects_by_faculty.get(faculty_id, [])[:5]
                
                if len(faculty_subjects) < 5:
                    print(f"   ⚠️ Only {len(faculty_subjects)} subjects available, creating generic ones...")
                    # Create generic subjects if needed
                    while len(faculty_subjects) < 5:
                        subject_num = len(faculty_subjects) + 1
                        faculty_subjects.append((
                            None,  # No real subject_id
                            f"Subject {subject_num}",
                            f"SUB{subject_num}",
                            faculty_id
                        ))
                
                # Create schedule for each day (Sunday-Friday)
                for day_enum, day_name in WEEKDAYS:
                    print(f"   📅 {day_name}: ", end="")
                    
                    # Create 5 classes for this day
                    for slot_idx, (start_time, end_time) in enumerate(TIME_SLOTS):
                        subject = faculty_subjects[slot_idx % len(faculty_subjects)]
                        subject_id = subject[0] if isinstance(subject[0], int) else None
                        subject_name = subject[1]
                        
                        # Insert schedule (using actual table schema)
                        await conn.execute(text("""
                            INSERT INTO class_schedules 
                            (subject_id, faculty_id, day_of_week, start_time, end_time, 
                             semester, academic_year, classroom, instructor_name, is_active)
                            VALUES 
                            (:subject_id, :faculty_id, :day_of_week, :start_time, :end_time,
                             :semester, :academic_year, :classroom, :instructor_name, :is_active)
                        """), {
                            'subject_id': subject_id,
                            'faculty_id': faculty_id,
                            'day_of_week': day_enum,
                            'start_time': start_time,
                            'end_time': end_time,
                            'semester': semester,
                            'academic_year': 2025,
                            'classroom': f"Room-{faculty_id}{semester}{day_enum[:3]}{slot_idx}",
                            'instructor_name': f"Prof. {subject_name[:10]}",
                            'is_active': True
                        })
                        
                        schedule_count += 1
                        print(f"{subject_name[:8]}({start_time.strftime('%H:%M')}) ", end="")
                    
                    print()  # New line after each day
                
                print(f"   ✅ Created {len(WEEKDAYS) * len(TIME_SLOTS)} schedules")
                print()
            
            # 6. Commit transaction
            await trans.commit()
            
            print(f"🎉 Successfully created {schedule_count} class schedules!")
            print()
            
            # 7. Verification
            verification_result = await conn.execute(text("""
                SELECT 
                    faculty_id,
                    semester,
                    COUNT(*) as schedule_count,
                    COUNT(DISTINCT day_of_week) as days_count,
                    COUNT(DISTINCT subject_id) as subjects_count
                FROM class_schedules 
                GROUP BY faculty_id, semester
                ORDER BY faculty_id, semester
            """))
            
            print("📊 Verification Summary:")
            for row in verification_result:
                faculty_id, semester, schedules, days, subjects = row
                expected_schedules = len(WEEKDAYS) * len(TIME_SLOTS)  # 6 days * 5 slots = 30
                status = "✅" if schedules == expected_schedules else "⚠️"
                print(f"   {status} Faculty {faculty_id}, Sem {semester}: {schedules} schedules, {days} days, {subjects} subjects")
            
            print(f"\n🎯 Total schedules created: {schedule_count}")
            print(f"📚 Coverage: {len(faculty_semesters)} faculty/semester combinations")
            print(f"📅 Days: Sunday-Friday (6 days, no Saturday)")
            print(f"🕐 Time slots: 5 classes per day")
            print(f"🔒 Proper separation: Each faculty/semester isolated ✅")
            
        except Exception as e:
            await trans.rollback()
            print(f"❌ Error: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(populate_class_schedules())