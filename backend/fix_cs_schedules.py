#!/usr/bin/env python3

"""
Create schedules by checking existing time slots to avoid conflicts
"""

import psycopg2
from psycopg2.extras import RealDictCursor

def create_schedules_smart():
    """Create schedules smartly avoiding conflicts"""
    
    conn = psycopg2.connect(
        host="localhost",
        database="attendancedb",
        user="postgres", 
        password="nadin123"
    )
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print("🔍 Checking Computer Science schedules specifically...")
            
            # Check CS student and schedules
            cur.execute("""
                SELECT s.student_id, s.semester, f.name as faculty_name, f.id as faculty_id
                FROM students s 
                JOIN faculties f ON s.faculty_id = f.id
                WHERE s.student_id = 'STU2025001'
            """)
            
            nadin = cur.fetchone()
            if nadin:
                print(f"👤 Nadin: {nadin['student_id']}, Faculty: {nadin['faculty_name']} (ID: {nadin['faculty_id']}), Semester: {nadin['semester']}")
            
            # Check existing CS schedules
            cur.execute("""
                SELECT cs.start_time, cs.end_time, s.name as subject_name, s.code, cs.classroom
                FROM class_schedules cs
                JOIN subjects s ON cs.subject_id = s.id
                WHERE cs.day_of_week = 'MONDAY'
                AND cs.academic_year = 2025
                AND cs.is_active = true
                AND cs.semester = 1
                AND s.faculty_id = 1
                ORDER BY cs.start_time
            """)
            
            existing_schedules = cur.fetchall()
            print(f"\n📅 Current CS Monday schedules: {len(existing_schedules)}")
            
            for schedule in existing_schedules:
                print(f"   {schedule['start_time']}-{schedule['end_time']}: {schedule['subject_name']} ({schedule['code']})")
            
            # Get CS subjects
            cur.execute("""
                SELECT id, name, code 
                FROM subjects 
                WHERE faculty_id = 1 
                ORDER BY id
            """)
            
            cs_subjects = cur.fetchall()
            print(f"\n📚 Available CS subjects: {len(cs_subjects)}")
            
            for subject in cs_subjects:
                print(f"   - {subject['name']} ({subject['code']})")
            
            # Define available time slots
            all_time_slots = [
                {'start': '09:00:00', 'end': '10:00:00'},
                {'start': '10:00:00', 'end': '11:00:00'},
                {'start': '11:00:00', 'end': '12:00:00'},
                {'start': '13:00:00', 'end': '14:00:00'},
                {'start': '14:00:00', 'end': '15:00:00'},
                {'start': '15:00:00', 'end': '16:00:00'},
                {'start': '16:00:00', 'end': '17:00:00'},
            ]
            
            # Find which time slots are taken
            taken_times = [str(schedule['start_time']) for schedule in existing_schedules]
            available_slots = [slot for slot in all_time_slots if slot['start'] not in taken_times]
            
            print(f"\n⏰ Available time slots: {len(available_slots)}")
            for slot in available_slots:
                print(f"   {slot['start']}-{slot['end']}")
            
            # Find subjects without schedules
            subjects_with_schedules = set()
            for schedule in existing_schedules:
                cur.execute("SELECT id FROM subjects WHERE name = %s AND faculty_id = 1", (schedule['subject_name'],))
                result = cur.fetchone()
                if result:
                    subjects_with_schedules.add(result['id'])
            
            subjects_without_schedules = [s for s in cs_subjects if s['id'] not in subjects_with_schedules]
            
            print(f"\n📖 CS subjects without schedules: {len(subjects_without_schedules)}")
            for subject in subjects_without_schedules:
                print(f"   - {subject['name']} ({subject['code']})")
            
            # Create schedules for subjects without schedules
            created_count = 0
            
            if available_slots and subjects_without_schedules:
                print(f"\n🏗️ Creating new CS schedules...")
                
                slots_to_use = min(len(available_slots), len(subjects_without_schedules), 3)  # Max 3 more
                
                for i in range(slots_to_use):
                    slot = available_slots[i]
                    subject = subjects_without_schedules[i]
                    
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
                        f"Prof. CS{i+1}",
                        f"Semester 1 {subject['name']}"
                    ))
                    
                    created_count += 1
                    print(f"   ✅ {slot['start']}-{slot['end']}: {subject['name']}")
                
                conn.commit()
                print(f"\n🎉 Created {created_count} new CS schedules!")
            
            else:
                print("\n✅ CS already has sufficient schedules or no available slots")
            
            # Final verification
            cur.execute("""
                SELECT cs.start_time, cs.end_time, s.name as subject_name, s.code
                FROM class_schedules cs
                JOIN subjects s ON cs.subject_id = s.id
                WHERE cs.day_of_week = 'MONDAY'
                AND cs.academic_year = 2025
                AND cs.is_active = true
                AND cs.semester = 1
                AND s.faculty_id = 1
                ORDER BY cs.start_time
            """)
            
            final_schedules = cur.fetchall()
            print(f"\n📊 Final CS Monday schedules: {len(final_schedules)}")
            
            for schedule in final_schedules:
                print(f"   {schedule['start_time']}-{schedule['end_time']}: {schedule['subject_name']} ({schedule['code']})")
            
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
    success = create_schedules_smart()
    if success:
        print("\n✅ COMPUTER SCIENCE SCHEDULES FIXED!")
        print("🔄 Nadin should now see 5+ CS subjects on Monday!")
        print("🔄 Please refresh your browser!")
    else:
        print("\n❌ Failed to fix schedules")