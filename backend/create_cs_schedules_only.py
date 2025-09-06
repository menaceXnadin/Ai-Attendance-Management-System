#!/usr/bin/env python3
"""
Create CS Schedules Only - Simple fix for Computer Science students
"""

import asyncio
import sys
import os
from datetime import time

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def create_cs_schedules_only():
    """Create proper schedules for Computer Science students only"""
    
    try:
        from app.core.database import get_db
        from sqlalchemy import text
        
        print("🎓 Create CS Schedules Only")
        print("=" * 50)
        print("🎯 Goal: Create 5 different CS subjects at 5 different time slots")
        
        # Get database session
        async for db in get_db():
            # Step 1: Clear existing CS schedules
            print("\n🧹 Step 1: Clearing existing CS schedules...")
            await db.execute(text("""
                DELETE FROM class_schedules 
                WHERE subject_id IN (
                    SELECT id FROM subjects WHERE faculty_id = 9
                )
            """))
            await db.commit()
            print("   ✅ CS schedules cleared!")
            
            # Step 2: Get CS subjects
            print("\n📚 Step 2: Getting CS subjects...")
            result = await db.execute(text("""
                SELECT id, name, code FROM subjects 
                WHERE faculty_id = 9 
                ORDER BY id
                LIMIT 5
            """))
            
            cs_subjects = result.fetchall()
            
            if len(cs_subjects) < 5:
                print(f"   ❌ Only {len(cs_subjects)} CS subjects found, need at least 5")
                return
            
            print(f"   ✅ Found {len(cs_subjects)} CS subjects:")
            for i, (subject_id, name, code) in enumerate(cs_subjects, 1):
                print(f"      {i}. {name} ({code}) [ID: {subject_id}]")
            
            # Step 3: Define schedule structure
            print("\n⏰ Step 3: Defining schedule structure...")
            
            # Time slots: 10:00 AM to 4:00 PM (5 periods)
            time_slots = [
                (time(10, 0), time(11, 0)),  # Period 1: 10:00-11:00 AM
                (time(11, 0), time(12, 0)),  # Period 2: 11:00-12:00 PM  
                (time(13, 0), time(14, 0)),  # Period 3: 1:00-2:00 PM
                (time(14, 0), time(15, 0)),  # Period 4: 2:00-3:00 PM
                (time(15, 0), time(16, 0))   # Period 5: 3:00-4:00 PM
            ]
            
            # Days: Sunday to Friday
            days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']
            
            print(f"   🕐 Time slots: {len(time_slots)} periods")
            print(f"   📅 Days: {len(days)} days")
            print(f"   📖 Semesters: 1-8")
            
            # Step 4: Create CS schedules
            print("\n🏗️  Step 4: Creating CS schedules...")
            
            total_created = 0
            faculty_id = 9  # Computer Science & Engineering
            
            # For each semester (1-8)
            for semester in range(1, 9):
                academic_year = 2025 + ((semester - 1) // 2)  # 2025-2028
                
                print(f"   📖 Semester {semester} (Year {academic_year}):", end=" ")
                semester_count = 0
                
                # For each day (Sunday-Friday)
                for day_idx, day in enumerate(days):
                    # For each time slot (5 periods = 5 different subjects)
                    for slot_idx, (start_time, end_time) in enumerate(time_slots):
                        # Use a different subject for each time slot
                        subject_id, subject_name, subject_code = cs_subjects[slot_idx]
                        
                        # Create unique classroom identifier
                        classroom = f"CS-Room-S{semester}-{day[:3]}-P{slot_idx+1}"
                        
                        # Create instructor name
                        instructor = f"Prof. CS S{semester}P{slot_idx+1}"
                        
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
                            'notes': f'CS-only rebuild - Semester {semester}'
                        })
                        
                        semester_count += 1
                        total_created += 1
                
                print(f"{semester_count} schedules")
            
            # Step 5: Commit changes
            print(f"\n💾 Step 5: Committing {total_created} CS schedules...")
            await db.commit()
            
            # Step 6: Test the fix
            print("\n🧪 Step 6: Testing the fix...")
            
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
            
            print(f"\n📊 CS Student Thursday Schedule (Semester 1):")
            print("-" * 60)
            
            subject_names = set()
            time_slots_used = set()
            
            for i, (subject_id, subject_name, subject_code, start_time, end_time, classroom) in enumerate(test_schedules, 1):
                print(f"{i:2d}. {start_time} - {end_time} | {subject_name} ({subject_code})")
                subject_names.add(subject_name)
                time_slots_used.add(f"{start_time} - {end_time}")
            
            print(f"\n📈 Results:")
            print(f"   ✅ Unique subjects: {len(subject_names)} (Expected: 5)")
            print(f"   ✅ Unique time slots: {len(time_slots_used)} (Expected: 5)")
            
            if len(subject_names) == 5 and len(time_slots_used) == 5:
                print("\n🎉 SUCCESS! CS schedule issue fixed!")
                print("   ✅ 5 different subjects at 5 different times")
                print("   ✅ No more duplicate subjects in frontend")
            else:
                print("\n❌ Still has issues")
            
            break  # Exit the async generator
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

def main():
    print("🎓 Create CS Schedules Only")
    print("=" * 50)
    print("This will:")
    print("• Clear existing CS schedules")
    print("• Create proper CS schedules with 5 DIFFERENT subjects")
    print("• Fix the frontend duplicate issue for CS students")
    
    response = input("\n⚠️  Proceed with CS schedule creation? (y/N): ")
    if response.lower() != 'y':
        print("❌ Operation cancelled.")
        return
    
    try:
        asyncio.run(create_cs_schedules_only())
        print("\n🎉 CS schedule creation completed!")
        print("📚 CS students should now see 5 different subjects!")
        
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()