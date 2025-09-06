#!/usr/bin/env python3
"""
Populate academic_events table with realistic dummy class data
Run this from the backend directory: python populate_events.py
"""

import asyncio
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.database import async_engine
from app.models.calendar import AcademicEvent, EventType
from app.models import Subject, Faculty, User

async def populate_academic_events():
    """Create academic events from August 2025 to January 2026"""
    
    # Date range
    start_date = date(2025, 8, 1)
    end_date = date(2026, 1, 31)
    
    # Holidays to skip
    holidays = {
        date(2025, 8, 15),  # Independence Day
        date(2025, 10, 2),   # Gandhi Jayanti
        date(2025, 10, 24),  # Diwali
        date(2025, 11, 14),  # Children's Day
        date(2025, 12, 25),  # Christmas
        date(2026, 1, 1),    # New Year
        date(2026, 1, 26),   # Republic Day
    }
    
    # Winter break
    winter_break_start = date(2025, 12, 20)
    winter_break_end = date(2026, 1, 5)
    
    # Class titles
    class_titles = [
        "Programming Fundamentals",
        "Data Structures", 
        "Database Systems",
        "Software Engineering",
        "Computer Networks",
        "Web Development",
        "Mathematics",
        "Physics",
        "Business Management",
        "Digital Marketing"
    ]
    
    async with AsyncSession(async_engine) as db:
        print("🚀 Starting Academic Events Population...")
        
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
        
        # Get subjects and default user
        subject_query = select(Subject).limit(10)
        subject_result = await db.execute(subject_query)
        subjects = subject_result.scalars().all()
        
        user_query = select(User).limit(1)
        user_result = await db.execute(user_query)
        default_user = user_result.scalar_one_or_none()
        
        if not default_user:
            print("❌ No user found! Please create a user first.")
            return
            
        if not subjects:
            print("❌ No subjects found! Please create subjects first.")
            return
            
        print(f"📅 Date range: {start_date} to {end_date}")
        print(f"📚 Found {len(subjects)} subjects")
        print(f"⏭️  Skipping {len(existing_dates)} existing event dates")
        
        events_created = 0
        current_date = start_date
        
        while current_date <= end_date:
            # Skip Saturdays (weekday 5)
            if current_date.weekday() == 5:
                current_date += timedelta(days=1)
                continue
                
            # Skip holidays
            if current_date in holidays:
                current_date += timedelta(days=1)
                continue
                
            # Skip winter break
            if winter_break_start <= current_date <= winter_break_end:
                current_date += timedelta(days=1)
                continue
                
            # Skip existing event dates
            if current_date in existing_dates:
                print(f"⏭️  Skipping existing event on {current_date}")
                current_date += timedelta(days=1)
                continue
            
            # Create 2-3 classes per valid day
            classes_per_day = 3 if current_date.weekday() < 3 else 2
            
            for class_num in range(classes_per_day):
                # Select subject and title
                subject = subjects[events_created % len(subjects)]
                title = class_titles[events_created % len(class_titles)]
                
                # Class times
                start_times = ["09:00", "11:00", "14:00", "16:00"]
                end_times = ["10:30", "12:30", "15:30", "17:30"]
                
                start_time = datetime.strptime(start_times[class_num % len(start_times)], "%H:%M").time()
                end_time = datetime.strptime(end_times[class_num % len(end_times)], "%H:%M").time()
                
                # Create event
                event = AcademicEvent(
                    title=title,
                    description=f"{subject.name} - {subject.code}\nRegular class session",
                    event_type=EventType.CLASS,
                    start_date=current_date,
                    end_date=current_date,
                    start_time=start_time,
                    end_time=end_time,
                    is_all_day=False,
                    subject_id=subject.id,
                    class_room=f"Room {100 + class_num}",
                    color_code="#10B981",  # Green for classes
                    is_recurring=False,
                    created_by=default_user.id,
                    attendance_required=True,
                    is_active=True
                )
                
                db.add(event)
                events_created += 1
            
            # Commit every 50 events
            if events_created % 50 == 0:
                await db.commit()
                print(f"💾 Committed {events_created} events... (Date: {current_date})")
            
            current_date += timedelta(days=1)
        
        # Final commit
        await db.commit()
        print(f"✅ Successfully created {events_created} academic events!")
        print(f"📊 Coverage: {start_date} to {end_date}")
        print(f"🚫 Excluded Saturdays, holidays, and winter break")

if __name__ == "__main__":
    print("📚 Academic Events Populator")
    print("=" * 50)
    asyncio.run(populate_academic_events())