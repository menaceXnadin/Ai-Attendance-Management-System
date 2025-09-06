#!/usr/bin/env python3
"""
Simple academic events populator script
"""

import asyncio
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.database import async_engine
from app.models.calendar import AcademicEvent, EventType
from app.models import Subject, User

async def populate_simple_events():
    """Create academic events with simple data to avoid lazy loading issues"""
    
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
    
    # Simple class titles
    class_titles = [
        "Programming Class", "Database Class", "Mathematics Class", 
        "Physics Class", "Engineering Class", "Business Class",
        "Computer Science", "Data Structures", "Algorithms Class",
        "Software Engineering"
    ]
    
    async with AsyncSession(async_engine) as db:
        print("🚀 Starting Simple Academic Events Population...")
        
        # Get existing event dates
        existing_query = select(AcademicEvent.start_date).where(
            and_(
                AcademicEvent.start_date >= start_date,
                AcademicEvent.start_date <= end_date,
                AcademicEvent.is_active == True
            )
        )
        result = await db.execute(existing_query)
        existing_dates = set(row[0] for row in result.fetchall())
        
        # Get subject IDs only (avoid lazy loading)
        subject_query = select(Subject.id).limit(10)
        subject_result = await db.execute(subject_query)
        subject_ids = [row[0] for row in subject_result.fetchall()]
        
        # Get default user ID
        user_query = select(User.id).limit(1)
        user_result = await db.execute(user_query)
        user_id = user_result.scalar_one_or_none()
        
        if not user_id:
            print("❌ No user found!")
            return
            
        if not subject_ids:
            print("❌ No subjects found!")
            return
            
        print(f"📅 Date range: {start_date} to {end_date}")
        print(f"📚 Found {len(subject_ids)} subject IDs")
        print(f"⏭️  Skipping {len(existing_dates)} existing event dates")
        
        events_created = 0
        current_date = start_date
        
        while current_date <= end_date:
            # Skip invalid dates
            if (current_date.weekday() == 5 or  # Saturday
                current_date in holidays or
                winter_break_start <= current_date <= winter_break_end or
                current_date in existing_dates):
                current_date += timedelta(days=1)
                continue
            
            # Create 2-3 classes per valid day
            classes_per_day = 3 if current_date.weekday() < 3 else 2
            
            for class_num in range(classes_per_day):
                # Use simple data to avoid relationships
                subject_id = subject_ids[events_created % len(subject_ids)]
                title = class_titles[events_created % len(class_titles)]
                
                start_times = ["09:00", "11:00", "14:00", "16:00"]
                end_times = ["10:30", "12:30", "15:30", "17:30"]
                
                start_time = datetime.strptime(start_times[class_num % len(start_times)], "%H:%M").time()
                end_time = datetime.strptime(end_times[class_num % len(end_times)], "%H:%M").time()
                
                # Create event with minimal data
                event = AcademicEvent(
                    title=title,
                    description=f"Regular {title} session on {current_date.strftime('%A')}",
                    event_type=EventType.CLASS,
                    start_date=current_date,
                    end_date=current_date,
                    start_time=start_time,
                    end_time=end_time,
                    is_all_day=False,
                    subject_id=subject_id,
                    class_room=f"Room {100 + class_num}",
                    color_code="#10B981",  # Green
                    is_recurring=False,
                    created_by=user_id,
                    attendance_required=True,
                    is_active=True
                )
                
                db.add(event)
                events_created += 1
            
            # Commit frequently to avoid large transactions
            if events_created % 30 == 0:
                await db.commit()
                print(f"💾 Committed {events_created} events... (Date: {current_date})")
            
            current_date += timedelta(days=1)
        
        # Final commit
        await db.commit()
        print(f"✅ Successfully created {events_created} academic events!")
        print(f"📊 Total events from {start_date} to {end_date}")

if __name__ == "__main__":
    print("📚 Simple Academic Events Populator")
    print("=" * 50)
    asyncio.run(populate_simple_events())