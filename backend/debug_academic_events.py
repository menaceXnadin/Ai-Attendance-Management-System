#!/usr/bin/env python3
"""
Debug the AcademicEvent model and database table
"""
import asyncio
from app.core.database import get_db
from app.models.calendar import AcademicEvent
from sqlalchemy import select, text

async def debug_academic_events():
    """Debug the academic events table"""
    print("🔍 Debugging AcademicEvent table...")
    
    async for db in get_db():
        try:
            # Check if table exists (PostgreSQL)
            result = await db.execute(text("SELECT tablename FROM pg_tables WHERE tablename='academic_events'"))
            table_exists = result.fetchone()
            print(f"Table exists: {table_exists is not None}")
            
            if table_exists:
                # Check table schema (PostgreSQL)
                result = await db.execute(text("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'academic_events'
                    ORDER BY ordinal_position
                """))
                columns = result.fetchall()
                print(f"Table columns: {[f'{col[0]}({col[1]})' for col in columns]}")
                
                # Try a simple count
                result = await db.execute(select(AcademicEvent))
                events = result.scalars().all()
                print(f"Total events in table: {len(events)}")
                
                # Test the problematic query
                try:
                    result = await db.execute(
                        select(AcademicEvent).where(
                            AcademicEvent.start_date >= '2025-08-01'
                        ).limit(1)
                    )
                    event = result.scalar_one_or_none()
                    if event:
                        print(f"Sample event: {event.title}")
                        # Avoid printing __dict__ as it might contain problematic relationships
                        print(f"Event ID: {event.id}, Type: {event.event_type}")
                except Exception as e:
                    print(f"❌ Query error: {e}")
            
        except Exception as e:
            print(f"❌ Database error: {e}")
        break

if __name__ == "__main__":
    asyncio.run(debug_academic_events())
