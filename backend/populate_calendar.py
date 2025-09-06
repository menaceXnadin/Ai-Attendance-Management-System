import asyncio
import sys
import os

# Add the parent directory to Python path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import AsyncSessionLocal
from app.models import AcademicEvent, EventType, HolidayType, User
from sqlalchemy import select, delete, and_, func
from datetime import datetime, date, timedelta, time

async def populate_academic_calendar():
    """Populate the academic calendar with class days and Saturday holidays"""
    
    async with AsyncSessionLocal() as db:
        # Find an admin user to be the creator
        admin_query = select(User).where(User.role == 'admin').limit(1)
        admin_result = await db.execute(admin_query)
        admin_user = admin_result.scalar_one_or_none()
        
        if not admin_user:
            print("❌ No admin user found! Please create an admin user first.")
            return
        
        print(f"✅ Using admin user: {admin_user.full_name} (ID: {admin_user.id})")
        
        # Determine current semester dates
        current_year = datetime.now().year
        if datetime.now().month >= 8:  # Fall semester
            semester_start = date(current_year, 8, 1)
            semester_end = date(current_year, 12, 15)
            semester_name = f"Fall {current_year}"
        else:  # Spring semester
            semester_start = date(current_year, 1, 15)
            semester_end = date(current_year, 5, 30)
            semester_name = f"Spring {current_year}"
        
        print(f"\n📅 Populating calendar for {semester_name}")
        print(f"📅 Period: {semester_start} to {semester_end}")
        
        # Clear existing events for this semester
        delete_query = delete(AcademicEvent).where(
            and_(
                AcademicEvent.start_date >= semester_start,
                AcademicEvent.start_date <= semester_end
            )
        )
        await db.execute(delete_query)
        print("🗑️  Cleared existing calendar events for semester")
        
        # Generate calendar events
        current_date = semester_start
        class_days_created = 0
        holidays_created = 0
        
        while current_date <= semester_end:
            # Saturday (5) and Sunday (6) = Holidays, Monday-Friday = Class days
            if current_date.weekday() == 5:  # Saturday
                holiday_event = AcademicEvent(
                    title="Saturday Holiday",
                    description="Regular Saturday holiday",
                    event_type=EventType.HOLIDAY,
                    start_date=current_date,
                    end_date=current_date,
                    is_all_day=True,
                    holiday_type=HolidayType.FULL_DAY,
                    color_code="#EF4444",  # Red for holidays
                    created_by=admin_user.id,
                    attendance_required=False
                )
                db.add(holiday_event)
                holidays_created += 1
                
            elif current_date.weekday() == 6:  # Sunday
                holiday_event = AcademicEvent(
                    title="Sunday Holiday",
                    description="Regular Sunday holiday",
                    event_type=EventType.HOLIDAY,
                    start_date=current_date,
                    end_date=current_date,
                    is_all_day=True,
                    holiday_type=HolidayType.FULL_DAY,
                    color_code="#EF4444",  # Red for holidays
                    created_by=admin_user.id,
                    attendance_required=False
                )
                db.add(holiday_event)
                holidays_created += 1
                
            else:  # Monday to Friday = Class days
                class_event = AcademicEvent(
                    title=f"Academic Day - {current_date.strftime('%A')}",
                    description=f"Regular class day",
                    event_type=EventType.CLASS,
                    start_date=current_date,
                    end_date=current_date,
                    start_time=time(8, 0),  # 8:00 AM
                    end_time=time(17, 0),   # 5:00 PM
                    is_all_day=False,
                    color_code="#10B981",   # Green for class days
                    created_by=admin_user.id,
                    attendance_required=True
                )
                db.add(class_event)
                class_days_created += 1
            
            current_date += timedelta(days=1)
        
        await db.commit()
        
        print(f"\n✅ Calendar population completed!")
        print(f"📚 Class days created: {class_days_created}")
        print(f"🏖️  Holidays created: {holidays_created}")
        print(f"📊 Total events: {class_days_created + holidays_created}")
        
        # Verify the data
        print(f"\n🔍 Verifying calendar data...")
        
        # Count class days
        class_count_query = select(func.count(AcademicEvent.id)).where(
            and_(
                AcademicEvent.start_date >= semester_start,
                AcademicEvent.start_date <= semester_end,
                AcademicEvent.event_type == EventType.CLASS
            )
        )
        class_count_result = await db.execute(class_count_query)
        class_count = class_count_result.scalar()
        
        # Count holidays
        holiday_count_query = select(func.count(AcademicEvent.id)).where(
            and_(
                AcademicEvent.start_date >= semester_start,
                AcademicEvent.start_date <= semester_end,
                AcademicEvent.event_type == EventType.HOLIDAY
            )
        )
        holiday_count_result = await db.execute(holiday_count_query)
        holiday_count = holiday_count_result.scalar()
        
        print(f"✅ Verified: {class_count} class days in database")
        print(f"✅ Verified: {holiday_count} holidays in database")
        
        # Calculate attendance impact
        total_calendar_days = (semester_end - semester_start).days + 1
        print(f"\n📈 Calendar Statistics:")
        print(f"   Total calendar days: {total_calendar_days}")
        print(f"   Academic days (class days): {class_count}")
        print(f"   Holidays/weekends: {holiday_count}")
        print(f"   Academic percentage: {(class_count / total_calendar_days * 100):.1f}%")

if __name__ == "__main__":
    print("🚀 Starting Academic Calendar Population...")
    asyncio.run(populate_academic_calendar())
    print("🎉 Process completed!")