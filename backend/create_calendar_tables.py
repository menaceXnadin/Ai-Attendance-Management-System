#!/usr/bin/env python3
"""
Create Calendar Tables Migration
Adds academic calendar tables to the database
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.database import Base
# Import all existing models to ensure they're registered with Base
from app.models import *  # This includes User, Student, Faculty, Subject, etc.
# Import calendar models
from app.models.calendar import *
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_calendar_tables():
    """Create all calendar tables"""
    try:
        # Use synchronous PostgreSQL driver for migration
        sync_db_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
        engine = create_engine(sync_db_url)
        
        # Create tables
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Calendar tables created successfully")
        
        # Create enum types if they don't exist
        with engine.connect() as conn:
            # Check and create event_type enum
            result = conn.execute(text("""
                SELECT 1 FROM pg_type WHERE typname = 'eventtype'
            """)).fetchone()
            
            if not result:
                conn.execute(text("""
                    CREATE TYPE eventtype AS ENUM (
                        'class', 'holiday', 'exam', 'special_event', 'cancelled_class'
                    )
                """))
                logger.info("✅ EventType enum created")
            
            # Check and create holiday_type enum
            result = conn.execute(text("""
                SELECT 1 FROM pg_type WHERE typname = 'holidaytype'
            """)).fetchone()
            
            if not result:
                conn.execute(text("""
                    CREATE TYPE holidaytype AS ENUM ('full_day', 'half_day')
                """))
                logger.info("✅ HolidayType enum created")
            
            # Check and create attendance_status_calendar enum
            result = conn.execute(text("""
                SELECT 1 FROM pg_type WHERE typname = 'attendancestatuscalendar'
            """)).fetchone()
            
            if not result:
                conn.execute(text("""
                    CREATE TYPE attendancestatuscalendar AS ENUM (
                        'present', 'absent', 'pending', 'starts_soon'
                    )
                """))
                logger.info("✅ AttendanceStatusCalendar enum created")
            
            conn.commit()
        
        logger.info("✅ All calendar database components created successfully")
        
    except Exception as e:
        logger.error(f"❌ Error creating calendar tables: {e}")
        raise

def create_sample_calendar_data():
    """Create sample calendar data for testing"""
    try:
        from sqlalchemy.orm import sessionmaker
        from app.models.calendar import AcademicEvent, EventType, CalendarSetting, AcademicYear
        from datetime import date, datetime, timedelta
        
        # Use synchronous PostgreSQL driver
        sync_db_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
        engine = create_engine(sync_db_url)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # Create academic year
            current_year = AcademicYear(
                year_name="2024-2025",
                start_date=date(2024, 8, 1),
                end_date=date(2025, 7, 31),
                total_terms=2,
                current_term=1,
                is_current=True
            )
            db.add(current_year)
            db.commit()
            
            # Get admin user for creating events
            admin_user = db.query(User).filter(User.role == UserRole.admin).first()
            if not admin_user:
                logger.warning("No admin user found, skipping sample data creation")
                return
            
            # Create sample holidays
            holidays = [
                {
                    "title": "New Year's Day",
                    "description": "Public Holiday",
                    "event_type": EventType.HOLIDAY,
                    "start_date": date(2025, 1, 1),
                    "is_all_day": True,
                    "color_code": "#EF4444",
                    "created_by": admin_user.id
                },
                {
                    "title": "Independence Day",
                    "description": "National Holiday",
                    "event_type": EventType.HOLIDAY,
                    "start_date": date(2025, 1, 26),
                    "is_all_day": True,
                    "color_code": "#EF4444",
                    "created_by": admin_user.id
                },
                {
                    "title": "Spring Break",
                    "description": "Academic Break",
                    "event_type": EventType.HOLIDAY,
                    "start_date": date(2025, 3, 15),
                    "end_date": date(2025, 3, 25),
                    "is_all_day": True,
                    "color_code": "#EF4444",
                    "created_by": admin_user.id
                }
            ]
            
            for holiday_data in holidays:
                holiday = AcademicEvent(**holiday_data)
                db.add(holiday)
            
            # Create sample exams
            exams = [
                {
                    "title": "Mid-term Examinations",
                    "description": "First semester mid-term exams",
                    "event_type": EventType.EXAM,
                    "start_date": date(2024, 10, 15),
                    "end_date": date(2024, 10, 25),
                    "is_all_day": True,
                    "color_code": "#F59E0B",
                    "created_by": admin_user.id
                },
                {
                    "title": "Final Examinations",
                    "description": "First semester final exams",
                    "event_type": EventType.EXAM,
                    "start_date": date(2024, 12, 10),
                    "end_date": date(2024, 12, 22),
                    "is_all_day": True,
                    "color_code": "#F59E0B",
                    "created_by": admin_user.id
                }
            ]
            
            for exam_data in exams:
                exam = AcademicEvent(**exam_data)
                db.add(exam)
            
            # Create sample special events
            events = [
                {
                    "title": "Freshers' Orientation",
                    "description": "Welcome program for new students",
                    "event_type": EventType.SPECIAL_EVENT,
                    "start_date": date(2024, 8, 15),
                    "is_all_day": True,
                    "color_code": "#3B82F6",
                    "created_by": admin_user.id
                },
                {
                    "title": "Annual Sports Meet",
                    "description": "Inter-faculty sports competition",
                    "event_type": EventType.SPECIAL_EVENT,
                    "start_date": date(2025, 2, 10),
                    "end_date": date(2025, 2, 12),
                    "is_all_day": True,
                    "color_code": "#3B82F6",
                    "created_by": admin_user.id
                },
                {
                    "title": "Graduation Ceremony",
                    "description": "Annual convocation",
                    "event_type": EventType.SPECIAL_EVENT,
                    "start_date": date(2025, 5, 15),
                    "is_all_day": True,
                    "color_code": "#3B82F6",
                    "created_by": admin_user.id
                }
            ]
            
            for event_data in events:
                event = AcademicEvent(**event_data)
                db.add(event)
            
            db.commit()
            logger.info("✅ Sample calendar data created successfully")
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Error creating sample calendar data: {e}")
        raise

if __name__ == "__main__":
    print("🚀 Creating calendar tables...")
    create_calendar_tables()
    
    print("📅 Creating sample calendar data...")
    create_sample_calendar_data()
    
    print("✅ Calendar system setup completed successfully!")
    print("\nNext steps:")
    print("1. Restart the backend server")
    print("2. Test calendar endpoints at: http://localhost:8000/docs")
    print("3. Implement frontend calendar components")
