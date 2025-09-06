#!/usr/bin/env python3

"""
SAFE COMPREHENSIVE FIX: Work with existing data, create missing schedules
"""

import psycopg2
from psycopg2.extras import RealDictCursor

def safe_comprehensive_fix():
    """Safely create missing schedules without deleting existing data"""
    
    conn = psycopg2.connect(host='localhost', database='attendancedb', user='postgres', password='nadin123')
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print("🛡️ SAFE COMPREHENSIVE FIX")
            print("=" * 50)
            print("✅ Working with existing data safely")
            print("📚 Creating missing schedules to reach exactly 5 per faculty-semester")
            print()
            
            # Find all faculty-semester combinations that have students
            cur.execute("""
                SELECT DISTINCT s.faculty_id, f.name as faculty_name, s.semester
                FROM students s
                JOIN faculties f ON s.faculty_id = f.id
                WHERE s.semester IS NOT NULL
                ORDER BY f.name, s.semester
            """)
            
            student_combinations = cur.fetchall()
            
            print(f"🎓 Found {len(student_combinations)} faculty-semester combinations with students")
            print()
            
            fixed_combinations = 0
            total_schedules_created = 0
            
            for combo in student_combinations:
                faculty_id = combo['faculty_id']
                faculty_name = combo['faculty_name']
                semester = combo['semester']
                
                print(f"🔧 Processing: {faculty_name} Semester {semester}...", end=" ")
                
                # Check current schedule count
                cur.execute("""
                    SELECT COUNT(DISTINCT cs.subject_id) as count
                    FROM class_schedules cs
                    JOIN subjects s ON cs.subject_id = s.id
                    WHERE s.faculty_id = %s AND cs.semester = %s
                """, (faculty_id, semester))
                
                existing_count = cur.fetchone()['count']
                
                if existing_count == 5:
                    print("✅ Already perfect")
                    continue
                elif existing_count > 5:
                    print(f"⚠️ Has {existing_count} schedules (keeping as-is due to attendance records)")
                    continue
                else:
                    needed_count = 5 - existing_count
                    print(f"📚 Need {needed_count} more schedules...", end=" ")
                    
                    # Get existing time slots to avoid conflicts
                    cur.execute("""
                        SELECT cs.start_time, cs.end_time
                        FROM class_schedules cs
                        JOIN subjects s ON cs.subject_id = s.id
                        WHERE s.faculty_id = %s AND cs.semester = %s
                    """, (faculty_id, semester))
                    
                    existing_times = [(row['start_time'], row['end_time']) for row in cur.fetchall()]
                    
                    # Available time slots
                    all_time_slots = [
                        ('09:00:00', '10:00:00'),
                        ('10:00:00', '11:00:00'),
                        ('11:00:00', '12:00:00'),
                        ('14:00:00', '15:00:00'),
                        ('15:00:00', '16:00:00'),
                        ('16:00:00', '17:00:00'),
                        ('08:00:00', '09:00:00')
                    ]
                    
                    # Find available slots
                    available_slots = []
                    for slot in all_time_slots:
                        if slot not in existing_times and len(available_slots) < needed_count:
                            available_slots.append(slot)
                    
                    # Create the missing subjects and schedules
                    for i in range(needed_count):
                        subject_name = f"{faculty_name} Subject {existing_count + i + 1}"
                        subject_code = f"{faculty_name[:3].upper()}{semester}{existing_count + i + 1:02d}-{faculty_id}"
                        
                        # Create subject
                        cur.execute("""
                            INSERT INTO subjects (name, code, credits, faculty_id)
                            VALUES (%s, %s, %s, %s)
                            RETURNING id
                        """, (subject_name, subject_code, 3, faculty_id))
                        
                        subject_id = cur.fetchone()['id']
                        
                        # Use available time slot
                        if i < len(available_slots):
                            start_time, end_time = available_slots[i]
                        else:
                            # Fallback to sequential times
                            base_hour = 9 + existing_count + i
                            start_time = f"{base_hour:02d}:00:00"
                            end_time = f"{base_hour + 1:02d}:00:00"
                        
                        classroom = f"{faculty_name[:3].upper()}-{semester}{existing_count + i + 1:02d}-{faculty_id}"
                        instructor = f"Prof. {faculty_name} {existing_count + i + 1}"
                        
                        # Create schedule
                        cur.execute("""
                            INSERT INTO class_schedules 
                            (subject_id, faculty_id, day_of_week, start_time, end_time, 
                             classroom, instructor_name, semester, academic_year, is_active)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            subject_id, faculty_id, 'MONDAY', start_time, end_time,
                            classroom, instructor, semester, 2025, True
                        ))
                        
                        total_schedules_created += 1
                    
                    fixed_combinations += 1
                    print(f"✅ Added {needed_count} schedules")
            
            conn.commit()
            
            print(f"\n🎉 SAFE COMPREHENSIVE FIX COMPLETED!")
            print(f"📊 Fixed {fixed_combinations} faculty-semester combinations")
            print(f"📊 Total schedules created: {total_schedules_created}")
            
            return True
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        return False
    
    finally:
        conn.close()

if __name__ == "__main__":
    print("🛡️ RUNNING SAFE COMPREHENSIVE FIX")
    print("✅ Preserving existing data and attendance records")
    print("📚 Creating missing schedules to ensure 5 per faculty-semester")
    print()
    
    success = safe_comprehensive_fix()
    
    if success:
        print("\n✅ SAFE FIX COMPLETED! Now running verification...")
        
        # Run verification
        import subprocess
        result = subprocess.run(["python", "final_comprehensive_verification.py"], 
                               capture_output=True, text=True)
        print(result.stdout)
    else:
        print("\n❌ SAFE FIX FAILED!")