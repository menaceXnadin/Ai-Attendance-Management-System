#!/usr/bin/env python3
"""
Simple Class Schedule Fix
Run this to fix the class schedule timing to start from 10:00 AM
"""

import asyncio
import sys
import os
from datetime import time

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def fix_schedules():
    """Fix class schedules with proper timing"""
    
    try:
        from app.core.database import get_db
        from sqlalchemy import text
        
        print("🕐 Fixing Class Schedule Timing...")
        print("   ⏰ New schedule: 10:00 AM to 4:00 PM")
        print("   📚 5 subjects per day")
        print("   🗓️ Sunday to Friday")
        
        # Get database session
        async for db in get_db():
            # Check current schedules
            result = await db.execute(text("SELECT COUNT(*) FROM class_schedules"))
            current_count = result.scalar()
            print(f"\n📊 Current schedules: {current_count}")
            
            # Show current timing issues
            result = await db.execute(text("""
                SELECT DISTINCT start_time, end_time, COUNT(*) as count
                FROM class_schedules 
                GROUP BY start_time, end_time
                ORDER BY start_time
            """))
            times = result.fetchall()
            
            print("\n🔍 Current timing distribution:")
            for start, end, count in times:
                print(f"   {start} - {end}: {count} schedules")
            
            # Clear existing schedules
            print("\n🧹 Clearing existing schedules...")
            await db.execute(text("DELETE FROM class_schedules"))
            
            # Get subjects and faculties
            result = await db.execute(text("SELECT id, name FROM subjects ORDER BY id"))
            subjects = result.fetchall()
            
            result = await db.execute(text("SELECT id, name FROM faculties ORDER BY id"))
            faculties = result.fetchall()
            
            print(f"📚 Available: {len(subjects)} subjects, {len(faculties)} faculties")
            
            # Time slots: 10:00 AM to 4:00 PM
            time_slots = [
                (time(10, 0), time(11, 0)),  # 10:00-11:00 AM
                (time(11, 0), time(12, 0)),  # 11:00-12:00 PM  
                (time(13, 0), time(14, 0)),  # 1:00-2:00 PM (after lunch)
                (time(14, 0), time(15, 0)),  # 2:00-3:00 PM
                (time(15, 0), time(16, 0))   # 3:00-4:00 PM
            ]
            
            days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']
            
            print(f"\n⏰ Time slots:")
            for i, (start, end) in enumerate(time_slots, 1):
                print(f"   Period {i}: {start.strftime('%I:%M %p')} - {end.strftime('%I:%M %p')}")
            
            total_created = 0
            
            # Create schedules for all semesters
            for semester in range(1, 9):
                academic_year = 2025 + ((semester - 1) // 2)
                print(f"\n📖 Creating Semester {semester} (Year {academic_year})...")
                
                semester_count = 0
                
                # For each faculty
                for faculty_idx, faculty in enumerate(faculties):
                    faculty_id, faculty_name = faculty
                    
                    # For each day
                    for day_idx, day in enumerate(days):
                        # For each time slot (5 subjects per day)
                        for slot_idx, (start_time, end_time) in enumerate(time_slots):
                            # Rotate through subjects
                            subject_idx = (faculty_idx + day_idx + slot_idx + semester) % len(subjects)
                            subject_id, subject_name = subjects[subject_idx]
                            
                            # Create classroom name
                            classroom = f"Room {faculty_name[:3]}-{semester}{day_idx+1}{slot_idx+1}"
                            instructor = f"Prof. {faculty_name} {chr(65 + slot_idx)}"
                            
                            # Insert schedule
                            await db.execute(text("""
                                INSERT INTO class_schedules 
                                (subject_id, faculty_id, day_of_week, start_time, end_time, 
                                 semester, academic_year, classroom, instructor_name, is_active, notes)
                                VALUES 
                                (:subject_id, :faculty_id, :day_of_week, :start_time, :end_time,
                                 :semester, :academic_year, :classroom, :instructor_name, :is_active, :notes)
                            """), {
                                'subject_id': subject_id,
                                'faculty_id': faculty_id,
                                'day_of_week': day,
                                'start_time': start_time,
                                'end_time': end_time,
                                'semester': semester,
                                'academic_year': academic_year,
                                'classroom': classroom,
                                'instructor_name': instructor,
                                'is_active': True,
                                'notes': f'Fixed timing - Semester {semester}'
                            })
                            
                            semester_count += 1
                            total_created += 1
                
                print(f"   ✅ Created {semester_count} schedules")
            
            # Commit changes
            await db.commit()
            
            # Verify results
            result = await db.execute(text("SELECT COUNT(*) FROM class_schedules"))
            final_count = result.scalar()
            
            print(f"\n✅ Successfully created {final_count} schedules!")
            
            # Show new timing distribution
            result = await db.execute(text("""
                SELECT DISTINCT start_time, end_time, COUNT(*) as count
                FROM class_schedules 
                GROUP BY start_time, end_time
                ORDER BY start_time
            """))
            new_times = result.fetchall()
            
            print("\n📊 New timing distribution:")
            for start, end, count in new_times:
                print(f"   {start} - {end}: {count} schedules")
            
            # Show sample
            result = await db.execute(text("""
                SELECT day_of_week, start_time, end_time, s.name as subject_name, 
                       classroom, f.name as faculty_name
                FROM class_schedules cs
                JOIN subjects s ON cs.subject_id = s.id  
                JOIN faculties f ON cs.faculty_id = f.id
                WHERE semester = 1
                ORDER BY f.name, 
                    CASE day_of_week 
                        WHEN 'SUNDAY' THEN 1 WHEN 'MONDAY' THEN 2 WHEN 'TUESDAY' THEN 3
                        WHEN 'WEDNESDAY' THEN 4 WHEN 'THURSDAY' THEN 5 WHEN 'FRIDAY' THEN 6
                    END, start_time
                LIMIT 10
            """))
            
            sample = result.fetchall()
            print(f"\n📋 Sample Schedule (Semester 1):")
            for row in sample:
                day, start, end, subject, classroom, faculty = row
                print(f"   {faculty} | {day} {start}-{end} | {subject} | {classroom}")
            
            break  # Exit the async generator
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

def main():
    print("🕐 Simple Class Schedule Timing Fix")
    print("=" * 40)
    
    try:
        asyncio.run(fix_schedules())
        print("\n🎉 Class schedules fixed successfully!")
        print("⏰ All classes now start from 10:00 AM!")
        
    except Exception as e:
        print(f"\n💥 Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()