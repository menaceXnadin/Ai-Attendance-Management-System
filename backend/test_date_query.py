#!/usr/bin/env python3
"""
Test the exact query that's failing
"""
import asyncio
from datetime import date
from app.core.database import get_db
from app.models.calendar import AcademicEvent
from sqlalchemy import and_, select

async def test_date_query():
    """Test the problematic date query"""
    print("🔍 Testing date query...")
    
    async for db in get_db():
        try:
            # Test with proper date objects
            start_date = date(2025, 8, 1)
            end_date = date(2025, 8, 31)
            
            print(f"Start date: {start_date} (type: {type(start_date)})")
            print(f"End date: {end_date} (type: {type(end_date)})")
            
            stmt = (
                select(AcademicEvent)
                .where(
                    and_(
                        AcademicEvent.start_date >= start_date,
                        AcademicEvent.start_date <= end_date,
                        AcademicEvent.is_active.is_(True),
                    )
                )
                .limit(5)
            )
            
            result = await db.execute(stmt)
            events = result.scalars().all()
            print(f"✅ Query successful! Found {len(events)} events")
            
            for event in events:
                print(f"  - {event.title} ({event.start_date})")
                
        except Exception as e:
            print(f"❌ Query error: {e}")
        break

if __name__ == "__main__":
    asyncio.run(test_date_query())
