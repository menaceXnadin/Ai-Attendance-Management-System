#!/usr/bin/env python3
"""
Migration script to update existing academic_events with attendance_required flag.

This script sets attendance_required=TRUE for all CLASS events to ensure
the new dynamic calculation works with existing data.
"""

import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__)))

# Set default environment variables if not present
if not os.getenv('DATABASE_URL'):
    os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres:nadin123@localhost:5432/attendancedb'
if not os.getenv('DATABASE_URL_SYNC'):
    os.environ['DATABASE_URL_SYNC'] = 'postgresql://postgres:nadin123@localhost:5432/attendancedb'
if not os.getenv('SECRET_KEY'):
    os.environ['SECRET_KEY'] = 'test-secret-key-for-development'
if not os.getenv('ALLOWED_ORIGINS'):
    os.environ['ALLOWED_ORIGINS'] = '["http://localhost:8080","http://localhost:3000"]'

from app.core.database import get_db, async_engine
from app.models.calendar import AcademicEvent, EventType


async def update_attendance_required_flags():
    """Update existing academic events to set attendance_required appropriately."""
    
    print("🔄 Updating attendance_required flags for existing academic events")
    print("=" * 65)
    
    async with AsyncSession(async_engine) as db:
        
        try:
            # 1. Check current state
            print("📊 Current State Analysis:")
            print("-" * 25)
            
            # Count total events by type
            total_query = select(
                AcademicEvent.event_type,
                AcademicEvent.attendance_required,
                func.count(AcademicEvent.id).label('count')
            ).group_by(AcademicEvent.event_type, AcademicEvent.attendance_required)
            
            result = await db.execute(total_query)
            current_state = result.fetchall()
            
            print("Current distribution:")
            for row in current_state:
                event_type = row[0].value if row[0] else "Unknown"
                required = "Required" if row[1] else "Optional"
                print(f"  {event_type} - Attendance {required}: {row[2]} events")
            
            print()
            
            # 2. Update CLASS events to require attendance
            print("🎯 Setting attendance_required=TRUE for all CLASS events...")
            
            update_query = update(AcademicEvent).where(
                and_(
                    AcademicEvent.event_type == EventType.CLASS,
                    AcademicEvent.is_active == True
                )
            ).values(attendance_required=True)
            
            result = await db.execute(update_query)
            updated_count = result.rowcount
            
            print(f"✅ Updated {updated_count} CLASS events")
            
            # 3. Set other event types appropriately
            print("\n🎯 Setting attendance flags for other event types...")
            
            # Exams should require attendance
            exam_update = update(AcademicEvent).where(
                and_(
                    AcademicEvent.event_type == EventType.EXAM,
                    AcademicEvent.is_active == True
                )
            ).values(attendance_required=True)
            
            result = await db.execute(exam_update)
            exam_updated = result.rowcount
            print(f"✅ Updated {exam_updated} EXAM events (attendance required)")
            
            # Holidays should NOT require attendance
            holiday_update = update(AcademicEvent).where(
                and_(
                    AcademicEvent.event_type == EventType.HOLIDAY,
                    AcademicEvent.is_active == True
                )
            ).values(attendance_required=False)
            
            result = await db.execute(holiday_update)
            holiday_updated = result.rowcount
            print(f"✅ Updated {holiday_updated} HOLIDAY events (attendance not required)")
            
            # Cancelled classes should NOT require attendance
            cancelled_update = update(AcademicEvent).where(
                and_(
                    AcademicEvent.event_type == EventType.CANCELLED_CLASS,
                    AcademicEvent.is_active == True
                )
            ).values(attendance_required=False)
            
            result = await db.execute(cancelled_update)
            cancelled_updated = result.rowcount
            print(f"✅ Updated {cancelled_updated} CANCELLED_CLASS events (attendance not required)")
            
            # Special events - make configurable (default to not required)
            special_update = update(AcademicEvent).where(
                and_(
                    AcademicEvent.event_type == EventType.SPECIAL_EVENT,
                    AcademicEvent.is_active == True,
                    AcademicEvent.attendance_required.is_(None)  # Only update if not already set
                )
            ).values(attendance_required=False)
            
            result = await db.execute(special_update)
            special_updated = result.rowcount
            print(f"✅ Updated {special_updated} SPECIAL_EVENT events (attendance not required by default)")
            
            # 4. Commit all changes
            await db.commit()
            print(f"\n💾 All changes committed successfully!")
            
            # 5. Verify final state
            print("\n📊 Final State Verification:")
            print("-" * 28)
            
            final_query = select(
                AcademicEvent.event_type,
                AcademicEvent.attendance_required,
                func.count(AcademicEvent.id).label('count')
            ).where(AcademicEvent.is_active == True).group_by(
                AcademicEvent.event_type, AcademicEvent.attendance_required
            )
            
            result = await db.execute(final_query)
            final_state = result.fetchall()
            
            print("Final distribution:")
            for row in final_state:
                event_type = row[0].value if row[0] else "Unknown"
                required = "Required" if row[1] else "Optional"
                print(f"  {event_type} - Attendance {required}: {row[2]} events")
            
            # 6. Calculate impact on academic days calculation
            print("\n🧮 Impact on Academic Days Calculation:")
            print("-" * 40)
            
            # Count events that will be included in new calculation
            academic_days_query = select(func.count(AcademicEvent.id)).where(
                and_(
                    AcademicEvent.event_type == EventType.CLASS,
                    AcademicEvent.attendance_required == True,
                    AcademicEvent.is_active == True
                )
            )
            
            result = await db.execute(academic_days_query)
            new_academic_days = result.scalar() or 0
            
            print(f"📈 Academic days that will be counted: {new_academic_days}")
            print(f"📊 These are CLASS events with attendance_required=TRUE")
            
            print(f"\n✅ Migration completed successfully!")
            print(f"📋 Summary:")
            print(f"  • CLASS events updated: {updated_count}")
            print(f"  • EXAM events updated: {exam_updated}")
            print(f"  • HOLIDAY events updated: {holiday_updated}")
            print(f"  • CANCELLED_CLASS events updated: {cancelled_updated}")
            print(f"  • SPECIAL_EVENT events updated: {special_updated}")
            print(f"  • Total academic days for calculation: {new_academic_days}")
            
        except Exception as e:
            print(f"❌ Error during migration: {e}")
            await db.rollback()
            raise


async def verify_class_schedules():
    """Verify that class_schedules table has data for period calculation."""
    
    print("\n" + "=" * 65)
    print("📅 Verifying Class Schedules Data")
    print("=" * 65)
    
    async with AsyncSession(async_engine) as db:
        
        try:
            from app.models.schedule import ClassSchedule, DayOfWeek
            
            # Check if we have class schedules
            schedule_count_query = select(func.count(ClassSchedule.id)).where(
                ClassSchedule.is_active == True
            )
            
            result = await db.execute(schedule_count_query)
            total_schedules = result.scalar() or 0
            
            print(f"📊 Total active class schedules: {total_schedules}")
            
            if total_schedules == 0:
                print("⚠️  WARNING: No class schedules found!")
                print("   The new period calculation will return 0 periods.")
                print("   You need to populate the class_schedules table.")
                print("\n💡 Suggested actions:")
                print("   1. Run a schedule population script")
                print("   2. Import schedule data from existing system")
                print("   3. Manually create schedules via admin interface")
                return
            
            # Show breakdown by day of week
            day_breakdown_query = select(
                ClassSchedule.day_of_week,
                func.count(ClassSchedule.id).label('count')
            ).where(
                ClassSchedule.is_active == True
            ).group_by(ClassSchedule.day_of_week)
            
            result = await db.execute(day_breakdown_query)
            day_breakdown = result.fetchall()
            
            print(f"\n📅 Schedule breakdown by day:")
            for row in day_breakdown:
                day_name = row[0].value.title()
                print(f"  {day_name}: {row[1]} scheduled subjects")
            
            # Show breakdown by semester
            semester_breakdown_query = select(
                ClassSchedule.semester,
                ClassSchedule.academic_year,
                func.count(ClassSchedule.id).label('count')
            ).where(
                ClassSchedule.is_active == True
            ).group_by(ClassSchedule.semester, ClassSchedule.academic_year)
            
            result = await db.execute(semester_breakdown_query)
            semester_breakdown = result.fetchall()
            
            print(f"\n📚 Schedule breakdown by semester:")
            for row in semester_breakdown:
                print(f"  Semester {row[0]}, Year {row[1]}: {row[2]} scheduled subjects")
            
            print(f"\n✅ Class schedules verification completed!")
            
        except Exception as e:
            print(f"❌ Error verifying schedules: {e}")


async def main():
    """Main migration function."""
    
    print("🚀 Academic Events Migration Script")
    print("=" * 65)
    print("This script updates existing academic events to work with")
    print("the new dynamic academic days calculation system.")
    print()
    
    try:
        # Import func here to avoid issues
        from sqlalchemy import func
        globals()['func'] = func
        
        await update_attendance_required_flags()
        await verify_class_schedules()
        
        print("\n" + "=" * 65)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        print("=" * 65)
        
        print("\n🎯 Next Steps:")
        print("1. Test the new academic calculation:")
        print("   python test_dynamic_academic_calculation.py")
        print("2. Update frontend to use new API endpoints")
        print("3. Verify attendance calculations are working correctly")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())