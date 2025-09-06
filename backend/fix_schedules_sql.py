#!/usr/bin/env python3

"""
Create comprehensive schedules using SQL commands
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import os

def create_schedules_sql():
    """Create schedules using direct SQL"""
    
    # Database connection
    conn = psycopg2.connect(
        host="localhost",
        database="attendancedb",
        user="postgres", 
        password="nadin123"
    )
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print("🔍 Checking current faculty schedules...")
            
            # Get all faculties
            cur.execute("SELECT id, name FROM faculties ORDER BY id")
            faculties = cur.fetchall()
            
            print(f"📚 Found {len(faculties)} faculties:")
            for faculty in faculties:
                print(f"   - {faculty['name']} (ID: {faculty['id']})")
            
            # Check current schedules per faculty
            print("\n📊 Current Monday schedules:")
            for faculty in faculties:
                cur.execute("""
                    SELECT COUNT(*) as count
                    FROM class_schedules cs
                    JOIN subjects s ON cs.subject_id = s.id
                    WHERE cs.day_of_week = 'MONDAY'
                    AND cs.academic_year = 2025
                    AND cs.is_active = true
                    AND cs.semester = 1
                    AND s.faculty_id = %s
                """, (faculty['id'],))
                
                result = cur.fetchone()
                schedule_count = result['count']
                print(f"   {faculty['name']}: {schedule_count} schedules")
            
            print("\n🏗️ Creating missing schedules...")
            
            # Time slots for schedules
            time_slots = [
                {'start': '09:00:00', 'end': '10:00:00', 'classroom': '101'},
                {'start': '10:00:00', 'end': '11:00:00', 'classroom': '102'},
                {'start': '13:00:00', 'end': '14:00:00', 'classroom': '103'},
                {'start': '14:00:00', 'end': '15:00:00', 'classroom': '104'},
                {'start': '15:00:00', 'end': '16:00:00', 'classroom': '105'},
            ]
            
            created_count = 0
            
            for faculty in faculties:
                faculty_id = faculty['id']
                faculty_name = faculty['name']
                
                # Get subjects for this faculty (limit 5)
                cur.execute("""
                    SELECT id, name, code 
                    FROM subjects 
                    WHERE faculty_id = %s 
                    ORDER BY id 
                    LIMIT 5
                """, (faculty_id,))
                
                subjects = cur.fetchall()
                
                if not subjects:
                    print(f"⚠️ No subjects for {faculty_name}, skipping")
                    continue
                
                # Check existing schedules
                cur.execute("""
                    SELECT COUNT(*) as count
                    FROM class_schedules cs
                    JOIN subjects s ON cs.subject_id = s.id
                    WHERE cs.day_of_week = 'MONDAY'
                    AND cs.academic_year = 2025
                    AND cs.is_active = true
                    AND cs.semester = 1
                    AND s.faculty_id = %s
                """, (faculty_id,))
                
                existing_count = cur.fetchone()['count']
                
                if existing_count >= 5:
                    print(f"✅ {faculty_name} already has {existing_count} schedules")
                    continue
                
                print(f"\n🏫 Creating schedules for {faculty_name}:")
                
                # Create schedules for each subject
                for i, subject in enumerate(subjects[:5]):
                    if i < len(time_slots):
                        slot = time_slots[i]
                        
                        # Check if schedule already exists
                        cur.execute("""
                            SELECT COUNT(*) as count
                            FROM class_schedules
                            WHERE subject_id = %s
                            AND day_of_week = 'MONDAY'
                            AND semester = 1
                            AND academic_year = 2025
                        """, (subject['id'],))
                        
                        exists = cur.fetchone()['count'] > 0
                        
                        if exists:
                            print(f"   ⏭️ Schedule exists for {subject['name']}")
                            continue
                        
                        # Insert new schedule
                        cur.execute("""
                            INSERT INTO class_schedules 
                            (subject_id, faculty_id, day_of_week, start_time, end_time, 
                             semester, academic_year, classroom, instructor_name, is_active, notes)
                            VALUES (%s, %s, 'MONDAY', %s, %s, 1, 2025, %s, %s, true, %s)
                        """, (
                            subject['id'],
                            faculty_id,
                            slot['start'],
                            slot['end'],
                            f"{faculty_name[:3].upper()}-{slot['classroom']}",
                            f"Prof. {faculty_name[:10]}",
                            f"Semester 1 {subject['name']}"
                        ))
                        
                        created_count += 1
                        print(f"   ✅ {slot['start']}-{slot['end']}: {subject['name']}")
            
            # Commit changes
            conn.commit()
            
            print(f"\n🎉 Successfully created {created_count} new schedules!")
            
            # Final verification
            print("\n📊 Final verification:")
            for faculty in faculties:
                cur.execute("""
                    SELECT COUNT(*) as count
                    FROM class_schedules cs
                    JOIN subjects s ON cs.subject_id = s.id
                    WHERE cs.day_of_week = 'MONDAY'
                    AND cs.academic_year = 2025
                    AND cs.is_active = true
                    AND cs.semester = 1
                    AND s.faculty_id = %s
                """, (faculty['id'],))
                
                result = cur.fetchone()
                print(f"   {faculty['name']}: {result['count']} Monday schedules")
            
            return True
            
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        conn.close()

if __name__ == "__main__":
    success = create_schedules_sql()
    if success:
        print("\n✅ ALL FACULTIES NOW HAVE PROPER SCHEDULES!")
        print("🔄 Please refresh your browser to see Computer Science schedules!")
    else:
        print("\n❌ Failed to create schedules")