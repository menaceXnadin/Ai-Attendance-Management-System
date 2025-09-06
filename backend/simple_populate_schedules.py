#!/usr/bin/env python3
"""
Simple Populate Schedules - Just populate the basic data without conflicts
"""

import asyncio
import sys
import os
from datetime import time
import uuid

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def simple_populate_schedules():
    """Simple schedule population without classroom conflicts"""
    
    try:
        from app.core.database import get_db
        from sqlalchemy import text
        
        print("📚 Simple Populate Schedules")
        print("=" * 50)
        
        # Get database session
        async for db in get_db():
            # Step 1: Clear existing schedules
            print("🧹 Clearing existing schedules...")
            await db.execute(text("DELETE FROM class_schedules"))
            await db.commit()
            print("   ✅ Cleared!")
            
            # Step 2: Get faculties and subjects
            print("\n📊 Getting data...")
            
            # Get all faculties
            result = await db.execute(text("SELECT id, name FROM faculties ORDER BY id"))
            faculties = result.fetchall()
            print(f"   🏫 Faculties: {len(faculties)}")
            
            # Step 3: Create schedules
            print("\n🏗️  Creating schedules...")
            
            # Time slots
            time_slots = [
                (time(10, 0), time(11, 0)),  # 10:00-11:00 AM
                (time(11, 0), time(12, 0)),  # 11:00-12:00 PM  
                (time(13, 0), time(14, 0)),  # 1:00-2:00 PM
                (time(14, 0), time(15, 0)),  # 2:00-3:00 PM
                (time(15, 0), time(16, 0))   # 3:00-4:00 PM
            ]
            
            days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']
            
            total_created = 0
            
            for faculty_id, faculty_name in faculties:
                print(f"   🏫 {faculty_name}:", end=" ")
                
                # Get subjects for this faculty
                result = await db.execute(text("""
                    SELECT id, name, code FROM subjects 
                    WHERE faculty_id = :faculty_id 
                    ORDER BY id
                    LIMIT 5
                """), {"faculty_id": faculty_id})
                
                subjects = result.fetchall()
                
                if len(subjects) < 5:
                    print("❌ Not enough subjects")
                    continue
                
                faculty_count = 0
                
                # Create schedules for semester 1 only (to start simple)
                semester = 1
                academic_year = 2025
                
                for day in days:
                    for slot_idx, (start_time, end_time) in enumerate(time_slots):
                        # Use different subject for each time slot
                        subject_id, subject_name, subject_code = subjects[slot_idx]
                        
                        # Create unique classroom with UUID to avoid conflicts
                        unique_id = str(uuid.uuid4())[:8]
                        classroom = f"{faculty_name[:3]}-{unique_id}"
                        
                        instructor = f"Prof. {faculty_name[:10]}"
                        
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
                            'notes': f'Simple populate - {faculty_name}'
                        })
                        
                        faculty_count += 1
                        total_created += 1
                
                print(f"✅ {faculty_count} schedules")
            
            # Commit all changes
            print(f"\n💾 Committing {total_created} schedules...")
            await db.commit()
            
            # Test the result
            print("\n🧪 Testing...")
            
            # Check Computer Science schedules
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
            print(f"   🎓 Computer Science Thursday schedules: {cs_count}")
            
            # Check total
            result = await db.execute(text("SELECT COUNT(*) FROM class_schedules"))
            final_count = result.scalar()
            
            print(f"\n📊 Results:")
            print(f"   Total schedules: {final_count}")
            
            if final_count > 0:
                print("   ✅ SUCCESS! Schedules populated")
                print("   🔄 Refresh your frontend to see schedules")
            else:
                print("   ❌ No schedules created")
            
            break
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

def main():
    print("📚 Simple Populate Schedules")
    print("=" * 50)
    print("This will populate basic schedules for all faculties")
    
    try:
        asyncio.run(simple_populate_schedules())
        print("\n🎉 Done! Check your frontend now.")
        
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()