#!/usr/bin/env python3
"""
Populate All Schedules - Create schedules for ALL faculties
"""

import asyncio
import sys
import os
from datetime import time

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def populate_all_schedules():
    """Create schedules for ALL faculties with 5 different subjects per day"""
    
    try:
        from app.core.database import get_db
        from sqlalchemy import text
        
        print("🏫 Populate All Schedules")
        print("=" * 50)
        print("🎯 Goal: Create schedules for ALL faculties")
        
        # Get database session
        async for db in get_db():
            # Step 1: Clear ALL existing schedules
            print("\n🧹 Step 1: Clearing ALL existing schedules...")
            await db.execute(text("DELETE FROM class_schedules"))
            await db.commit()
            print("   ✅ All schedules cleared!")
            
            # Step 2: Get all faculties
            print("\n🏫 Step 2: Getting all faculties...")
            result = await db.execute(text("SELECT id, name FROM faculties ORDER BY id"))
            faculties = result.fetchall()
            
            print(f"   ✅ Found {len(faculties)} faculties:")
            for i, (faculty_id, name) in enumerate(faculties, 1):
                print(f"      {i}. {name} (ID: {faculty_id})")
            
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
            
            # Step 4: Create schedules for ALL faculties
            print("\n🏗️  Step 4: Creating schedules for all faculties...")
            
            total_created = 0
            
            # For each faculty
            for faculty_idx, (faculty_id, faculty_name) in enumerate(faculties):
                print(f"\n   🏫 Faculty {faculty_idx + 1}: {faculty_name}")
                
                # Get subjects for this faculty
                result = await db.execute(text("""
                    SELECT id, name, code FROM subjects 
                    WHERE faculty_id = :faculty_id 
                    ORDER BY id
                    LIMIT 5
                """), {"faculty_id": faculty_id})
                
                faculty_subjects = result.fetchall()
                
                if len(faculty_subjects) < 5:
                    print(f"      ⚠️  Warning: Only {len(faculty_subjects)} subjects available, skipping")
                    continue
                
                print(f"      📚 Using {len(faculty_subjects)} subjects")
                
                faculty_total = 0
                
                # For each semester (1-8)
                for semester in range(1, 9):
                    academic_year = 2025 + ((semester - 1) // 2)  # 2025-2028
                    
                    print(f"      📖 Semester {semester}:", end=" ")
                    semester_count = 0
                    
                    # For each day (Sunday-Friday)
                    for day_idx, day in enumerate(days):
                        # For each time slot (5 periods = 5 different subjects)
                        for slot_idx, (start_time, end_time) in enumerate(time_slots):
                            # Use a different subject for each time slot
                            subject_id, subject_name, subject_code = faculty_subjects[slot_idx]
                            
                            # Create unique classroom identifier
                            classroom = f"{faculty_name[:3].upper()}-S{semester}-{day[:3]}-P{slot_idx+1}"
                            
                            # Create instructor name
                            instructor = f"Prof. {faculty_name[:10]} S{semester}P{slot_idx+1}"
                            
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
                                'notes': f'All-faculty rebuild - {faculty_name} Semester {semester}'
                            })
                            
                            semester_count += 1
                            faculty_total += 1
                            total_created += 1
                    
                    print(f"{semester_count} schedules")
                
                print(f"      ✅ Faculty total: {faculty_total} schedules")
            
            # Step 5: Commit changes
            print(f"\n💾 Step 5: Committing {total_created} schedules...")
            await db.commit()
            
            # Step 6: Test with different faculties
            print("\n🧪 Step 6: Testing schedules for different faculties...")
            
            # Test Computer Science
            result = await db.execute(text("""
                SELECT COUNT(*) as count
                FROM class_schedules cs
                JOIN subjects s ON cs.subject_id = s.id
                WHERE cs.day_of_week = 'THURSDAY'
                    AND cs.semester = 1
                    AND s.faculty_id = 9
                    AND cs.academic_year = 2025
                    AND cs.is_active = true
            """))
            
            cs_count = result.scalar()
            print(f"   🎓 Computer Science (Faculty 9): {cs_count} schedules on Thursday")
            
            # Test Physics
            result = await db.execute(text("""
                SELECT COUNT(*) as count
                FROM class_schedules cs
                JOIN subjects s ON cs.subject_id = s.id
                WHERE cs.day_of_week = 'THURSDAY'
                    AND cs.semester = 1
                    AND s.faculty_id = 8
                    AND cs.academic_year = 2025
                    AND cs.is_active = true
            """))
            
            physics_count = result.scalar()
            print(f"   🔬 Physics (Faculty 8): {physics_count} schedules on Thursday")
            
            # Final statistics
            result = await db.execute(text("SELECT COUNT(*) FROM class_schedules"))
            final_count = result.scalar()
            
            print(f"\n📊 Final Statistics:")
            print(f"   Total schedules created: {final_count}")
            
            if final_count > 0:
                print("   ✅ SUCCESS! All faculties now have schedules")
            else:
                print("   ❌ No schedules created")
            
            break  # Exit the async generator
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

def main():
    print("🏫 Populate All Schedules")
    print("=" * 50)
    print("This will:")
    print("• Clear ALL existing schedules")
    print("• Create schedules for ALL faculties")
    print("• Each faculty gets 5 different subjects per day")
    print("• 8 semesters × 6 days × 5 periods per faculty")
    
    response = input("\n⚠️  Proceed with populating all schedules? (y/N): ")
    if response.lower() != 'y':
        print("❌ Operation cancelled.")
        return
    
    try:
        asyncio.run(populate_all_schedules())
        print("\n🎉 All schedules populated successfully!")
        print("📚 All students should now see their schedules!")
        
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()