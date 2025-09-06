#!/usr/bin/env python3
"""
Check for test events in the database
"""
import asyncio
import sys
import os

# Add the current directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.calendar import AcademicEvent
from app.core.config import settings

async def check_test_event():
    engine = create_async_engine(settings.database_url)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AcademicEvent).where(AcademicEvent.title.ilike('%test%'))
        )
        events = result.scalars().all()
        
        if events:
            print(f'Found {len(events)} test event(s):')
            for event in events:
                print(f'  ID: {event.id}, Title: "{event.title}", Color: {event.color_code}, Date: {event.start_date}')
        else:
            print('No test events found')
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_test_event())
