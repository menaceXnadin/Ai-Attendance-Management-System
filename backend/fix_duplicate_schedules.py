#!/usr/bin/env python3
"""
Fix Duplicate Schedules - Create proper 5 different subjects at 5 different times
"""

import asyncio
import sys
import os
from datetime import time

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def fix_duplicate_schedules():
    """Fix the duplicate schedule issue by creating proper unique schedules"""
    
    try:
        from app.core.database import get_db
        from sqlalchemy import text
        
        print("🔧 Fix Duplicate Schedules")
        print("=" * 50)
        print("📋 Goal: Create 5 different subjects at 5 different time slots")
        print("🎯 Each faculty-semester should have exactly 5 unique schedules per day")
        
        # Get database session
        async for db in get_db():
            # Step 1: Clear ALL existing schedules
            print("\n🧹 Step 1: Clearing ALL existing class schedules...")
            await db.execute(text("DELETE FROM class_schedules"))
            await db.commit()
            print("   ✅ All existing schedules cleared!")
            
            # Step 2: Get available data
            print("\n📊 Step 2: Analyzing available data...")
            
            # Get faculties
            result = await db.execute(text("SELECT id, name FROM faculties ORDER BY id"))
            faculties = result.fetchall()
            
            print(f"   🏫 Available faculties: {len(faculties)}")
            for i, (faculty_id, name) in enumerate(faculties):
                print(f"      {i+1}. {name} (ID: {faculty_id})")
            
            # Step 3: Define proper schedule structure
            print("\n⏰ Step 3: Defining proper schedule structure...")
            
            # Time slots: 10:00 AM to 4:00 PM (5 periods of 1 hour each)
            time_slots = [
                (time(10, 0), time(11, 0)),  # Period 1: 10:00-11:00 AM
                (time(11, 0), time(12, 0)),  # Period 2: 11:00-12:00 PM  
                (time(13, 0), time(14, 0)),  # Period 3: 1:00-2:00 PM (after lunch)
                (time(14, 0), time(15, 0)),  # Period 4: 2:00-3:00 PM
                (time(15, 0), time(16, 0))   # Period 5: 3:00-4:00 PM
            ]
            
            # Days: Sunday to Friday (6 days)
            days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']
            
            print(f"   🕐 Time slots (5 periods):")
            for i, (start, end) in enumerate(time_slots, 1):
                print(f"      Period {i}: {start.strftime('%I:%M %p')} - {end.strftime('%I:%M %p')}")
            
            print(f"   📅 Days: {', '.join(days)} (6 days)")
            print(f"   📖 Semesters: 1-8 per faculty")
            
            # Step 4: Create proper schedules (ONE schedule per faculty-semester-day-period)
            print("\n🏗️  Step 4: Creating proper class schedules...")
            
            total_created = 0
            
            # For each faculty
            for faculty_idx, (faculty_id, faculty_name) in enumerate(faculties):
                print(f"\n   🏫 Faculty {faculty_idx + 1}: {faculty_name}")
                
                # Get subjects for this faculty
                result = await db.execute(text("""
                    SELECT id, name, code FROM subjects 
                    WHERE faculty_id = :faculty_id 
                    ORDER BY id
                """), {"faculty_id": faculty_id})
                
                faculty_subjects = result.fetchall()
                
                if len(faculty_subjects) < 5:
                    print(f"      ⚠️  Warning: Only {len(faculty_subjects)} subjects available, need at least 5")
                    continue
                
                print(f"      📚 Available subjects: {len(faculty_subjects)}")
                
                faculty_total = 0
                
                # For each semester (1-8)
                for semester in range(1, 9):
                    academic_year = 2025 + ((semester - 1) // 2)  # 2025-2028
                    
                    print(f"      📖 Semester {semester} (Year {academic_year}):", end=" ")
                    semester_count = 0
                    
                    # For each day (Sunday-Friday)
                    for day_idx, day in enumerate(days):
                        # For each time slot (5 periods = 5 different subjects)
                        for slot_idx, (start_time, end_time) in enumerate(time_slots):
                            # Select a DIFFERENT subject for each time slot
                            # This ensures 5 different subjects across 5 time periods
                            subject_idx = slot_idx % len(faculty_subjects)
                            subject_id, subject_name, subject_code = faculty_subjects[subject_idx]
                            
                            # Create unique classroom identifier
                            classroom = f"Room-{faculty_name[:3].upper()}-S{semester}-D{day_idx+1}-P{slot_idx+1}"
                            
                            # Create instructor name
                            instructor = f"Prof. {faculty_name[:15]} S{semester}P{slot_idx+1}"
                            
                            # Insert ONE schedule per faculty-semester-day-period
                            await db.execute(text("""
                                INSERT INTO class_schedules 
                                (subject_id, faculty_id, day_of_week, start_time, end_time, 
                                 semester, academic_year, classroom, instructor_name, is_active, notes)
                                VALUES 
                                (:subject_id, :faculty_id, :day_of_week, :start_time, :end_time,
                                 :semester, :academic_year, :classroom, :instructor_name, :is_active, :notes)
                            """), {
                                'subject_id': subject_id,
                                'faculty_id': faculty_id,  # This should be the subject's faculty, not schedule faculty
                                'day_of_week': day,
                                'start_time': start_time,
                                'end_time': end_time,
                                'semester': semester,
                                'academic_year': academic_year,
                                'classroom': classroom,
                                'instructor_name': instructor,
                                'is_active': True,
                                'notes': f'Fixed rebuild - {faculty_name} Semester {semester}'
                            })
                            
                            semester_count += 1
                            faculty_total += 1
                            total_created += 1
                    
                    print(f"{semester_count} schedules")
                
                print(f"      ✅ Faculty total: {faculty_total} schedules")
            
            # Step 5: Commit all changes
            print(f"\n💾 Step 5: Committing {total_created} schedules to database...")
            await db.commit()
            
            # Step 6: Verify the fix
            print("\n📊 Step 6: Verification...")
            
            # Test with Computer Science & Engineering (faculty_id = 9)
            print(f"\n🎓 Testing Computer Science Student (Faculty ID 9, Semester 1, Thursday):")
            print("-" * 60)
            
            result = await db.execute(text("""
                SELECT 
                    cs.subject_id,
                    s.name as subject_name,
                    s.code as subject_code,
                    cs.start_time,
                    cs.end_time,
                    cs.classroom
                FROM class_schedules cs
                JOIN subjects s ON cs.subject_id = s.id
                WHERE cs.day_of_week = 'THURSDAY'
                    AND cs.semester = 1
                    AND s.faculty_id = 9
                    AND cs.academic_year = 2025
                    AND cs.is_active = true
                ORDER BY cs.start_time
            """))
            
            test_schedules = result.fetchall()
            
            print(f"📊 Found {len(test_schedules)} schedules:")
            
            subject_names = set()
            time_slots_used = set()
            
            for i, (subject_id, subject_name, subject_code, start_time, end_time, classroom) in enumerate(test_schedules, 1):
                print(f"{i:2d}. {start_time} - {end_time} | {subject_name} ({subject_code}) | {classroom}")
                subject_names.add(subject_name)
                time_slots_used.add(f"{start_time} - {end_time}")
            
            print(f"\n📈 Results:")
            print(f"   Unique subjects: {len(subject_names)} (Expected: 5)")
            print(f"   Unique time slots: {len(time_slots_used)} (Expected: 5)")
            
            if len(subject_names) == 5 and len(time_slots_used) == 5:
                print("   ✅ SUCCESS! Fixed duplicate schedule issue!")
                print("   🎯 Each time slot now has a different subject")
            else:
                print("   ❌ Still has issues")
                if len(subject_names) != 5:
                    print(f"      - Expected 5 unique subjects, got {len(subject_names)}")
                if len(time_slots_used) != 5:
                    print(f"      - Expected 5 unique time slots, got {len(time_slots_used)}")
            
            # Final statistics
            result = await db.execute(text("SELECT COUNT(*) FROM class_schedules"))
            final_count = result.scalar()
            
            expected_total = len(faculties) * 8 * 6 * 5  # faculties × semesters × days × periods
            
            print(f"\n📊 Final Statistics:")
            print(f"   Total schedules created: {final_count}")
            print(f"   Expected total: {expected_total}")
            print(f"   Match: {'✅ Perfect!' if final_count == expected_total else '❌ Mismatch'}")
            
            break  # Exit the async generator
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

def main():
    print("🔧 Fix Duplicate Schedules Tool")
    print("=" * 50)
    print("This will:")
    print("• Delete ALL existing class schedules")
    print("• Create proper schedules with 5 DIFFERENT subjects per day")
    print("• Ensure each time slot has a UNIQUE subject")
    print("• Fix the frontend duplicate issue")
    
    response = input("\n⚠️  Proceed with schedule fix? (y/N): ")
    if response.lower() != 'y':
        print("❌ Operation cancelled.")
        return
    
    try:
        asyncio.run(fix_duplicate_schedules())
        print("\n🎉 Schedule fix completed!")
        print("📚 Frontend should now show 5 different subjects at different times!")
        
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()