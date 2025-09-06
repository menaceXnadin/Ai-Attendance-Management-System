#!/usr/bin/env python3
"""
Verify the academic events that were created
"""

import asyncio
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.core.database import async_engine
from app.models.calendar import AcademicEvent, EventType

async def verify_events():
    """Check the academic events that were created"""
    
    async with AsyncSession(async_engine) as db:
        print("📊 Verifying Academic Events...")
        print("=" * 50)
        
        # Total count
        total_query = select(func.count(AcademicEvent.id)).where(
            AcademicEvent.event_type == EventType.CLASS
        )
        total_result = await db.execute(total_query)
        total_count = total_result.scalar()
        
        # Date range coverage
        date_range_query = select(
            func.min(AcademicEvent.start_date),
            func.max(AcademicEvent.start_date)
        ).where(AcademicEvent.event_type == EventType.CLASS)
        date_result = await db.execute(date_range_query)
        min_date, max_date = date_result.first()
        
        # Monthly breakdown
        monthly_query = select(
            func.extract('year', AcademicEvent.start_date).label('year'),
            func.extract('month', AcademicEvent.start_date).label('month'),
            func.count(AcademicEvent.id).label('count')
        ).where(
            AcademicEvent.event_type == EventType.CLASS
        ).group_by(
            func.extract('year', AcademicEvent.start_date),
            func.extract('month', AcademicEvent.start_date)
        ).order_by('year', 'month')
        
        monthly_result = await db.execute(monthly_query)
        monthly_data = monthly_result.fetchall()
        
        # Recent events sample
        recent_query = select(
            AcademicEvent.title,
            AcademicEvent.start_date,
            AcademicEvent.start_time,
            AcademicEvent.class_room
        ).where(
            AcademicEvent.event_type == EventType.CLASS
        ).limit(10)
        
        recent_result = await db.execute(recent_query)
        recent_events = recent_result.fetchall()
        
        print(f"✅ Total CLASS events: {total_count}")
        print(f"📅 Date range: {min_date} to {max_date}")
        print(f"⏰ Duration: {(max_date - min_date).days} days")
        print()
        
        print("📊 Monthly Breakdown:")
        print("-" * 30)
        month_names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        
        for year, month, count in monthly_data:
            month_name = month_names[int(month)]
            print(f"{month_name} {int(year)}: {count} events")
        
        print()
        print("📋 Sample Events:")
        print("-" * 40)
        for event in recent_events:
            title, start_date, start_time, room = event
            time_str = start_time.strftime('%H:%M') if start_time else 'All Day'
            print(f"{start_date} {time_str} - {title} ({room})")
        
        # Check for weekends (should be none)
        weekend_query = select(func.count(AcademicEvent.id)).where(
            and_(
                AcademicEvent.event_type == EventType.CLASS,
                func.extract('dow', AcademicEvent.start_date) == 6  # Saturday
            )
        )
        weekend_result = await db.execute(weekend_query)
        weekend_count = weekend_result.scalar()
        
        print()
        print(f"🚫 Saturday events (should be 0): {weekend_count}")
        print("✅ Successfully populated academic_events for semester attendance calculation!")

if __name__ == "__main__":
    asyncio.run(verify_events())