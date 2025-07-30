import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def check_student_data():
    async with AsyncSessionLocal() as db:
        # Check student data
        result = await db.execute(text("""
            SELECT s.id, s.student_id, s.faculty, u.full_name 
            FROM students s 
            JOIN users u ON s.user_id = u.id 
            WHERE LOWER(u.full_name) LIKE '%nadin%' OR LOWER(u.full_name) LIKE '%tamang%'
        """))
        
        students = result.fetchall()
        print('Found students:')
        for student in students:
            print(f'  - ID: {student[0]}, Student ID: {student[1]}, Faculty: {student[2]}, Name: {student[3]}')
        
        # Also check all students to see the data structure
        result = await db.execute(text("""
            SELECT s.id, s.student_id, s.faculty, u.full_name 
            FROM students s 
            JOIN users u ON s.user_id = u.id 
            LIMIT 5
        """))
        
        all_students = result.fetchall()
        print('\nAll students (first 5):')
        for student in all_students:
            print(f'  - ID: {student[0]}, Student ID: {student[1]}, Faculty: {student[2]}, Name: {student[3]}')

if __name__ == "__main__":
    asyncio.run(check_student_data())
