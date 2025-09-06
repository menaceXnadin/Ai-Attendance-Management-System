#!/usr/bin/env python3
"""
Clear and populate class schedules with a simple approach to avoid constraint violations.
"""

import os
import sys
from datetime import time, datetime

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Direct database imports using the structure we know works
from app.database import SessionLocal
from sqlalchemy import text, func

def clear_and_populate_schedules():
    """Clear existing schedules and populate with basic data"""
    
    session = SessionLocal()
    
    try:
        print("🚀 Starting schedule population...")
        
        # First, clear existing schedules
        print("🧹 Clearing existing class schedules...")
        result = session.execute(text("DELETE FROM class_schedules"))
        print(f"   Cleared {result.rowcount} existing schedules")
        
        # Get count of subjects and faculties
        subject_count = session.execute(text("SELECT COUNT(*) FROM subjects")).scalar()
        faculty_count = session.execute(text("SELECT COUNT(*) FROM faculties")).scalar()
        
        print(f"📚 Found {subject_count} subjects and {faculty_count} faculties")
        
        if subject_count == 0 or faculty_count == 0:
            print("❌ No subjects or faculties found!")
            return
        
        # Get all subjects and faculties
        subjects = session.execute(text("SELECT id, name FROM subjects ORDER BY id")).fetchall()
        faculties = session.execute(text("SELECT id, name FROM faculties ORDER BY id")).fetchall()
        
        # Define simple schedule structure
        time_slots = [
            (time(8, 0), time(9, 30)),    # 08:00-09:30
            (time(10, 0), time(11, 30)),  # 10:00-11:30
            (time(12, 0), time(13, 30)),  # 12:00-13:30
            (time(14, 0), time(15, 30)),  # 14:00-15:30
            (time(16, 0), time(17, 30))   # 16:00-17:30
        ]
        
        days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']
        classrooms = ['Room 101', 'Room 102', 'Room 103', 'Lab A', 'Lab B', 'Computer Lab']
        
        total_schedules = 0
        
        # Create schedules for each semester (1-8)
        for semester in range(1, 9):
            print(f"\n📖 Creating schedules for Semester {semester}...")
            
            # Calculate academic year
            academic_year = 2025 + ((semester - 1) // 2)
            
            semester_schedules = 0
            
            # Create a reasonable number of schedules per semester
            for i, subject in enumerate(subjects[:20]):  # Limit to first 20 subjects per semester
                for j, (start_time, end_time) in enumerate(time_slots[:3]):  # 3 time slots per subject
                    
                    day = days[j % len(days)]
                    faculty = faculties[i % len(faculties)]
                    classroom = classrooms[j % len(classrooms)]
                    
                    # Insert schedule directly with SQL to avoid ORM constraint issues
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
                        'notes': f'Auto-generated for Semester {semester}'
                    })
                    
                    semester_schedules += 1
                    total_schedules += 1
            
            print(f"   Created {semester_schedules} schedules for Semester {semester}")
        
        # Commit all changes
        print(f"\n💾 Committing {total_schedules} schedules to database...")
        session.commit()
        
        # Verify the population
        final_count = session.execute(text("SELECT COUNT(*) FROM class_schedules")).scalar()
        print(f"\n✅ Successfully populated {final_count} class schedules!")
        
        # Show distribution by semester
        print(f"\n📊 Schedule distribution:")
        for semester in range(1, 9):
            count = session.execute(text("SELECT COUNT(*) FROM class_schedules WHERE semester = :sem"), 
                                  {'sem': semester}).scalar()
            print(f"   Semester {semester}: {count} schedules")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        session.rollback()
        raise
    finally:
        session.close()

def main():
    print("🎓 Simple Class Schedule Population")
    print("=" * 40)
    
    response = input("\n⚠️  This will clear ALL existing schedules and create new ones. Continue? (y/N): ")
    if response.lower() != 'y':
        print("❌ Operation cancelled.")
        return
    
    try:
        clear_and_populate_schedules()
        print("\n🎉 Schedule population completed successfully!")
        
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()