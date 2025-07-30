#!/usr/bin/env python3
"""
Check Admin Table Schema
"""
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def check_admin_schema():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'admins' ORDER BY ordinal_position"
        ))
        columns = [(row[0], row[1]) for row in result.fetchall()]
        print('Admins table columns:')
        for col_name, col_type in columns:
            print(f"  {col_name}: {col_type}")

if __name__ == "__main__":
    asyncio.run(check_admin_schema())
