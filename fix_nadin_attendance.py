#!/usr/bin/env python3

import asyncio
import asyncpg

async def fix_nadin_attendance():
    """Clean up Nadin's attendance records - remove subjects she shouldn't have"""
    
    conn = await asyncpg.connect(
        host="localhost",
        port=5432,
        user="postgres", 
        password="nadin123",
        database="attendancedb"
    )
    
    try:
        # Get Nadin's student ID
        user_info = await conn.fetchrow("""
            SELECT u.id as user_id, u.email, u.full_name, s.id as student_id
            FROM users u
            LEFT JOIN students s ON u.id = s.user_id
            WHERE u.email = 'nadin@gmail.com'
        """)
        
        if not user_info:
            print("❌ Nadin not found")
            return
            
        student_id = user_info['student_id']
        print(f"✅ Fixing attendance for: {user_info['full_name']} (Student ID: {student_id})")
        
        # Nadin should only have these 5 CS subjects
        correct_subjects = [
            'Programming Fundamentals 1',
            'Data Structures 1', 
            'Algorithms 1',
            'Database Systems 1',
            'Operating Systems 1'
        ]
        
        # Get wrong attendance records
        wrong_records = await conn.fetch("""
            SELECT ar.id, s.name as subject_name, ar.date, ar.status
            FROM attendance_records ar
            JOIN subjects s ON ar.subject_id = s.id
            WHERE ar.student_id = $1 
            AND s.name NOT IN ('Programming Fundamentals 1', 'Data Structures 1', 'Algorithms 1', 'Database Systems 1', 'Operating Systems 1')
        """, student_id)
        
        print(f"\n🗑️ Deleting {len(wrong_records)} wrong attendance records:")
        
        for record in wrong_records:
            print(f"   - Deleting: {record['subject_name']} on {record['date']} ({record['status']})")
        
        # Delete the wrong records
        if wrong_records:
            wrong_ids = [record['id'] for record in wrong_records]
            await conn.execute("""
                DELETE FROM attendance_records 
                WHERE id = ANY($1)
            """, wrong_ids)
            
            print(f"\n✅ Deleted {len(wrong_records)} wrong attendance records")
        
        # Check what's left for September 2nd
        sep_2_records = await conn.fetch("""
            SELECT 
                s.name as subject_name,
                ar.status,
                ar.date,
                ar.created_at
            FROM attendance_records ar
            JOIN subjects s ON ar.subject_id = s.id
            WHERE ar.student_id = $1 AND ar.date = '2025-09-02'
            ORDER BY ar.created_at
        """, student_id)
        
        print(f"\n📅 September 2nd attendance after cleanup:")
        print("-" * 60)
        
        if not sep_2_records:
            print("❌ No attendance records for September 2nd")
        else:
            for record in sep_2_records:
                status_emoji = "✅" if record['status'] == 'present' else "❌"
                print(f"{status_emoji} {record['subject_name']}: {record['status']}")
        
        # Check overall status for September 2nd
        if sep_2_records:
            present_count = sum(1 for r in sep_2_records if r['status'] == 'present')
            absent_count = sum(1 for r in sep_2_records if r['status'] == 'absent')
            total_count = len(sep_2_records)
            
            if absent_count > 0 and present_count == 0:
                status = "absent (red)"
            elif present_count > 0 and absent_count == 0:
                status = "present (green)"
            elif present_count > 0 and absent_count > 0:
                status = "partial (yellow)"
            else:
                status = "unknown"
                
            print(f"\n🎯 September 2nd calendar status: {status}")
            print(f"   Present: {present_count}/{total_count}")
            print(f"   Absent: {absent_count}/{total_count}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_nadin_attendance())