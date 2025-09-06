#!/usr/bin/env python3
"""
Check for testnadin event in the database
"""
import asyncio
import sys
import os

# Add the current directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import select, text
    from app.models.calendar import AcademicEvent
    from app.core.config import settings
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

async def check_testnadin_event():
    try:
        engine = create_async_engine(settings.database_url)
        AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with AsyncSessionLocal() as session:
            # Check for testnadin events
            result = await session.execute(
                select(AcademicEvent).where(AcademicEvent.title.ilike('%testnadin%'))
            )
            events = result.scalars().all()
            
            if events:
                print(f'Found {len(events)} event(s) with "testnadin" in the title:')
                print('=' * 50)
                for event in events:
                    print(f'ID: {event.id}')
                    print(f'Title: {event.title}')
                    print(f'Description: {event.description}')
                    print(f'Event Type: {event.event_type}')
                    print(f'Start Date: {event.start_date}')
                    print(f'Start Time: {event.start_time}')
                    print(f'End Time: {event.end_time}')
                    print(f'Is All Day: {event.is_all_day}')
                    print(f'Created At: {event.created_at}')
                    print(f'Created By: {event.created_by}')
                    print('-' * 30)
            else:
                print('No events found with "testnadin" in the title')
                
            # Also check recent events (last 10)
            print('\nLast 10 events created:')
            print('=' * 50)
            recent_result = await session.execute(
                select(AcademicEvent).order_by(AcademicEvent.created_at.desc()).limit(10)
            )
            recent_events = recent_result.scalars().all()
            
            for event in recent_events:
                print(f'ID: {event.id}, Title: "{event.title}", Created: {event.created_at}')
        
        await engine.dispose()
        
    except Exception as e:
        print(f"Error checking database: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_testnadin_event())
