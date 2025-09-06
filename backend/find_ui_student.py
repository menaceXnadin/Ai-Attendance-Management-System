import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath('.'))
from app.core.database import async_engine
from sqlalchemy import text

async def find_student_with_ui_data():
    print("🔍 Finding which student has 12/113 = 10.6% attendance...")
    print("=" * 60)
    
    async with async_engine.connect() as conn:
        query = text("""
            WITH academic_days AS (
                SELECT COUNT(*) as total_days
                FROM academic_events 
                WHERE start_date >= '2025-08-01' 
                AND start_date <= '2025-12-15' 
                AND event_type = 'CLASS' 
                AND is_active = true
            ),
            student_summary AS (
                SELECT 
                    s.id as student_db_id,
                    s.student_id as student_number,
                    s.user_id,
                    u.email,
                    COUNT(DISTINCT ar.date) as days_with_records,
                    SUM(CASE WHEN daily.present_count >= (daily.record_count * 0.5) THEN 1 ELSE 0 END) as days_present,
                    SUM(CASE WHEN daily.present_count > 0 THEN 1 ELSE 0 END) as days_with_partial
                FROM students s
                JOIN users u ON s.user_id = u.id
                LEFT JOIN attendance_records ar ON ar.student_id = s.id 
                    AND ar.date >= '2025-08-01' AND ar.date <= '2025-12-15'
                LEFT JOIN (
                    SELECT 
                        student_id,
                        date,
                        COUNT(*) as record_count,
                        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count
                    FROM attendance_records 
                    WHERE date >= '2025-08-01' AND date <= '2025-12-15'
                    GROUP BY student_id, date
                ) daily ON daily.student_id = s.id AND daily.date = ar.date
                WHERE u.role = 'student'
                GROUP BY s.id, s.student_id, s.user_id, u.email
                HAVING COUNT(DISTINCT ar.date) > 0
            )
            SELECT 
                ad.total_days,
                ss.student_db_id,
                ss.student_number,
                ss.user_id,
                ss.email,
                ss.days_present,
                ss.days_with_partial,
                ROUND((ss.days_present::numeric / ad.total_days * 100), 1) as percentage
            FROM student_summary ss
            CROSS JOIN academic_days ad
            ORDER BY ABS(ss.days_present - 12) ASC, ABS(ss.days_with_partial - 15) ASC
            LIMIT 10
        """)
        
        result = await conn.execute(query)
        rows = result.fetchall()
        
        print(f"🎯 Students ordered by similarity to UI data (12/113 = 10.6%, 15 partial):")
        print()
        
        for i, row in enumerate(rows):
            total, db_id, student_num, user_id, email, present, partial, percentage = row
            match_score = ""
            if present == 12 and partial == 15:
                match_score = " 🎯 EXACT MATCH!"
            elif present == 12:
                match_score = " ✨ Present days match!"
            elif partial == 15:
                match_score = " 📅 Partial days match!"
            
            print(f"{i+1:2d}. {student_num} (User:{user_id}, DB:{db_id})")
            print(f"    Present: {present}/{total} = {percentage}%")
            print(f"    Partial: {partial} days")
            print(f"    Email: {email}{match_score}")
            print()

asyncio.run(find_student_with_ui_data())