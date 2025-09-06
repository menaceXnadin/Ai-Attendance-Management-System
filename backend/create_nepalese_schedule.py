#!/usr/bin/env python3
"""
Nepalese Academic Schedule Generator
- Sunday to Friday classes (Saturday holiday)
- 5 subjects per day, 6 days = 30 schedules per semester
- Classes start from 11:00 AM
- Proper timing with breaks
"""

import os
import sys
from datetime import time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.database import SessionLocal
from sqlalchemy import text

def create_nepalese_schedule():
    """Create realistic Nepalese academic schedule"""
    
    session = SessionLocal()
    
    try:
        print("🇳🇵 Creating Nepalese Academic Schedule...")
        print("   📅 Sunday-Friday classes (Saturday holiday)")
        print("   🕐 Classes start from 11:00 AM")
        print("   📚 5 subjects per day × 6 days = 30 schedules per semester")
        
        # Clear existing schedules
        print("\n🧹 Clearing existing schedules...")
        session.execute(text("DELETE FROM class_schedules"))
        
        # Get subjects - use more subjects for realistic schedule
        subjects = session.execute(text("SELECT id, name FROM subjects ORDER BY id LIMIT 30")).fetchall()
        faculties = session.execute(text("SELECT id, name FROM faculties ORDER BY id")).fetchall()
        
        print(f"📚 Using {len(subjects)} subjects and {len(faculties)} faculties")
        
        # Nepalese schedule: Sunday to Friday (Saturday is holiday)
        days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']
        
        # Time slots starting from 11:00 AM with proper breaks
        time_slots = [
            (time(11, 0), time(12, 0)),   # 11:00-12:00
            (time(12, 0), time(13, 0)),   # 12:00-13:00  
            (time(14, 0), time(15, 0)),   # 14:00-15:00 (after lunch break)
            (time(15, 0), time(16, 0)),   # 15:00-16:00
            (time(16, 0), time(17, 0))    # 16:00-17:00
        ]
        
        # Classroom types for variety
        classroom_types = [
            "Lecture Hall", "Computer Lab", "Physics Lab", "Chemistry Lab", 
            "Mathematics Room", "Language Lab"
        ]
        
        total_created = 0
        
        for semester in range(1, 9):
            print(f"\n📖 Creating schedule for Semester {semester}...")
            
            academic_year = 2025 + ((semester - 1) // 2)
            semester_schedules = 0
            subject_index = 0
            
            # Create 5 subjects per day for 6 days = 30 total per semester
            for day_idx, day in enumerate(days):
                print(f"   📅 {day}:", end=" ")
                
                for slot_idx, (start_time, end_time) in enumerate(time_slots):
                    if subject_index < len(subjects):
                        subject = subjects[subject_index % len(subjects)]
                        faculty = faculties[(subject_index + semester) % len(faculties)]
                        
                        # Create unique classroom for each schedule
                        classroom_type = classroom_types[slot_idx % len(classroom_types)]
                        classroom = f"{classroom_type} {semester}-{day_idx+1}{slot_idx+1}"
                        
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
                            'notes': f'Nepalese schedule for Semester {semester}'
                        })
                        
                        semester_schedules += 1
                        total_created += 1
                        subject_index += 1
                        
                        print("📚", end="")
                
                print(f" {5} subjects")
            
            print(f"   ✅ Total for Semester {semester}: {semester_schedules} schedules")
        
        # Commit all changes
        print(f"\n💾 Committing {total_created} schedules...")
        session.commit()
        
        # Verify results
        final_count = session.execute(text("SELECT COUNT(*) FROM class_schedules")).scalar()
        print(f"\n✅ Successfully created {final_count} class schedules!")
        
        # Show detailed distribution
        print("\n📊 Nepalese Academic Schedule Distribution:")
        print("   🗓️  Days: Sunday to Friday (Saturday holiday)")
        print("   🕐 Time: 11:00 AM to 5:00 PM")
        print("   📚 Structure: 5 subjects × 6 days = 30 per semester")
        print()
        
        for semester in range(1, 9):
            count = session.execute(text("SELECT COUNT(*) FROM class_schedules WHERE semester = :s"), 
                                  {'s': semester}).scalar()
            academic_year = 2025 + ((semester - 1) // 2)
            print(f"   Semester {semester} (Year {academic_year}): {count} schedules")
        
        # Show sample schedule for Semester 1
        print(f"\n📋 Sample Schedule (Semester 1):")
        sample_schedules = session.execute(text("""
            SELECT day_of_week, start_time, end_time, s.name as subject_name, classroom
            FROM class_schedules cs
            JOIN subjects s ON cs.subject_id = s.id  
            WHERE semester = 1
            ORDER BY 
                CASE day_of_week 
                    WHEN 'SUNDAY' THEN 1
                    WHEN 'MONDAY' THEN 2  
                    WHEN 'TUESDAY' THEN 3
                    WHEN 'WEDNESDAY' THEN 4
                    WHEN 'THURSDAY' THEN 5
                    WHEN 'FRIDAY' THEN 6
                END,
                start_time
            LIMIT 10
        """)).fetchall()
        
        for schedule in sample_schedules:
            day, start, end, subject, classroom = schedule
            print(f"   {day:<9} {start}-{end} {subject:<25} {classroom}")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        session.rollback()
        raise
    finally:
        session.close()

def main():
    print("🇳🇵 Nepalese Academic Schedule Creator")
    print("=" * 45)
    
    response = input("\n⚠️  Create Nepalese schedule (Sun-Fri, 11AM start, 30 per semester)? (y/N): ")
    if response.lower() != 'y':
        print("❌ Operation cancelled.")
        return
    
    try:
        create_nepalese_schedule()
        print("\n🎉 Nepalese academic schedule created successfully!")
        print("🇳🇵 Saturday holiday schedule implemented!")
        
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()