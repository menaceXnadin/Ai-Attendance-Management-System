#!/usr/bin/env python3
"""
Fix Class Schedule Timing
- Update schedules to start from 10:00 AM (not 1:45 AM or 11:00 AM)
- Ensure 5 subjects per day across all semesters and faculties
- Proper timing with breaks
"""

import os
import sys
from datetime import time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.database import SessionLocal
from sqlalchemy import text

def fix_class_schedule_timing():
    """Fix class schedule timing to start from 10:00 AM"""
    
    session = SessionLocal()
    
    try:
        print("🕐 Fixing Class Schedule Timing...")
        print("   ⏰ New schedule: 10:00 AM to 3:00 PM")
        print("   📚 5 subjects per day")
        print("   🗓️ Sunday to Friday (Saturday holiday)")
        
        # Check current schedules
        current_count = session.execute(text("SELECT COUNT(*) FROM class_schedules")).scalar()
        print(f"\n📊 Current schedules in database: {current_count}")
        
        # Show problematic timing if any
        weird_times = session.execute(text("""
            SELECT DISTINCT start_time, end_time, COUNT(*) as count
            FROM class_schedules 
            GROUP BY start_time, end_time
            ORDER BY start_time
        """)).fetchall()
        
        print("\n🔍 Current timing distribution:")
        for start, end, count in weird_times:
            print(f"   {start} - {end}: {count} schedules")
        
        # Clear existing schedules
        print("\n🧹 Clearing existing schedules...")
        session.execute(text("DELETE FROM class_schedules"))
        
        # Get subjects and faculties
        subjects = session.execute(text("SELECT id, name FROM subjects ORDER BY id")).fetchall()
        faculties = session.execute(text("SELECT id, name FROM faculties ORDER BY id")).fetchall()
        
        print(f"📚 Available: {len(subjects)} subjects, {len(faculties)} faculties")
        
        if len(subjects) < 5:
            print("⚠️  Warning: Less than 5 subjects available. Creating more subjects...")
            # Create additional subjects if needed
            base_subjects = [
                "Mathematics", "Physics", "Chemistry", "Computer Science", "English",
                "Statistics", "Electronics", "Programming", "Database Systems", "Networks"
            ]
            
            for i, subject_name in enumerate(base_subjects):
                if i >= len(subjects):
                    session.execute(text("""
                        INSERT INTO subjects (name, code, credits, description)
                        VALUES (:name, :code, :credits, :desc)
                    """), {
                        'name': subject_name,
                        'code': f"SUB{i+1:03d}",
                        'credits': 3,
                        'desc': f"Core subject: {subject_name}"
                    })
            
            session.commit()
            subjects = session.execute(text("SELECT id, name FROM subjects ORDER BY id")).fetchall()
            print(f"📚 Updated subjects count: {len(subjects)}")
        
        # Days: Sunday to Friday (Saturday is holiday in Nepal)
        days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']
        
        # Fixed time slots: 10:00 AM to 3:00 PM with proper breaks
        time_slots = [
            (time(10, 0), time(11, 0)),   # 10:00-11:00 AM
            (time(11, 0), time(12, 0)),   # 11:00-12:00 PM  
            (time(13, 0), time(14, 0)),   # 1:00-2:00 PM (after lunch break)
            (time(14, 0), time(15, 0)),   # 2:00-3:00 PM
            (time(15, 0), time(16, 0))    # 3:00-4:00 PM
        ]
        
        print(f"\n⏰ Time slots:")
        for i, (start, end) in enumerate(time_slots, 1):
            print(f"   Period {i}: {start.strftime('%I:%M %p')} - {end.strftime('%I:%M %p')}")
        
        # Classroom types
        classroom_types = [
            "Lecture Hall", "Computer Lab", "Physics Lab", "Chemistry Lab", 
            "Mathematics Room", "Language Lab", "Seminar Room", "Workshop"
        ]
        
        total_created = 0
        
        # Create schedules for all semesters (1-8)
        for semester in range(1, 9):
            print(f"\n📖 Creating schedule for Semester {semester}...")
            
            academic_year = 2025 + ((semester - 1) // 2)  # 2025-2028
            semester_schedules = 0
            
            # For each faculty, create a complete schedule
            for faculty_idx, faculty in enumerate(faculties):
                print(f"   🏫 Faculty: {faculty[1]}")
                
                subject_rotation = 0
                
                # Create 5 subjects per day for 6 days = 30 total per semester per faculty
                for day_idx, day in enumerate(days):
                    day_schedules = 0
                    
                    for slot_idx, (start_time, end_time) in enumerate(time_slots):
                        # Rotate through subjects to ensure variety
                        subject_idx = (subject_rotation + slot_idx + day_idx * 5) % len(subjects)
                        subject = subjects[subject_idx]
                        
                        # Create unique classroom
                        classroom_type = classroom_types[slot_idx % len(classroom_types)]
                        classroom = f"{classroom_type} {faculty[1][:3]}-{semester}{day_idx+1}{slot_idx+1}"
                        
                        # Generate instructor name
                        instructor_name = f"Prof. {faculty[1]} {chr(65 + slot_idx)}"
                        
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
                            'instructor_name': instructor_name,
                            'is_active': True,
                            'notes': f'Fixed schedule - Semester {semester}, {faculty[1]}'
                        })
                        
                        semester_schedules += 1
                        total_created += 1
                        day_schedules += 1
                    
                    print(f"     📅 {day}: {day_schedules} classes")
                
                subject_rotation += 1  # Rotate starting subject for next faculty
            
            print(f"   ✅ Semester {semester} total: {semester_schedules} schedules")
        
        # Commit all changes
        print(f"\n💾 Committing {total_created} schedules...")
        session.commit()
        
        # Verify results
        final_count = session.execute(text("SELECT COUNT(*) FROM class_schedules")).scalar()
        print(f"\n✅ Successfully created {final_count} class schedules!")
        
        # Show new timing distribution
        print("\n📊 New timing distribution:")
        new_times = session.execute(text("""
            SELECT DISTINCT start_time, end_time, COUNT(*) as count
            FROM class_schedules 
            GROUP BY start_time, end_time
            ORDER BY start_time
        """)).fetchall()
        
        for start, end, count in new_times:
            print(f"   {start.strftime('%I:%M %p')} - {end.strftime('%I:%M %p')}: {count} schedules")
        
        # Show distribution by semester and faculty
        print(f"\n📋 Schedule Distribution:")
        for semester in range(1, 9):
            count = session.execute(text("""
                SELECT COUNT(*) FROM class_schedules WHERE semester = :s
            """), {'s': semester}).scalar()
            
            faculty_count = session.execute(text("""
                SELECT COUNT(DISTINCT faculty_id) FROM class_schedules WHERE semester = :s
            """), {'s': semester}).scalar()
            
            academic_year = 2025 + ((semester - 1) // 2)
            print(f"   Semester {semester} (Year {academic_year}): {count} schedules across {faculty_count} faculties")
        
        # Show sample schedule for verification
        print(f"\n📋 Sample Schedule (Semester 1, First Faculty):")
        sample_schedules = session.execute(text("""
            SELECT day_of_week, start_time, end_time, s.name as subject_name, 
                   classroom, instructor_name, f.name as faculty_name
            FROM class_schedules cs
            JOIN subjects s ON cs.subject_id = s.id  
            JOIN faculties f ON cs.faculty_id = f.id
            WHERE semester = 1
            ORDER BY 
                cs.faculty_id,
                CASE day_of_week 
                    WHEN 'SUNDAY' THEN 1
                    WHEN 'MONDAY' THEN 2  
                    WHEN 'TUESDAY' THEN 3
                    WHEN 'WEDNESDAY' THEN 4
                    WHEN 'THURSDAY' THEN 5
                    WHEN 'FRIDAY' THEN 6
                END,
                start_time
            LIMIT 15
        """)).fetchall()
        
        current_faculty = None
        for schedule in sample_schedules:
            day, start, end, subject, classroom, instructor, faculty = schedule
            
            if faculty != current_faculty:
                print(f"\n   🏫 {faculty}:")
                current_faculty = faculty
            
            start_str = start.strftime('%I:%M %p')
            end_str = end.strftime('%I:%M %p')
            print(f"     {day:<9} {start_str}-{end_str} {subject:<20} ({classroom})")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        session.rollback()
        raise
    finally:
        session.close()

def main():
    print("🕐 Class Schedule Timing Fixer")
    print("=" * 40)
    print("This will:")
    print("• Fix timing to start from 10:00 AM")
    print("• Create 5 subjects per day")
    print("• Cover all semesters and faculties")
    print("• Use proper time slots with breaks")
    
    response = input("\n⚠️  Fix class schedule timing? (y/N): ")
    if response.lower() != 'y':
        print("❌ Operation cancelled.")
        return
    
    try:
        fix_class_schedule_timing()
        print("\n🎉 Class schedule timing fixed successfully!")
        print("⏰ All classes now start from 10:00 AM with proper timing!")
        
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()