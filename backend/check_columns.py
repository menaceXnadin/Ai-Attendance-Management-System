import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def check_columns():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'students' ORDER BY ordinal_position"
        ))
        columns = [row[0] for row in result.fetchall()]
        print('Students table columns:', columns)

if __name__ == "__main__":
    asyncio.run(check_columns())
