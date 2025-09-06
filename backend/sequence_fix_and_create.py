#!/usr/bin/env python3

"""
SEQUENCE FIX: Reset database sequences and create schedules properly
"""

import psycopg2
from psycopg2.extras import RealDictCursor

def sequence_fix_and_create():
    """Fix sequences and create schedules properly"""
    
    conn = psycopg2.connect(host='localhost', database='attendancedb', user='postgres', password='nadin123')
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print("🔧 SEQUENCE FIX AND TARGETED CREATION")
            print("=" * 50)
            print("🔄 Fixing database sequences")
            print("📚 Creating schedules for all faculty-semester combinations with students")
            print()
            
            # First, reset sequences to avoid conflicts
            print("🔄 Resetting sequences...")
            
            # Get max ID from subjects table
            cur.execute("SELECT COALESCE(MAX(id), 0) FROM subjects")
            max_subject_id = cur.fetchone()['coalesce']
            
            # Get max ID from class_schedules table  
            cur.execute("SELECT COALESCE(MAX(id), 0) FROM class_schedules")
            max_schedule_id = cur.fetchone()['coalesce']
            
            # Reset sequences
            cur.execute(f"ALTER SEQUENCE subjects_id_seq RESTART WITH {max_subject_id + 1}")
            cur.execute(f"ALTER SEQUENCE class_schedules_id_seq RESTART WITH {max_schedule_id + 1}")
            
            print("✅ Sequences reset")
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
                
                # Check if this combination already has exactly 5 schedules
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
                elif existing_count > 0:
                    print(f"🧹 Cleaning {existing_count} existing...", end=" ")
                    
                    # Get existing subject IDs to clean up
                    cur.execute("""
                        SELECT DISTINCT cs.subject_id
                        FROM class_schedules cs
                        JOIN subjects s ON cs.subject_id = s.id
                        WHERE s.faculty_id = %s AND cs.semester = %s
                    """, (faculty_id, semester))
                    
                    subject_ids = [row['subject_id'] for row in cur.fetchall()]
                    
                    if subject_ids:
                        # Delete schedules first
                        for subject_id in subject_ids:
                            cur.execute("DELETE FROM class_schedules WHERE subject_id = %s", (subject_id,))
                        
                        # Delete subjects
                        for subject_id in subject_ids:
                            cur.execute("DELETE FROM subjects WHERE id = %s", (subject_id,))
                
                # Create exactly 5 subjects with unique codes
                subject_data = [
                    (f"{faculty_name} Core Subject", f"{faculty_name[:3].upper()}{semester}01-{faculty_id}"),
                    (f"{faculty_name} Advanced Topic", f"{faculty_name[:3].upper()}{semester}02-{faculty_id}"),
                    (f"{faculty_name} Practical Course", f"{faculty_name[:3].upper()}{semester}03-{faculty_id}"),
                    (f"{faculty_name} Theory Module", f"{faculty_name[:3].upper()}{semester}04-{faculty_id}"),
                    (f"{faculty_name} Specialization", f"{faculty_name[:3].upper()}{semester}05-{faculty_id}")
                ]
                
                created_subjects = []
                
                for subject_name, subject_code in subject_data:
                    cur.execute("""
                        INSERT INTO subjects (name, code, credits, faculty_id)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                    """, (subject_name, subject_code, 3, faculty_id))
                    
                    subject_id = cur.fetchone()['id']
                    created_subjects.append(subject_id)
                
                # Create schedules for each subject
                time_slots = [
                    ('09:00:00', '10:00:00'),
                    ('10:00:00', '11:00:00'), 
                    ('11:00:00', '12:00:00'),
                    ('14:00:00', '15:00:00'),
                    ('15:00:00', '16:00:00')
                ]
                
                for i, subject_id in enumerate(created_subjects):
                    start_time, end_time = time_slots[i]
                    classroom = f"{faculty_name[:3].upper()}-{semester}{i+1:02d}-{faculty_id}"
                    instructor = f"Prof. {faculty_name} {i+1}"
                    
                    cur.execute("""
                        INSERT INTO class_schedules 
                        (subject_id, faculty_id, day_of_week, start_time, end_time, 
                         classroom, instructor_name, semester, academic_year, is_active)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        subject_id, faculty_id, 'MONDAY', start_time, end_time,
                        classroom, instructor, semester, 2025, True
                    ))
                
                total_schedules_created += 5
                fixed_combinations += 1
                print("✅ Created 5 subjects + 5 schedules")
            
            conn.commit()
            
            print(f"\n🎉 SEQUENCE FIX AND CREATION COMPLETED!")
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
    success = sequence_fix_and_create()
    
    if success:
        print("\n✅ SEQUENCE FIX COMPLETED! Now running verification...")
        
        # Run verification
        import subprocess
        subprocess.run(["python", "final_comprehensive_verification.py"])
    else:
        print("\n❌ SEQUENCE FIX FAILED!")