#!/usr/bin/env python3
"""
Check PostgreSQL enum types
"""

import asyncio
import sys
import os

# Add the app directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as session:
        # Check what enum types exist in the database
        result = await session.execute(text("""
            SELECT t.typname, e.enumlabel
            FROM pg_type t 
            JOIN pg_enum e ON t.oid = e.enumtypid  
            WHERE t.typname IN ('attendance_status', 'attendance_method')
            ORDER BY t.typname, e.enumsortorder;
        """))
        enums = result.fetchall()
        
        print('📊 PostgreSQL Enum Types:')
        current_type = None
        for row in enums:
            if row[0] != current_type:
                current_type = row[0]
                print(f'   {current_type}:')
            print(f'     - {row[1]}')
            
        # Check existing attendance records to see what values are stored
        result = await session.execute(text("""
            SELECT DISTINCT status, method 
            FROM attendance_records 
            LIMIT 10;
        """))
        records = result.fetchall()
        
        print('\n📝 Existing Attendance Records:')
        for row in records:
            print(f'   Status: {row[0]}, Method: {row[1]}')

if __name__ == "__main__":
    asyncio.run(main())
