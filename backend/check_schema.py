import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from sqlalchemy import text

async def check_schema():
    async for db in get_db():
        result = await db.execute(text("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'students' ORDER BY ordinal_position"))
        columns = result.fetchall()
        print('Students table columns:')
        for col in columns:
            print(f'  {col[0]}: {col[1]} (nullable: {col[2]})')
        break

asyncio.run(check_schema())
