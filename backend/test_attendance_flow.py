import asyncio
from datetime import datetime, time
from app.core.database import AsyncSessionLocal
from sqlalchemy import text, select
from app.models import AttendanceRecord, Student, User

async def test_attendance_flow():
    """Test the complete attendance marking flow"""
    
    async with AsyncSessionLocal() as db:
        print("🔍 TESTING ATTENDANCE FLOW")
        print("=" * 60)
        
        # 1. Check if we have students with face encodings
        students_with_faces = await db.execute(
            text("""
                SELECT s.id, s.student_id, u.full_name, 
                       CASE WHEN s.face_encoding IS NOT NULL THEN 'YES' ELSE 'NO' END as has_face
                FROM students s 
                JOIN users u ON s.user_id = u.id 
                WHERE s.face_encoding IS NOT NULL
                LIMIT 3
            """)
        )
        
        print("Students with registered faces:")
        face_students = students_with_faces.fetchall()
        for student in face_students:
            print(f"  ID: {student[0]} | Code: {student[1]} | Name: {student[2]} | Face: {student[3]}")
        
        if not face_students:
            print("❌ No students have registered faces!")
            return
        
        # 2. Check subjects used in attendance
        subjects_in_use = await db.execute(
            text("""
                SELECT DISTINCT ar.subject_id, s.name, s.code 
                FROM attendance_records ar
                LEFT JOIN subjects s ON ar.subject_id = s.id
                WHERE ar.subject_id IS NOT NULL
                ORDER BY ar.subject_id
                LIMIT 5
            """)
        )
        
        print(f"\nSubjects used in attendance records:")
        subjects = subjects_in_use.fetchall()
        for subject in subjects:
            print(f"  Subject ID: {subject[0]} | Name: {subject[1]} | Code: {subject[2]}")
        
        # 3. Test current time-based restrictions
        current_time = datetime.now()
        current_hour = current_time.hour
        current_minute = current_time.minute
        current_minutes_total = current_hour * 60 + current_minute
        
        print(f"\nCurrent time analysis:")
        print(f"  Time: {current_time.strftime('%H:%M')} ({current_minutes_total} minutes from midnight)")
        
        # Wednesday schedule for Computer Architecture (08:00-09:30)
        comp_arch_start = 8 * 60 + 0  # 08:00 = 480 minutes
        comp_arch_end = 9 * 60 + 30   # 09:30 = 570 minutes
        
        is_wednesday = current_time.weekday() == 2  # 0=Monday, 2=Wednesday
        is_comp_arch_period = (current_minutes_total >= comp_arch_start and 
                              current_minutes_total <= comp_arch_end)
        
        print(f"  Is Wednesday: {is_wednesday}")
        print(f"  Computer Architecture period (08:00-09:30): {comp_arch_start}-{comp_arch_end} minutes")
        print(f"  Currently in Computer Architecture period: {is_comp_arch_period}")
        
        if is_wednesday and is_comp_arch_period:
            print("✅ Attendance marking should be ALLOWED for Computer Architecture")
        elif is_wednesday and current_minutes_total > comp_arch_end:
            print("❌ Attendance marking should be BLOCKED (after 09:30)")
        elif is_wednesday and current_minutes_total < comp_arch_start:
            print("❌ Attendance marking should be BLOCKED (before 08:00)")
        else:
            print("ℹ️  Not Wednesday or not Computer Architecture time")
        
        # 4. Check recent attendance records for today
        today = current_time.date()
        todays_records = await db.execute(
            text("""
                SELECT ar.id, ar.student_id, ar.subject_id, ar.date, ar.time_in, 
                       ar.status, ar.method, ar.confidence_score,
                       s.student_id as student_code, u.full_name
                FROM attendance_records ar
                LEFT JOIN students s ON ar.student_id = s.id
                LEFT JOIN users u ON s.user_id = u.id
                WHERE ar.date = :today
                ORDER BY ar.created_at DESC
            """), {"today": today}
        )
        
        print(f"\nToday's attendance records ({today}):")
        today_records = todays_records.fetchall()
        if today_records:
            for record in today_records:
                time_in = record[4].strftime('%H:%M:%S') if record[4] else 'N/A'
                print(f"  ID: {record[0]} | Student: {record[8]} ({record[9]}) | Subject: {record[2]} | Time: {time_in} | Status: {record[5]} | Method: {record[6]}")
        else:
            print("  No attendance records for today")
        
        # 5. Simulate attendance marking constraints
        print(f"\nAttendance marking validation:")
        
        # Check if Computer Architecture subject exists in database
        comp_arch_subject = await db.execute(
            text("SELECT id, name, code FROM subjects WHERE name ILIKE '%computer%arch%' LIMIT 1")
        )
        comp_arch = comp_arch_subject.fetchone()
        
        if comp_arch:
            print(f"  Found Computer Architecture subject: ID {comp_arch[0]} - {comp_arch[1]} ({comp_arch[2]})")
            
            # For the first student with face encoding, check if they can mark attendance
            if face_students:
                test_student = face_students[0]
                student_id = test_student[0]
                
                # Check if already marked today for this subject
                existing_today = await db.execute(
                    text("""
                        SELECT id FROM attendance_records 
                        WHERE student_id = :student_id 
                        AND subject_id = :subject_id 
                        AND date = :today
                    """), {
                        "student_id": student_id,
                        "subject_id": comp_arch[0],
                        "today": today
                    }
                )
                
                already_marked = existing_today.fetchone()
                
                print(f"  Test student: {test_student[2]} (ID: {student_id})")
                print(f"  Already marked attendance today: {'YES' if already_marked else 'NO'}")
                
                # Determine if attendance should be allowed
                can_mark = (is_wednesday and is_comp_arch_period and not already_marked)
                print(f"  Can mark attendance now: {'YES' if can_mark else 'NO'}")
                
                if not can_mark:
                    reasons = []
                    if not is_wednesday:
                        reasons.append("Not Wednesday")
                    if not is_comp_arch_period:
                        if current_minutes_total < comp_arch_start:
                            reasons.append("Before period start (08:00)")
                        elif current_minutes_total > comp_arch_end:
                            reasons.append("After period end (09:30)")
                    if already_marked:
                        reasons.append("Already marked today")
                    print(f"  Reasons: {', '.join(reasons)}")
        else:
            print("  ❌ Computer Architecture subject not found in database")
        
        print("\n" + "=" * 60)
        print("✅ Attendance flow analysis complete")

if __name__ == "__main__":
    asyncio.run(test_attendance_flow())
