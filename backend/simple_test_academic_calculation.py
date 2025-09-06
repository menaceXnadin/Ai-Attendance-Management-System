#!/usr/bin/env python3
"""
Simple test for the new academic calculation system.
This version uses environment variables or defaults for database connection.
"""

import asyncio
import sys
import os
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy import select, func, and_

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

try:
    from app.models import AcademicEvent, EventType, ClassSchedule, DayOfWeek
    from app.services.academic_calculator import AcademicCalculatorService
    
    # Create engine directly
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+asyncpg://postgres:nadin123@localhost:5432/attendancedb')
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    print("✅ Successfully imported modules and created database engine")
    
except Exception as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)


async def simple_test():
    """Simple test of the academic calculation system."""
    
    print("🧮 Simple Academic Calculation Test")
    print("=" * 40)
    
    async with AsyncSession(engine) as db:
        
        try:
            # Test parameters
            semester_start = date(2025, 8, 1)
            semester_end = date(2025, 12, 15)
            
            print(f"📅 Testing Period: {semester_start} to {semester_end}")
            print()
            
            # 1. Count total academic events
            print("📊 Academic Events Analysis:")
            print("-" * 30)
            
            # Count all CLASS events
            all_class_query = select(func.count(AcademicEvent.id)).where(
                and_(
                    AcademicEvent.start_date >= semester_start,
                    AcademicEvent.start_date <= semester_end,
                    AcademicEvent.event_type == EventType.CLASS,
                    AcademicEvent.is_active == True
                )
            )
            
            result = await db.execute(all_class_query)
            total_class_events = result.scalar() or 0
            print(f"Total CLASS events: {total_class_events}")
            
            # Count attendance-required CLASS events
            required_class_query = select(func.count(AcademicEvent.id)).where(
                and_(
                    AcademicEvent.start_date >= semester_start,
                    AcademicEvent.start_date <= semester_end,
                    AcademicEvent.event_type == EventType.CLASS,
                    AcademicEvent.attendance_required == True,
                    AcademicEvent.is_active == True
                )
            )
            
            result = await db.execute(required_class_query)
            required_class_events = result.scalar() or 0
            print(f"Attendance-required CLASS events: {required_class_events}")
            
            # 2. Check class schedules
            print(f"\n📅 Class Schedules Analysis:")
            print("-" * 30)
            
            schedule_count_query = select(func.count(ClassSchedule.id)).where(
                ClassSchedule.is_active == True
            )
            
            result = await db.execute(schedule_count_query)
            total_schedules = result.scalar() or 0
            print(f"Total active schedules: {total_schedules}")
            
            if total_schedules > 0:
                # Show breakdown by day
                day_breakdown_query = select(
                    ClassSchedule.day_of_week,
                    func.count(ClassSchedule.id).label('count')
                ).where(
                    ClassSchedule.is_active == True
                ).group_by(ClassSchedule.day_of_week)
                
                result = await db.execute(day_breakdown_query)
                day_breakdown = result.fetchall()
                
                print("Schedule by day:")
                for row in day_breakdown:
                    day_name = row[0].value.title()
                    print(f"  {day_name}: {row[1]} subjects")
            
            # 3. Test the new calculator
            print(f"\n🧮 New Dynamic Calculator Test:")
            print("-" * 35)
            
            calculator = AcademicCalculatorService(db)
            
            # Get basic metrics
            metrics = await calculator.calculate_academic_metrics(
                start_date=semester_start,
                end_date=semester_end
            )
            
            print(f"✅ Academic Days: {metrics['total_academic_days']}")
            print(f"✅ Total Periods: {metrics['total_periods']}")
            
            if metrics['total_academic_days'] > 0:
                avg_periods = metrics['total_periods'] / metrics['total_academic_days']
                print(f"📊 Average periods per day: {avg_periods:.1f}")
            
            # 4. Show comparison
            print(f"\n📈 Comparison Summary:")
            print("-" * 25)
            print(f"Old method would count: {total_class_events} days")
            print(f"New method counts: {metrics['total_academic_days']} days")
            print(f"New method also calculates: {metrics['total_periods']} periods")
            
            if total_class_events != metrics['total_academic_days']:
                print(f"⚠️  Difference: {total_class_events - metrics['total_academic_days']} events")
                print(f"   This suggests some CLASS events don't require attendance")
            else:
                print(f"✅ Both methods agree on academic days count")
            
            # 5. Sample breakdown
            if metrics.get('class_days_breakdown'):
                print(f"\n📋 Sample Days (first 3):")
                for day in metrics['class_days_breakdown'][:3]:
                    print(f"  {day['date']} ({day['day_of_week']}): {day['periods_count']} periods")
            
            print(f"\n✅ Test completed successfully!")
            
        except Exception as e:
            print(f"❌ Test failed: {e}")
            import traceback
            traceback.print_exc()


async def main():
    """Main test function."""
    
    try:
        await simple_test()
        
        print(f"\n🎯 Key Benefits of New System:")
        print("• Dynamic calculation based on actual data")
        print("• Respects attendance_required flag")
        print("• Calculates both days AND periods")
        print("• Updates automatically with schedule changes")
        
        print(f"\n📡 API Endpoints Available:")
        print("• GET /api/academic-metrics/summary")
        print("• GET /api/academic-metrics/current-semester")
        print("• GET /api/academic-metrics/calculate")
        
    except Exception as e:
        print(f"❌ Main test failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())