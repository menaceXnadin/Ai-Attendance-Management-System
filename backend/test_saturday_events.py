#!/usr/bin/env python3
"""
Quick test to verify Saturday holidays are in the database
"""
import asyncio
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from sqlalchemy.ext.asyncio import AsyncSession
from core.database import async_engine
from models.calendar import AcademicEvent, EventType
from sqlalchemy import select, and_
from datetime import datetime
import calendar

async def test_saturday_events():
    """Test if Saturday holidays exist in the database"""
    print("🔍 Testing Saturday holidays in database...")
    
    async with AsyncSession(async_engine) as session:
        # First, let's see what events exist in general
        result = await session.execute(select(AcademicEvent))
        all_events = result.scalars().all()
        
        print(f"📊 Total events in database: {len(all_events)}")
        
        if all_events:
            print("Sample events:")
            for i, event in enumerate(all_events[:5]):  # Show first 5
                print(f"  {i+1}. {event.title} - {event.event_type} - {event.start_date}")
        
        # Check for any Saturday events specifically 
        saturday_events = []
        for event in all_events:
            if event.start_date and event.start_date.weekday() == 5:  # Saturday is weekday 5
                saturday_events.append(event)
        
        print(f"📅 Found {len(saturday_events)} events on Saturdays")
        
        for event in saturday_events[:10]:  # Show first 10 Saturday events
            print(f"  - {event.start_date} ({calendar.day_name[event.start_date.weekday()]}): {event.title} ({event.event_type})")
        
        # Check for events with "Saturday" in title
        saturday_title_events = [e for e in all_events if "saturday" in e.title.lower()]
        print(f"🔍 Found {len(saturday_title_events)} events with 'Saturday' in title")
        
        for event in saturday_title_events[:5]:
            print(f"  - {event.title} - {event.event_type} - {event.start_date}")
        
        # Check today specifically
        today = datetime.now().date()
        today_events = [e for e in all_events if e.start_date == today]
        print(f"� Events today ({today}): {len(today_events)}")
        
        for event in today_events:
            print(f"  - {event.title} ({event.event_type})")
        
        # Check for August 2025 specifically (current view)
        august_events = [e for e in all_events if e.start_date and 
                        e.start_date.year == 2025 and e.start_date.month == 8]
        print(f"📅 Events in August 2025: {len(august_events)}")
        
        august_saturdays = [e for e in august_events if e.start_date.weekday() == 5]
        print(f"🔍 Saturday events in August 2025: {len(august_saturdays)}")
        
        for event in august_saturdays:
            print(f"  - {event.start_date} ({calendar.day_name[event.start_date.weekday()]}): {event.title} ({event.event_type})")
        
        # Show which days are Saturdays in August 2025
        print("\n📊 Actual Saturdays in August 2025:")
        for day in range(1, 32):
            try:
                date = datetime(2025, 8, day).date()
                if date.weekday() == 5:  # Saturday
                    print(f"  - August {day}, 2025 is a Saturday")
                    # Check if we have an event for this date
                    events_this_day = [e for e in all_events if e.start_date == date]
                    if events_this_day:
                        for e in events_this_day:
                            print(f"    ✅ Event: {e.title} ({e.event_type})")
                    else:
                        print(f"    ❌ No events found for this Saturday")
            except ValueError:
                pass  # Invalid date (like August 31)

if __name__ == "__main__":
    asyncio.run(test_saturday_events())
