#!/usr/bin/env python3
"""
Clear all events from the academic_events table
"""
import asyncio
import sys
import os

# Add the current directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import select, delete, func
    from app.models.calendar import AcademicEvent, EventAttendance
    from app.core.config import settings
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

async def clear_events_database():
    try:
        engine = create_async_engine(settings.database_url)
        AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with AsyncSessionLocal() as session:
            # First, count how many events we have
            count_result = await session.execute(select(func.count(AcademicEvent.id)))
            total_events = count_result.scalar()
            print(f"📊 Found {total_events} events in the database")
            
            if total_events == 0:
                print("✅ Database is already empty")
                return
            
            # Show some examples of what will be deleted
            print("\n📋 Sample events to be deleted:")
            sample_result = await session.execute(
                select(AcademicEvent.id, AcademicEvent.title, AcademicEvent.event_type, AcademicEvent.start_date)
                .limit(10)
            )
            sample_events = sample_result.all()
            
            for event in sample_events:
                print(f"  ID: {event.id}, Title: '{event.title}', Type: {event.event_type}, Date: {event.start_date}")
            
            if total_events > 10:
                print(f"  ... and {total_events - 10} more events")
            
            # Delete related attendance records first (foreign key constraint)
            attendance_count_result = await session.execute(select(func.count(EventAttendance.id)))
            total_attendance = attendance_count_result.scalar()
            
            if total_attendance > 0:
                print(f"\n🗑️  Deleting {total_attendance} attendance records first...")
                await session.execute(delete(EventAttendance))
                print("✅ Attendance records deleted")
            
            # Delete all events
            print(f"\n🗑️  Deleting all {total_events} events...")
            await session.execute(delete(AcademicEvent))
            
            # Commit the changes
            await session.commit()
            print("✅ All events deleted successfully!")
            
            # Verify the database is empty
            verify_result = await session.execute(select(func.count(AcademicEvent.id)))
            remaining_events = verify_result.scalar()
            
            if remaining_events == 0:
                print("✅ Database cleanup verified - 0 events remaining")
            else:
                print(f"⚠️  Warning: {remaining_events} events still remain")
        
        await engine.dispose()
        print("\n🎉 Database cleanup complete! Ready for fresh events.")
        
    except Exception as e:
        print(f"❌ Error clearing database: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🚨 WARNING: This will delete ALL events from the database!")
    print("📅 This includes holidays, exams, and any manually created events.")
    print("🔄 Are you sure you want to continue? (yes/no)")
    
    # In script mode, we'll proceed (since user requested it)
    print("🔄 Proceeding with cleanup as requested...")
    asyncio.run(clear_events_database())
