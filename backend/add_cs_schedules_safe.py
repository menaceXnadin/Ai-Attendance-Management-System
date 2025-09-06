#!/usr/bin/env python3

"""
Safely add more CS schedules without conflicts
"""

import psycopg2
from psycopg2.extras import RealDictCursor

def add_cs_schedules_safely():
    conn = psycopg2.connect(host='localhost', database='attendancedb', user='postgres', password='nadin123')
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print("🔍 Current CS schedules:")
            
            # Check existing CS schedules
            cur.execute("""
                SELECT cs.start_time, cs.end_time, s.name, s.code
                FROM class_schedules cs
                JOIN subjects s ON cs.subject_id = s.id
                WHERE cs.day_of_week = 'MONDAY'
                AND cs.academic_year = 2025
                AND cs.semester = 1
                AND s.faculty_id = 1
                ORDER BY cs.start_time
            """)
            
            existing = cur.fetchall()
            for schedule in existing:
                print(f"   {schedule['start_time']}-{schedule['end_time']}: {schedule['name']}")
            
            # Define completely available time slots
            safe_slots = [
                {'start': '09:00:00', 'end': '10:00:00'},
                {'start': '10:00:00', 'end': '11:00:00'},
                {'start': '13:00:00', 'end': '14:00:00'},
                {'start': '14:00:00', 'end': '15:00:00'},
            ]
            
            # Get CS subjects for semester 1 without schedules
            cur.execute("""
                SELECT s.id, s.name, s.code
                FROM subjects s
                WHERE s.faculty_id = 1
                AND s.id NOT IN (
                    SELECT DISTINCT cs.subject_id 
                    FROM class_schedules cs
                    WHERE cs.day_of_week = 'MONDAY'
                    AND cs.academic_year = 2025
                    AND cs.semester = 1
                )
                ORDER BY s.id
                LIMIT 4
            """)
            
            available_subjects = cur.fetchall()
            
            print(f"\n📚 Available CS subjects: {len(available_subjects)}")
            for subject in available_subjects:
                print(f"   - {subject['name']} ({subject['code']})")
            
            print(f"\n🏗️ Creating {min(len(safe_slots), len(available_subjects))} new schedules...")
            
            created = 0
            for i, slot in enumerate(safe_slots):
                if i < len(available_subjects):
                    subject = available_subjects[i]
                    
                    # Double-check no conflict exists
                    cur.execute("""
                        SELECT COUNT(*) as count
                        FROM class_schedules
                        WHERE faculty_id = 1
                        AND day_of_week = 'MONDAY'
                        AND semester = 1
                        AND academic_year = 2025
                        AND start_time = %s
                    """, (slot['start'],))
                    
                    conflict = cur.fetchone()['count'] > 0
                    
                    if conflict:
                        print(f"   ⚠️ Conflict at {slot['start']}, skipping")
                        continue
                    
                    cur.execute("""
                        INSERT INTO class_schedules 
                        (subject_id, faculty_id, day_of_week, start_time, end_time, 
                         semester, academic_year, classroom, instructor_name, is_active, notes)
                        VALUES (%s, 1, 'MONDAY', %s, %s, 1, 2025, %s, %s, true, %s)
                    """, (
                        subject['id'],
                        slot['start'],
                        slot['end'],
                        f"CS-{101 + i}",
                        f"Dr. Smith",
                        f"CS Semester 1 - {subject['name']}"
                    ))
                    
                    created += 1
                    print(f"   ✅ {slot['start']}-{slot['end']}: {subject['name']}")
            
            conn.commit()
            
            # Final check
            cur.execute("""
                SELECT COUNT(*) as count
                FROM class_schedules cs
                JOIN subjects s ON cs.subject_id = s.id
                WHERE cs.day_of_week = 'MONDAY'
                AND cs.academic_year = 2025
                AND cs.semester = 1
                AND s.faculty_id = 1
            """)
            
            total_schedules = cur.fetchone()['count']
            
            print(f"\n🎉 Created {created} new schedules!")
            print(f"📊 Total CS Monday schedules: {total_schedules}")
            
            if total_schedules >= 5:
                print("✅ CS students should now see 5+ subjects!")
            
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
    success = add_cs_schedules_safely()
    if success:
        print("\n🔄 PLEASE REFRESH YOUR BROWSER!")
        print("✅ Nadin (CS student) should now see more subjects!")
    else:
        print("\n❌ Failed to add schedules")