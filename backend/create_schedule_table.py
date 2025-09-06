"""
Create class_schedules table

This migration creates the class_schedules table for managing timetables
"""
import sys
sys.path.append('.')
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.models import Base, ClassSchedule, DayOfWeek
import os
from dotenv import load_dotenv

async def create_schedule_table():
    load_dotenv()
    DATABASE_URL = os.getenv('DATABASE_URL')
    engine = create_async_engine(DATABASE_URL)
    
    print("🔧 Creating class_schedules table...")
    
    # Create all tables (will only create missing ones)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ Class schedules table created successfully!")
    print("\n📋 Table structure:")
    print("- id: Primary key")
    print("- subject_id: Foreign key to subjects")
    print("- faculty_id: Foreign key to faculties") 
    print("- day_of_week: ENUM (sunday, monday, ..., saturday)")
    print("- start_time: TIME (e.g., 08:00:00)")
    print("- end_time: TIME (e.g., 09:30:00)")
    print("- semester: INTEGER (1-8)")
    print("- academic_year: INTEGER (e.g., 2025)")
    print("- classroom: STRING (optional)")
    print("- instructor_name: STRING (optional)")
    print("- is_active: BOOLEAN (default: true)")
    print("- notes: STRING (optional)")
    print("\n🔒 Constraints:")
    print("- Unique faculty time slots (prevents conflicts)")
    print("- Unique classroom bookings (prevents double-booking)")

if __name__ == "__main__":
    asyncio.run(create_schedule_table())