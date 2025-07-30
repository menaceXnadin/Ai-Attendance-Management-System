import asyncio
from app.models import User
from app.core.database import AsyncSessionLocal
from sqlalchemy import select

async def check_students():
    async with AsyncSessionLocal() as db:
        # Get student users
        result = await db.execute(select(User).filter(User.role == 'student'))
        students = result.scalars().all()
        
        print(f'Found {len(students)} students:')
        for student in students[:5]:  # Show first 5
            print(f'  - Email: {student.email}')
            print(f'    Name: {student.full_name}')
            print(f'    Active: {student.is_active}')
            print()

if __name__ == "__main__":
    asyncio.run(check_students())
