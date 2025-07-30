import asyncio
from app.core.database import async_engine
from sqlalchemy import text

async def check_faculty_data():
    async with async_engine.begin() as conn:
        result = await conn.execute(text("SELECT DISTINCT faculty FROM students;"))
        rows = result.fetchall()
        print('Current faculty values in students table:')
        for row in rows:
            print(f'  {row[0]}')

if __name__ == "__main__":
    asyncio.run(check_faculty_data())
