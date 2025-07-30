import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import select, text
from app.models import Student, User

async def check_database():
    async with AsyncSessionLocal() as db:
        # Check students count
        count_result = await db.execute(text('SELECT COUNT(*) FROM students'))
        print('Students count:', count_result.scalar())
        
        # Check users count
        count_result = await db.execute(text('SELECT COUNT(*) FROM users'))
        print('Users count:', count_result.scalar())
        
        # Try to get all students
        try:
            result = await db.execute(select(Student))
            students = result.scalars().all()
            print('Students retrieved:', len(students))
            for student in students:
                print(f'  - Student ID: {student.id}, Student ID: {student.student_id}')
        except Exception as e:
            print('Error retrieving students:', e)

if __name__ == "__main__":
    asyncio.run(check_database())
