#!/usr/bin/env python3
"""
Super simple class schedule population that actually works.
Creates minimal but valid schedules for each semester.
"""

import os
import sys
from datetime import time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.database import SessionLocal
from sqlalchemy import text

def create_working_schedules():
    """Create schedules that actually work without constraint violations"""
    
    session = SessionLocal()
    
    try:
        print("🚀 Creating working class schedules...")
        
        # Clear existing schedules
        print("🧹 Clearing existing schedules...")
        session.execute(text("DELETE FROM class_schedules"))
        
        # Get basic data
        subjects = session.execute(text("SELECT id, name FROM subjects ORDER BY id LIMIT 10")).fetchall()
        faculties = session.execute(text("SELECT id, name FROM faculties ORDER BY id")).fetchall()
        
        print(f"📚 Using {len(subjects)} subjects and {len(faculties)} faculties")
        
        # Super simple: one unique schedule per semester
        days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']
        
        total_created = 0
        
        for semester in range(1, 9):
            print(f"\n📖 Creating schedules for Semester {semester}...")
            
            academic_year = 2025 + ((semester - 1) // 2)
            
            # Create just 5 schedules per semester (one per day)
            # Each uses different time, classroom, and faculty to avoid all conflicts
            
            for day_idx, day in enumerate(days):
                if day_idx < len(subjects) and day_idx < len(faculties):
                    
                    subject = subjects[day_idx]
                    faculty = faculties[day_idx % len(faculties)]
                    
                    # Unique time slot per day
                    start_hour = 8 + day_idx  # 8, 9, 10, 11, 12
                    start_time = time(start_hour, 0)
                    end_time = time(start_hour + 1, 30)
                    
                    # Unique classroom per schedule
                    classroom = f"Room S{semester}D{day_idx+1}"
                    
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
                        'instructor_name': f"Prof. {faculty[1]}",
                        'is_active': True,
                        'notes': f'Basic schedule for Semester {semester}'
                    })
                    
                    total_created += 1
                    print(f"   ✅ {subject[1]} - {day} {start_time}-{end_time} in {classroom}")
        
        # Commit all changes
        print(f"\n💾 Committing {total_created} schedules...")
        session.commit()
        
        # Verify
        final_count = session.execute(text("SELECT COUNT(*) FROM class_schedules")).scalar()
        print(f"\n✅ Successfully created {final_count} class schedules!")
        
        # Show distribution
        print("\n📊 Schedule distribution:")
        for semester in range(1, 9):
            count = session.execute(text("SELECT COUNT(*) FROM class_schedules WHERE semester = :s"), 
                                  {'s': semester}).scalar()
            academic_year = 2025 + ((semester - 1) // 2)
            print(f"   Semester {semester} (Year {academic_year}): {count} schedules")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        session.rollback()
        raise
    finally:
        session.close()

def main():
    print("🎓 Simple Class Schedule Creator")
    print("=" * 35)
    
    response = input("\n⚠️  This will create basic schedules. Continue? (y/N): ")
    if response.lower() != 'y':
        print("❌ Operation cancelled.")
        return
    
    try:
        create_working_schedules()
        print("\n🎉 Basic schedule population completed!")
        
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()