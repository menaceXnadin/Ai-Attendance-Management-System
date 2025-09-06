#!/usr/bin/env python3
"""
Ensure ALL Saturdays in August 2025 are marked as holidays
"""

import asyncio
import sys
import os
from datetime import date, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models import User, UserRole
from app.models.calendar import AcademicEvent, EventType, HolidayType

async def ensure_all_saturdays_holidays():
    """Ensure ALL Saturdays in August 2025 are marked as holidays"""
    
    async with AsyncSessionLocal() as db:
        # Get admin user
        admin_result = await db.execute(select(User).where(User.role == UserRole.admin).limit(1))
        admin_user = admin_result.scalar_one_or_none()
        
        if not admin_user:
            print("❌ No admin user found.")
            return
        
        # Get all days in August 2025
        saturdays_in_august = []
        for day in range(1, 32):
            try:
                event_date = date(2025, 8, day)
                if event_date.weekday() == 5:  # Saturday = 5
                    saturdays_in_august.append(event_date)
            except ValueError:
                # Invalid date (like August 32)
                continue
        
        print(f"📅 Found {len(saturdays_in_august)} Saturdays in August 2025:")
        for saturday in saturdays_in_august:
            print(f"   - {saturday.strftime('%Y-%m-%d (%A)')}")
        
        # Check existing Saturday holidays
        existing_result = await db.execute(
            select(AcademicEvent).where(
                AcademicEvent.start_date.in_(saturdays_in_august),
                AcademicEvent.event_type == EventType.HOLIDAY,
                AcademicEvent.title.like('%Saturday%')
            )
        )
        existing_saturday_holidays = existing_result.scalars().all()
        existing_dates = {event.start_date for event in existing_saturday_holidays}
        
        print(f"🔍 Found {len(existing_saturday_holidays)} existing Saturday holiday events")
        
        # Create missing Saturday holidays
        missing_saturdays = [d for d in saturdays_in_august if d not in existing_dates]
        
        if missing_saturdays:
            print(f"➕ Creating {len(missing_saturdays)} missing Saturday holidays...")
            
            for saturday in missing_saturdays:
                holiday_event = AcademicEvent(
                    title="Saturday Holiday",
                    description="Weekly Saturday holiday",
                    event_type=EventType.HOLIDAY,
                    start_date=saturday,
                    is_all_day=True,
                    holiday_type=HolidayType.FULL_DAY,
                    color_code="#EF4444",  # Red for holidays
                    created_by=admin_user.id
                )
                db.add(holiday_event)
            
            await db.commit()
            print(f"✅ Successfully created {len(missing_saturdays)} Saturday holidays!")
        else:
            print("✅ All Saturdays already have holiday events!")
        
        # Final verification
        final_result = await db.execute(
            select(AcademicEvent).where(
                AcademicEvent.start_date.in_(saturdays_in_august),
                AcademicEvent.event_type == EventType.HOLIDAY,
                AcademicEvent.title.like('%Saturday%')
            )
        )
        final_count = len(final_result.scalars().all())
        print(f"🎯 Final count: {final_count}/{len(saturdays_in_august)} Saturdays marked as holidays")

if __name__ == "__main__":
    asyncio.run(ensure_all_saturdays_holidays())
