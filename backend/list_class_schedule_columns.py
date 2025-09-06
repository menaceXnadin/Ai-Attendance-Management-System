import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def list_columns():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'class_schedules'
            ORDER BY ordinal_position
        """))
        columns = [row[0] for row in result.fetchall()]
        print('class_schedules columns:')
        for col in columns:
            print(f'- {col}')

if __name__ == "__main__":
    asyncio.run(list_columns())
