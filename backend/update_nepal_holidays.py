#!/usr/bin/env python3
"""
Update academic calendar to reflect Nepal's holiday schedule:
- Only Saturday is a holiday
- Remove any Sunday holidays
- Ensure all Saturdays are marked as holidays
"""

import asyncio
import sys
import os
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models import User, UserRole
from app.models.calendar import AcademicEvent, EventType, HolidayType

async def update_nepal_holidays():
    """Update holiday schedule to match Nepal standards"""
    
    async with AsyncSessionLocal() as db:
        # Get admin user
        admin_result = await db.execute(select(User).where(User.role == UserRole.admin).limit(1))
        admin_user = admin_result.scalar_one_or_none()
        
        if not admin_user:
            print("❌ No admin user found.")
            return
        
        print("🇳🇵 Updating academic calendar for Nepal holiday schedule...")
        print("📅 Saturday = Holiday | Sunday-Friday = Academic days")
        
        # Step 1: Remove Sunday holidays
        print("\n🧹 Step 1: Removing Sunday holidays...")
        
        # Find all Sunday events that are holidays
        sunday_holidays_query = select(AcademicEvent).where(
            and_(
                AcademicEvent.event_type == EventType.HOLIDAY,
                # Filter for Sundays (weekday 6)
            )
        )
        
        result = await db.execute(sunday_holidays_query)
        all_holidays = result.scalars().all()
        
        # Filter for Sunday holidays
        sunday_holidays = [event for event in all_holidays if event.start_date.weekday() == 6]
        
        print(f"🔍 Found {len(sunday_holidays)} Sunday holiday events to remove")
        
        for holiday in sunday_holidays:
            print(f"  ❌ Removing: {holiday.title} on {holiday.start_date} (Sunday)")
            await db.delete(holiday)
        
        # Step 2: Ensure all Saturdays are holidays
        print("\n✅ Step 2: Ensuring all Saturdays are marked as holidays...")
        
        # Get current year and next year for comprehensive coverage
        current_year = datetime.now().year
        start_date = date(current_year, 1, 1)
        end_date = date(current_year + 1, 12, 31)
        
        print(f"📅 Checking period: {start_date} to {end_date}")
        
        # Find all Saturdays in the period
        saturdays = []
        current_date = start_date
        
        while current_date <= end_date:
            if current_date.weekday() == 5:  # Saturday = 5
                saturdays.append(current_date)
            current_date += timedelta(days=1)
        
        print(f"🔍 Found {len(saturdays)} Saturdays in the period")
        
        # Check existing Saturday holidays
        existing_result = await db.execute(
            select(AcademicEvent).where(
                and_(
                    AcademicEvent.start_date.in_(saturdays),
                    AcademicEvent.event_type == EventType.HOLIDAY
                )
            )
        )
        existing_saturday_holidays = existing_result.scalars().all()
        existing_dates = {event.start_date for event in existing_saturday_holidays}
        
        print(f"✅ Found {len(existing_saturday_holidays)} existing Saturday holiday events")
        
        # Create missing Saturday holidays
        missing_saturdays = [d for d in saturdays if d not in existing_dates]
        
        if missing_saturdays:
            print(f"➕ Creating {len(missing_saturdays)} missing Saturday holidays...")
            
            for saturday in missing_saturdays:
                holiday_event = AcademicEvent(
                    title="Saturday Holiday",
                    description=f"Weekly Saturday holiday - {saturday.strftime('%B %d, %Y')} (Nepal standard)",
                    event_type=EventType.HOLIDAY,
                    start_date=saturday,
                    is_all_day=True,
                    holiday_type=HolidayType.FULL_DAY,
                    color_code="#EF4444",  # Red for holidays
                    created_by=admin_user.id
                )
                db.add(holiday_event)
                print(f"  ✅ Created Saturday holiday for {saturday}")
        else:
            print("✅ All Saturdays already have holiday events!")
        
        # Step 3: Update existing holiday titles to be consistent
        print("\n🏷️ Step 3: Updating Saturday holiday titles for consistency...")
        
        # Update any weekend/Saturday holidays with inconsistent titles
        update_result = await db.execute(
            select(AcademicEvent).where(
                and_(
                    AcademicEvent.event_type == EventType.HOLIDAY,
                    # Only get Saturday events
                )
            )
        )
        
        all_holiday_events = update_result.scalars().all()
        saturday_events = [event for event in all_holiday_events if event.start_date.weekday() == 5]
        
        updated_count = 0
        for event in saturday_events:
            # Update title if it's not already "Saturday Holiday"
            if event.title != "Saturday Holiday":
                old_title = event.title
                event.title = "Saturday Holiday"
                event.description = f"Weekly Saturday holiday - {event.start_date.strftime('%B %d, %Y')} (Nepal standard)"
                print(f"  🏷️ Updated title: '{old_title}' → 'Saturday Holiday' for {event.start_date}")
                updated_count += 1
        
        print(f"✅ Updated {updated_count} holiday titles for consistency")
        
        # Commit all changes
        await db.commit()
        
        print(f"\n🎉 Successfully updated academic calendar for Nepal!")
        print(f"📊 Summary:")
        print(f"  - Removed {len(sunday_holidays)} Sunday holidays")
        print(f"  - Created {len(missing_saturdays)} missing Saturday holidays")
        print(f"  - Updated {updated_count} holiday titles")
        print(f"  - Total Saturdays with holidays: {len(saturdays)}")
        
        # Final verification
        final_result = await db.execute(
            select(AcademicEvent).where(
                and_(
                    AcademicEvent.event_type == EventType.HOLIDAY,
                    AcademicEvent.start_date >= start_date,
                    AcademicEvent.start_date <= end_date
                )
            )
        )
        
        final_holidays = final_result.scalars().all()
        saturday_final = [e for e in final_holidays if e.start_date.weekday() == 5]
        sunday_final = [e for e in final_holidays if e.start_date.weekday() == 6]
        
        print(f"\n🔍 Final verification:")
        print(f"  - Saturday holidays: {len(saturday_final)}")
        print(f"  - Sunday holidays: {len(sunday_final)} (should be 0)")
        
        if len(sunday_final) == 0:
            print("✅ Perfect! No Sunday holidays remaining.")
        else:
            print("⚠️ Warning: Some Sunday holidays still exist.")

if __name__ == "__main__":
    asyncio.run(update_nepal_holidays())