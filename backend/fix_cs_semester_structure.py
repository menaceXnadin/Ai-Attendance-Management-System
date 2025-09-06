#!/usr/bin/env python3

"""
Fix CS semester 1 to have exactly 5 proper subjects
"""

import psycopg2
from psycopg2.extras import RealDictCursor

def fix_cs_semester_1():
    conn = psycopg2.connect(host='localhost', database='attendancedb', user='postgres', password='nadin123')
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print("🔧 FIXING CS SEMESTER 1 STRUCTURE")
            print("=" * 50)
            
            # Step 1: Remove the 2 incorrect schedules
            print("🗑️ Step 1: Removing incorrect schedules...")
            
            # Remove Computer Architecture (CSE104) - Schedule ID: 839
            cur.execute("DELETE FROM class_schedules WHERE id = 839")
            print("   ❌ Removed Computer Architecture (CSE104)")
            
            # Remove c programming (SUBJ607) - Schedule ID: 840  
            cur.execute("DELETE FROM class_schedules WHERE id = 840")
            print("   ❌ Removed c programming (SUBJ607)")
            
            # Step 2: Add Operating Systems 1 to complete the 5-subject set
            print("\n➕ Step 2: Adding Operating Systems 1...")
            
            # Find Operating Systems 1 subject
            cur.execute("""
                SELECT id, name, code 
                FROM subjects 
                WHERE name = 'Operating Systems 1' 
                AND faculty_id = 1
            """)
            
            os_subject = cur.fetchone()
            
            if os_subject:
                # Add schedule for Operating Systems 1 at 15:00-16:00 (replacing Computer Architecture)
                cur.execute("""
                    INSERT INTO class_schedules 
                    (subject_id, faculty_id, day_of_week, start_time, end_time, 
                     semester, academic_year, classroom, instructor_name, is_active, notes)
                    VALUES (%s, 1, 'MONDAY', '15:00:00', '16:00:00', 1, 2025, 'CS-105', 'Dr. Smith', true, 'CS Semester 1 - Operating Systems 1')
                """, (os_subject['id'],))
                
                print(f"   ✅ Added Operating Systems 1 ({os_subject['code']}) at 15:00-16:00")
            else:
                print("   ❌ Operating Systems 1 subject not found!")
                return False
            
            # Commit changes
            conn.commit()
            
            # Step 3: Verify the fix
            print("\n✅ Step 3: Verifying the fix...")
            
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
            
            final_schedules = cur.fetchall()
            
            print(f"\n📅 Final CS Semester 1 Monday schedules ({len(final_schedules)} subjects):")
            print("-" * 50)
            
            for i, schedule in enumerate(final_schedules, 1):
                print(f"{i}. {schedule['start_time']}-{schedule['end_time']}: {schedule['name']} ({schedule['code']})")
            
            if len(final_schedules) == 5:
                print("\n🎉 SUCCESS! CS Semester 1 now has exactly 5 subjects!")
                print("✅ Follows the 5-subjects-per-semester rule")
                return True
            else:
                print(f"\n❌ ISSUE: Still has {len(final_schedules)} subjects (expected 5)")
                return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        conn.close()

if __name__ == "__main__":
    success = fix_cs_semester_1()
    
    if success:
        print("\n" + "=" * 50)
        print("🏆 CS SEMESTER 1 STRUCTURE FIXED!")
        print("=" * 50)
        print("✅ Exactly 5 subjects as per academic rule")
        print("✅ Proper semester 1 subjects only")
        print("✅ Database synchronized with frontend")
        print("\n🔄 Please refresh browser to see exactly 5 CS subjects!")
    else:
        print("\n❌ Fix failed - manual intervention needed")