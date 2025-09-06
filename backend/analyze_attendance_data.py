import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def analyze_attendance_columns():
    async with AsyncSessionLocal() as db:
        # Get all columns in attendance_records table
        result = await db.execute(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'attendance_records'
            ORDER BY ordinal_position;
        """))
        
        print('📋 ALL ATTENDANCE_RECORDS TABLE COLUMNS:')
        print('=' * 80)
        columns = result.fetchall()
        for i, col in enumerate(columns, 1):
            nullable = 'Required' if col[2] == 'NO' else 'Optional'
            default = str(col[3])[:30] if col[3] else 'None'
            print(f'{i:2d}. {col[0]:<20} | {col[1]:<25} | {nullable:<8} | Default: {default}')
        
        print(f'\nTotal columns: {len(columns)}')
        
        # Check what data is actually being sent in recent face recognition records
        print('\n🤖 RECENT FACE RECOGNITION ATTENDANCE DATA:')
        print('=' * 80)
        
        recent_face_records = await db.execute(text("""
            SELECT 
                id, student_id, subject_id, date, time_in, time_out,
                status, method, confidence_score, location, notes,
                created_at, updated_at, marked_by
            FROM attendance_records 
            WHERE method = 'face'
            ORDER BY created_at DESC 
            LIMIT 3
        """))
        
        face_records = recent_face_records.fetchall()
        if face_records:
            for record in face_records:
                print(f'Record ID: {record[0]}')
                print(f'  student_id: {record[1]}')
                print(f'  subject_id: {record[2]}')
                print(f'  date: {record[3]}')
                print(f'  time_in: {record[4]}')
                print(f'  time_out: {record[5]}')
                print(f'  status: {record[6]}')
                print(f'  method: {record[7]}')
                print(f'  confidence_score: {record[8]}')
                print(f'  location: {record[9]}')
                print(f'  notes: {record[10]}')
                print(f'  created_at: {record[11]}')
                print(f'  updated_at: {record[12]}')
                print(f'  marked_by: {record[13]}')
                print('-' * 40)
        else:
            print('No face recognition records found')
        
        # Show what fields are NULL vs populated
        print('\n📊 DATA COMPLETENESS ANALYSIS FOR FACE RECOGNITION:')
        print('=' * 80)
        
        completeness = await db.execute(text("""
            SELECT 
                COUNT(*) as total_face_records,
                COUNT(student_id) as has_student_id,
                COUNT(subject_id) as has_subject_id,
                COUNT(date) as has_date,
                COUNT(time_in) as has_time_in,
                COUNT(time_out) as has_time_out,
                COUNT(status) as has_status,
                COUNT(method) as has_method,
                COUNT(confidence_score) as has_confidence,
                COUNT(location) as has_location,
                COUNT(notes) as has_notes,
                COUNT(marked_by) as has_marked_by
            FROM attendance_records 
            WHERE method = 'face'
        """))
        
        stats = completeness.fetchone()
        if stats and stats[0] > 0:
            total = stats[0]
            print(f'Total face recognition records: {total}')
            print(f'Fields populated:')
            print(f'  student_id: {stats[1]}/{total} ({stats[1]/total*100:.1f}%)')
            print(f'  subject_id: {stats[2]}/{total} ({stats[2]/total*100:.1f}%)')
            print(f'  date: {stats[3]}/{total} ({stats[3]/total*100:.1f}%)')
            print(f'  time_in: {stats[4]}/{total} ({stats[4]/total*100:.1f}%)')
            print(f'  time_out: {stats[5]}/{total} ({stats[5]/total*100:.1f}%)')
            print(f'  status: {stats[6]}/{total} ({stats[6]/total*100:.1f}%)')
            print(f'  method: {stats[7]}/{total} ({stats[7]/total*100:.1f}%)')
            print(f'  confidence_score: {stats[8]}/{total} ({stats[8]/total*100:.1f}%)')
            print(f'  location: {stats[9]}/{total} ({stats[9]/total*100:.1f}%)')
            print(f'  notes: {stats[10]}/{total} ({stats[10]/total*100:.1f}%)')
            print(f'  marked_by: {stats[11]}/{total} ({stats[11]/total*100:.1f}%)')

if __name__ == "__main__":
    asyncio.run(analyze_attendance_columns())
