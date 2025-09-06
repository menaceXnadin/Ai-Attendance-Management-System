import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def check_attendance_table():
    async with AsyncSessionLocal() as db:
        # Check attendance table structure
        result = await db.execute(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'attendance_records'
            ORDER BY ordinal_position;
        """))
        
        print('Attendance Records Table Structure:')
        print('=' * 80)
        columns = result.fetchall()
        for row in columns:
            print(f'{row[0]:<20} | {row[1]:<20} | Nullable: {row[2]:<5} | Default: {str(row[3])[:20] if row[3] else "None"}')
        
        # Check if table has any records
        count_result = await db.execute(text('SELECT COUNT(*) FROM attendance_records'))
        count = count_result.scalar()
        print(f'\nTotal attendance records: {count}')
        
        if count > 0:
            # Get recent records
            result = await db.execute(text("""
                SELECT 
                    ar.id,
                    ar.student_id,
                    ar.subject_id,
                    ar.date,
                    ar.status,
                    ar.method,
                    ar.confidence_score,
                    ar.marked_by,
                    s.student_id as student_code,
                    u.full_name as student_name
                FROM attendance_records ar
                LEFT JOIN students s ON ar.student_id = s.id
                LEFT JOIN users u ON s.user_id = u.id
                ORDER BY ar.created_at DESC
                LIMIT 5;
            """))
            
            print('\nRecent Attendance Records:')
            print('=' * 120)
            records = result.fetchall()
            for record in records:
                student_code = record[8] if record[8] else "Unknown"
                student_name = record[9] if record[9] else "Unknown"
                subject_id = record[2] if record[2] else "N/A"
                date_str = str(record[3])[:19] if record[3] else "N/A"
                status = record[4] if record[4] else "N/A"
                method = record[5] if record[5] else "N/A"
                confidence = record[6] if record[6] else "N/A"
                marked_by = record[7] if record[7] else "N/A"
                print(f'ID: {record[0]:<4} | Student: {student_code:<15} ({student_name:<20}) | Subject: {subject_id:<8} | Date: {date_str:<19} | Status: {status:<8} | Method: {method:<6} | Conf: {str(confidence):<6} | By: {str(marked_by):<4}')
        
        # Check subjects table 
        subjects_count = await db.execute(text('SELECT COUNT(*) FROM subjects'))
        print(f'\nTotal subjects: {subjects_count.scalar()}')
        
        # Get sample subjects
        subjects_result = await db.execute(text('SELECT id, name, code FROM subjects LIMIT 5'))
        subjects = subjects_result.fetchall()
        print('\nSample Subjects:')
        for subject in subjects:
            print(f'ID: {subject[0]} | Name: {subject[1]} | Code: {subject[2]}')

if __name__ == "__main__":
    asyncio.run(check_attendance_table())
