import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def fix_faculty_column():
    async with AsyncSessionLocal() as db:
        try:
            # Rename column from class_name to faculty
            await db.execute(text('ALTER TABLE students RENAME COLUMN class_name TO faculty'))
            await db.commit()
            print('✅ Successfully renamed class_name to faculty')
        except Exception as e:
            print(f'❌ Error: {e}')

if __name__ == "__main__":
    asyncio.run(fix_faculty_column())
