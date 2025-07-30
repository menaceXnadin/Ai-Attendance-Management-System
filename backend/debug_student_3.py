import asyncio
from sqlalchemy import text
from app.core.database import get_db

async def test_delete_student_3():
    async for db in get_db():
        try:
            # Check if student 3 exists
            result = await db.execute(text('SELECT id, student_id, user_id FROM students WHERE id = 3'))
            student = result.fetchone()
            if student:
                print(f'Student 3 found: ID={student[0]}, Student_ID={student[1]}, User_ID={student[2]}')
                
                # Check what's referencing this student
                try:
                    att_result = await db.execute(text('SELECT COUNT(*) FROM attendance_records WHERE student_id = 3'))
                    att_count = att_result.scalar()
                    print(f'Attendance records: {att_count}')
                except Exception as e:
                    print(f'Attendance check error: {e}')
                
                try:
                    marks_result = await db.execute(text('SELECT COUNT(*) FROM marks WHERE student_id = 3'))
                    marks_count = marks_result.scalar()
                    print(f'Marks records: {marks_count}')
                except Exception as e:
                    print(f'Marks check error: {e}')
                
                # Try to find what tables reference student_id = 3
                try:
                    # Check all possible tables
                    for table in ['attendance_records', 'marks']:
                        try:
                            result = await db.execute(text(f'SELECT COUNT(*) FROM {table} WHERE student_id = 3'))
                            count = result.scalar()
                            if count > 0:
                                print(f'Table {table} has {count} records for student_id=3')
                        except Exception as table_error:
                            print(f'Table {table} error: {table_error}')
                            
                except Exception as e:
                    print(f'Error checking references: {e}')
            else:
                print('Student 3 not found')
                
        except Exception as e:
            print(f'Main error: {e}')
            import traceback
            traceback.print_exc()
        break

if __name__ == "__main__":
    asyncio.run(test_delete_student_3())
