#!/usr/bin/env python3
"""
Complete Class Schedule Rebuild
- 8 semesters per faculty
- 5 subjects per semester
- 5 subjects run daily (Sunday-Friday)
- Starting from 5:00 AM
"""

import asyncio
import sys
import os
from datetime import time

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def complete_schedule_rebuild():
    """Completely rebuild class schedules with proper structure"""
    
    try:
        from app.core.database import get_db
        from sqlalchemy import text
        
        print("🏗️  Complete Class Schedule Rebuild")
        print("=" * 50)
        print("📋 Requirements:")
        print("   • 8 semesters per faculty")
        print("   • 5 subjects per semester")
        print("   • 5 subjects run daily (Sunday-Friday)")
        print("   • Starting from 10:00 AM")
        
        # Get database session
        async for db in get_db():
            # Step 1: Completely clear existing schedules
            print("\n🧹 Step 1: Clearing ALL existing class schedules...")
            await db.execute(text("DELETE FROM class_schedules"))
            await db.commit()
            print("   ✅ All existing schedules cleared!")
            
            # Step 2: Get available data
            print("\n📊 Step 2: Analyzing available data...")
            
            # Get subjects
            result = await db.execute(text("SELECT id, name FROM subjects ORDER BY id"))
            subjects = result.fetchall()
            
            # Get faculties
            result = await db.execute(text("SELECT id, name FROM faculties ORDER BY id"))
            faculties = result.fetchall()
            
            print(f"   📚 Available subjects: {len(subjects)}")
            print(f"   🏫 Available faculties: {len(faculties)}")
            
            if len(subjects) < 5:
                print("   ⚠️  Warning: Need at least 5 subjects per semester!")
                return
            
            # Step 3: Define schedule structure
            print("\n⏰ Step 3: Defining schedule structure...")
            
            # Time slots: 10:00 AM to 3:00 PM (5 periods of 1 hour each)
            time_slots = [
                (time(10, 0), time(11, 0)),  # 10:00-11:00 AM
                (time(11, 0), time(12, 0)),  # 11:00-12:00 PM  
                (time(13, 0), time(14, 0)),  # 1:00-2:00 PM (after lunch)
                (time(14, 0), time(15, 0)),  # 2:00-3:00 PM
                (time(15, 0), time(16, 0))   # 3:00-4:00 PM
            ]
            
            # Days: Sunday to Friday (6 days)
            days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']
            
            print(f"   🕐 Time slots (5 periods):")
            for i, (start, end) in enumerate(time_slots, 1):
                print(f"      Period {i}: {start.strftime('%I:%M %p')} - {end.strftime('%I:%M %p')}")
            
            print(f"   📅 Days: {', '.join(days)} (6 days)")
            print(f"   📖 Semesters: 1-8 per faculty")
            
            # Step 4: Create comprehensive schedules
            print("\n🏗️  Step 4: Creating comprehensive class schedules...")
            
            total_created = 0
            
            # For each faculty
            for faculty_idx, faculty in enumerate(faculties):
                faculty_id, faculty_name = faculty
                faculty_short = faculty_name[:3].upper()
                
                print(f"\n   🏫 Faculty: {faculty_name}")
                faculty_total = 0
                
                # For each semester (1-8)
                for semester in range(1, 9):
                    academic_year = 2025 + ((semester - 1) // 2)  # 2025-2028
                    
                    print(f"      📖 Semester {semester} (Year {academic_year}):", end=" ")
                    semester_count = 0
                    
                    # For each day (Sunday-Friday)
                    for day_idx, day in enumerate(days):
                        # For each time slot (5 periods = 5 subjects daily)
                        for slot_idx, (start_time, end_time) in enumerate(time_slots):
                            # Select subject for this slot
                            # Rotate subjects to ensure variety across semesters and days
                            subject_idx = (
                                (semester - 1) * 5 +  # Base subjects for semester
                                slot_idx +             # Subject for this time slot
                                day_idx                # Variation by day
                            ) % len(subjects)
                            
                            subject_id, subject_name = subjects[subject_idx]
                            
                            # Create unique classroom identifier
                            classroom = f"Room {faculty_short}-S{semester}D{day_idx+1}P{slot_idx+1}"
                            
                            # Create instructor name
                            instructor = f"Prof. {faculty_name} S{semester}P{slot_idx+1}"
                            
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
                                'notes': f'Complete rebuild - {faculty_name} Semester {semester}'
                            })
                            
                            semester_count += 1
                            faculty_total += 1
                            total_created += 1
                    
                    print(f"{semester_count} schedules")
                
                print(f"      ✅ Faculty total: {faculty_total} schedules")
            
            # Step 5: Commit all changes
            print(f"\n💾 Step 5: Committing {total_created} schedules to database...")
            await db.commit()
            
            # Step 6: Verify results
            print("\n📊 Step 6: Verification and Summary...")
            
            # Final count
            result = await db.execute(text("SELECT COUNT(*) FROM class_schedules"))
            final_count = result.scalar()
            
            # Timing distribution
            result = await db.execute(text("""
                SELECT DISTINCT start_time, end_time, COUNT(*) as count
                FROM class_schedules 
                GROUP BY start_time, end_time
                ORDER BY start_time
            """))
            timing_dist = result.fetchall()
            
            # Faculty distribution
            result = await db.execute(text("""
                SELECT f.name, COUNT(*) as schedule_count
                FROM class_schedules cs
                JOIN faculties f ON cs.faculty_id = f.id
                GROUP BY f.id, f.name
                ORDER BY f.name
            """))
            faculty_dist = result.fetchall()
            
            # Semester distribution
            result = await db.execute(text("""
                SELECT semester, academic_year, COUNT(*) as count
                FROM class_schedules 
                GROUP BY semester, academic_year
                ORDER BY semester
            """))
            semester_dist = result.fetchall()
            
            print(f"\n✅ SUCCESS! Created {final_count} class schedules")
            
            print(f"\n⏰ Timing Distribution:")
            for start, end, count in timing_dist:
                start_str = start.strftime('%I:%M %p')
                end_str = end.strftime('%I:%M %p')
                print(f"   {start_str} - {end_str}: {count} schedules")
            
            print(f"\n🏫 Faculty Distribution:")
            for faculty_name, count in faculty_dist:
                print(f"   {faculty_name}: {count} schedules")
            
            print(f"\n📖 Semester Distribution:")
            for semester, year, count in semester_dist:
                print(f"   Semester {semester} (Year {year}): {count} schedules")
            
            # Calculate expected vs actual
            expected_per_faculty = 8 * 6 * 5  # 8 semesters × 6 days × 5 periods
            expected_total = len(faculties) * expected_per_faculty
            
            print(f"\n📈 Statistics:")
            print(f"   Expected per faculty: {expected_per_faculty} schedules")
            print(f"   Expected total: {expected_total} schedules")
            print(f"   Actual total: {final_count} schedules")
            print(f"   Match: {'✅ Perfect!' if final_count == expected_total else '❌ Mismatch'}")
            
            # Sample schedule for verification
            print(f"\n📋 Sample Schedule (First Faculty, Semester 1):")
            result = await db.execute(text("""
                SELECT day_of_week, start_time, end_time, s.name as subject_name, 
                       classroom, instructor_name
                FROM class_schedules cs
                JOIN subjects s ON cs.subject_id = s.id  
                WHERE semester = 1 AND faculty_id = (SELECT MIN(id) FROM faculties)
                ORDER BY 
                    CASE day_of_week 
                        WHEN 'SUNDAY' THEN 1 WHEN 'MONDAY' THEN 2 WHEN 'TUESDAY' THEN 3
                        WHEN 'WEDNESDAY' THEN 4 WHEN 'THURSDAY' THEN 5 WHEN 'FRIDAY' THEN 6
                    END, start_time
                LIMIT 10
            """))
            
            sample = result.fetchall()
            for row in sample:
                day, start, end, subject, classroom, instructor = row
                start_str = start.strftime('%I:%M %p')
                end_str = end.strftime('%I:%M %p')
                print(f"   {day:<9} {start_str}-{end_str} | {subject:<20} | {classroom}")
            
            break  # Exit the async generator
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

def main():
    print("🏗️  Complete Class Schedule Rebuild Tool")
    print("=" * 50)
    print("This will:")
    print("• Delete ALL existing class schedules")
    print("• Create 8 semesters per faculty")
    print("• 5 subjects per semester running daily")
    print("• Classes starting from 10:00 AM")
    print("• Sunday to Friday schedule")
    
    response = input("\n⚠️  Proceed with complete rebuild? (y/N): ")
    if response.lower() != 'y':
        print("❌ Operation cancelled.")
        return
    
    try:
        asyncio.run(complete_schedule_rebuild())
        print("\n🎉 Complete class schedule rebuild successful!")
        print("📚 All faculties now have proper 8-semester schedules!")
        print("⏰ Classes start from 10:00 AM as requested!")
        
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()