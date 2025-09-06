#!/usr/bin/env python3
"""
Auto-generate Saturday holidays for any year/month
Future-proof system that automatically creates Saturday holidays
"""

import asyncio
import sys
import os
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models import User, UserRole
from app.models.calendar import AcademicEvent, EventType, HolidayType

async def auto_generate_saturday_holidays(year: int, month: int = None):
    """
    Auto-generate Saturday holidays for any year/month
    If month is None, generates for the entire year
    """
    
    async with AsyncSessionLocal() as db:
        # Get admin user
        admin_result = await db.execute(select(User).where(User.role == UserRole.admin).limit(1))
        admin_user = admin_result.scalar_one_or_none()
        
        if not admin_user:
            print("❌ No admin user found.")
            return
        
        # Determine date range
        if month:
            start_date = date(year, month, 1)
            if month == 12:
                end_date = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(year, month + 1, 1) - timedelta(days=1)
            period = f"{year}-{month:02d}"
        else:
            start_date = date(year, 1, 1)
            end_date = date(year, 12, 31)
            period = str(year)
        
        print(f"🗓️ Generating Saturday holidays for {period}")
        print(f"📅 Date range: {start_date} to {end_date}")
        
        # Find all Saturdays in the period
        saturdays = []
        current_date = start_date
        
        while current_date <= end_date:
            if current_date.weekday() == 5:  # Saturday = 5
                saturdays.append(current_date)
            current_date += timedelta(days=1)
        
        print(f"🔍 Found {len(saturdays)} Saturdays in {period}")
        
        # Check for existing Saturday holidays
        existing_result = await db.execute(
            select(AcademicEvent).where(
                AcademicEvent.start_date.in_(saturdays),
                AcademicEvent.event_type == EventType.HOLIDAY,
                AcademicEvent.title.like('%Saturday%')
            )
        )
        existing_saturday_holidays = existing_result.scalars().all()
        existing_dates = {event.start_date for event in existing_saturday_holidays}
        
        # Create missing Saturday holidays
        missing_saturdays = [d for d in saturdays if d not in existing_dates]
        
        if missing_saturdays:
            print(f"➕ Creating {len(missing_saturdays)} missing Saturday holidays...")
            
            for saturday in missing_saturdays:
                holiday_event = AcademicEvent(
                    title="Saturday Holiday",
                    description=f"Weekly Saturday holiday - {saturday.strftime('%B %d, %Y')}",
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
        
        return len(missing_saturdays)

async def ensure_current_and_future_saturdays():
    """Ensure current year and next year have Saturday holidays"""
    current_year = datetime.now().year
    
    print(f"🚀 Future-proofing Saturday holidays...")
    
    # Generate for current year
    await auto_generate_saturday_holidays(current_year)
    
    # Generate for next year
    await auto_generate_saturday_holidays(current_year + 1)
    
    print(f"🎯 Saturday holidays ensured for {current_year} and {current_year + 1}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate Saturday holidays")
    parser.add_argument("--year", type=int, default=None, help="Year to generate holidays for")
    parser.add_argument("--month", type=int, default=None, help="Month to generate holidays for")
    parser.add_argument("--future-proof", action="store_true", help="Generate for current and next year")
    
    args = parser.parse_args()
    
    if args.future_proof:
        asyncio.run(ensure_current_and_future_saturdays())
    elif args.year:
        asyncio.run(auto_generate_saturday_holidays(args.year, args.month))
    else:
        # Default: ensure current year
        current_year = datetime.now().year
        asyncio.run(auto_generate_saturday_holidays(current_year))
