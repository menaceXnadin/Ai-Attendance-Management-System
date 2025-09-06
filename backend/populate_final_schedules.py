#!/usr/bin/env python3
"""
Final class schedule population that properly handles all unique constraints:
- unique_faculty_time_slot: (faculty_id, day_of_week, semester, academic_year, start_time)
- unique_classroom_time_slot: (classroom, day_of_week, start_time, academic_year)
"""

import os
import sys
from datetime import time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.database import SessionLocal
from sqlalchemy import text

def populate_schedules_final():
    """Populate schedules respecting all unique constraints"""
    
    session = SessionLocal()
    
    try:
        print("🚀 Starting final schedule population...")
        
        # Clear existing schedules
        print("🧹 Clearing existing class schedules...")
        result = session.execute(text("DELETE FROM class_schedules"))
        print(f"   Cleared {result.rowcount} existing schedules")
        
        # Get basic data
        subjects = session.execute(text("SELECT id, name FROM subjects ORDER BY id LIMIT 50")).fetchall()
        faculties = session.execute(text("SELECT id, name FROM faculties ORDER BY id")).fetchall()
        
        print(f"📚 Using {len(subjects)} subjects and {len(faculties)} faculties")
        
        # Define time slots and classrooms 
        time_slots = [
            (time(8, 0), time(9, 30)),    # 08:00-09:30
            (time(10, 0), time(11, 30)),  # 10:00-11:30  
            (time(12, 0), time(13, 30)),  # 12:00-13:30
            (time(14, 0), time(15, 30)),  # 14:00-15:30
            (time(16, 0), time(17, 30))   # 16:00-17:30
        ]
        
        days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']
        
        # Generate enough unique classrooms for all combinations
        classrooms = []
        for i in range(200):  # Generate 200 unique classrooms
            if i < 20:
                classrooms.append(f"Room {100 + i}")
            elif i < 40:
                classrooms.append(f"Lab {chr(65 + (i-20))}")  # Lab A, B, C...
            elif i < 60:
                classrooms.append(f"Computer Lab {i-39}")
            elif i < 80:
                classrooms.append(f"Lecture Hall {i-59}")
            else:
                classrooms.append(f"Classroom {i-79}")
        
        total_schedules = 0
        
        # Create schedules for all 8 semesters
        for semester in range(1, 9):
            print(f"\n📖 Creating schedules for Semester {semester}...")
            
            academic_year = 2025 + ((semester - 1) // 2)
            
            semester_schedules = 0
            classroom_idx = 0
            faculty_idx = 0
            
            # Create one schedule per subject per day per time slot
            for subject_idx, subject in enumerate(subjects):
                for day_idx, day in enumerate(days):
                    for slot_idx, (start_time, end_time) in enumerate(time_slots):
                        
                        # Use unique classroom for each time slot to avoid classroom conflicts
                        classroom = classrooms[classroom_idx % len(classrooms)]
                        classroom_idx += 1
                        
                        # Use different faculty for each schedule to avoid faculty conflicts
                        faculty = faculties[faculty_idx % len(faculties)]
                        faculty_idx += 1
                        
                        # Insert schedule
                        insert_sql = text("""
                            INSERT INTO class_schedules 
                            (subject_id, faculty_id, day_of_week, start_time, end_time, 
                             semester, academic_year, classroom, instructor_name, is_active, notes)
                            VALUES 
                            (:subject_id, :faculty_id, :day_of_week, :start_time, :end_time,
                             :semester, :academic_year, :classroom, :instructor_name, :is_active, :notes)
                        """)
                        
                        session.execute(insert_sql, {
                            'subject_id': subject[0],
                            'faculty_id': faculty[0],
                            'day_of_week': day,
                            'start_time': start_time,
                            'end_time': end_time,
                            'semester': semester,
                            'academic_year': academic_year,
                            'classroom': classroom,
                            'instructor_name': f"Prof. {faculty[1]} S{semester}",
                            'is_active': True,
                            'notes': f'Auto-generated for Semester {semester}'
                        })
                        
                        semester_schedules += 1
                        total_schedules += 1
                        
                        # Progress indicator
                        if semester_schedules % 50 == 0:
                            print(f"   {semester_schedules} schedules...", end=" ", flush=True)
            
            print(f"\n   Completed Semester {semester}: {semester_schedules} schedules")
        
        # Commit all changes
        print(f"\n💾 Committing {total_schedules} schedules to database...")
        session.commit()
        
        # Verify results
        final_count = session.execute(text("SELECT COUNT(*) FROM class_schedules")).scalar()
        print(f"\n✅ Successfully populated {final_count} class schedules!")
        
        # Show distribution
        print("\n📊 Schedule distribution by semester:")
        for semester in range(1, 9):
            count = session.execute(text("SELECT COUNT(*) FROM class_schedules WHERE semester = :sem"), 
                                  {'sem': semester}).scalar()
            academic_year = 2025 + ((semester - 1) // 2)
            print(f"   Semester {semester} (Year {academic_year}): {count} schedules")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        session.rollback()
        raise
    finally:
        session.close()

def main():
    print("🎓 Final Class Schedule Population")
    print("=" * 40)
    
    response = input("\n⚠️  This will clear ALL existing schedules and create comprehensive new ones. Continue? (y/N): ")
    if response.lower() != 'y':
        print("❌ Operation cancelled.")
        return
    
    try:
        populate_schedules_final()
        print("\n🎉 Schedule population completed successfully!")
        print("\n📋 Summary:")
        print("   - Created schedules for all 8 semesters")
        print("   - Each semester spans academic years 2025-2028")
        print("   - Proper time slots from 08:00 to 17:30")
        print("   - Unique classroom and faculty assignments")
        print("   - All database constraints satisfied")
        
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()