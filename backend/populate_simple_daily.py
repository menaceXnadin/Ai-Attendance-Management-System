#!/usr/bin/env python3
"""
Simple academic events populator - ONE general class per day
"""

import asyncio
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.database import async_engine
from app.models.calendar import AcademicEvent, EventType
from app.models import User

async def populate_simple_daily_classes():
    """Create ONE general class event per valid day"""
    
    start_date = date(2025, 8, 1)
    end_date = date(2026, 1, 31)
    
    # Holidays to skip
    holidays = {
        date(2025, 8, 15), date(2025, 10, 2), date(2025, 10, 24),
        date(2025, 11, 14), date(2025, 12, 25), date(2026, 1, 1), date(2026, 1, 26)
    }
    
    # Winter break
    winter_break_start = date(2025, 12, 20)
    winter_break_end = date(2026, 1, 5)
    
    async with AsyncSession(async_engine) as db:
        print("🚀 Creating ONE Class Event Per Valid Day...")
        
        # First, clear existing events to avoid confusion
        print("🧹 Clearing existing events...")
        existing_events_query = select(AcademicEvent).where(
            and_(
                AcademicEvent.start_date >= start_date,
                AcademicEvent.start_date <= end_date,
                AcademicEvent.event_type == EventType.CLASS
            )
        )
        existing_result = await db.execute(existing_events_query)
        existing_events = existing_result.scalars().all()
        
        for event in existing_events:
            await db.delete(event)
        
        await db.commit()
        print(f"🗑️ Deleted {len(existing_events)} existing events")
        
        # Get default user ID
        user_query = select(User.id).limit(1)
        user_result = await db.execute(user_query)
        user_id = user_result.scalar_one_or_none()
        
        if not user_id:
            print("❌ No user found!")
            return
            
        print(f"📅 Creating classes from {start_date} to {end_date}")
        
        events_created = 0
        current_date = start_date
        
        while current_date <= end_date:
            # Skip invalid dates
            if (current_date.weekday() == 5 or  # Saturday
                current_date in holidays or
                winter_break_start <= current_date <= winter_break_end):
                current_date += timedelta(days=1)
                continue
            
            # Create ONE simple class event per day
            event = AcademicEvent(
                title="Class",
                description=f"Regular class session - {current_date.strftime('%A, %B %d, %Y')}",
                event_type=EventType.CLASS,
                start_date=current_date,
                end_date=current_date,
                start_time=datetime.strptime("09:00", "%H:%M").time(),
                end_time=datetime.strptime("17:00", "%H:%M").time(),
                is_all_day=False,
                subject_id=None,  # No specific subject
                faculty_id=None,  # No specific faculty
                class_room="Various Rooms",
                color_code="#10B981",  # Green
                is_recurring=False,
                created_by=user_id,
                attendance_required=True,
                is_active=True
            )
            
            db.add(event)
            events_created += 1
            
            # Commit every 50 days
            if events_created % 50 == 0:
                await db.commit()
                print(f"💾 Committed {events_created} class days... (Date: {current_date})")
            
            current_date += timedelta(days=1)
        
        # Final commit
        await db.commit()
        print(f"✅ Successfully created {events_created} class days!")
        print(f"📊 ONE class event per valid day from {start_date} to {end_date}")
        print(f"🚫 Excluded Saturdays, holidays, and winter break")

if __name__ == "__main__":
    print("📚 Simple Daily Class Events Populator")
    print("=" * 50)
    asyncio.run(populate_simple_daily_classes())