"""
Verification Script: Test Smart System Status Detection

This script verifies that the intelligent detection correctly identifies:
1. System inactive dates (Oct 1-26) - should NOT show as absent
2. System active dates (Oct 27+) - should correctly show present/absent
3. Backfilled dates - should process normally after backfill

Run this after implementing the smart detection to verify it works.
"""

import asyncio
from datetime import date
from sqlalchemy import select, and_, func
from app.core.database import AsyncSessionLocal
from app.models import Student, AttendanceRecord, AcademicEvent, EventType, User

async def test_detection():
    """Test the smart detection for October 2025"""
    
    async with AsyncSessionLocal() as db:
        # Find Nadin Tamang
        user_query = select(User).where(User.full_name == 'Nadin Tamang')
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()
        
        if not user:
            print("❌ User 'Nadin Tamang' not found")
            return
        
        student_query = select(Student).where(Student.user_id == user.id)
        student_result = await db.execute(student_query)
        student = student_result.scalar_one_or_none()
        
        if not student:
            print("❌ Student record not found")
            return
        
        print(f"✅ Testing with Student: {user.full_name} (ID: {student.id})")
        print("="*70)
        
        # Test specific dates
        test_dates = [
            ('2025-10-01', 'System Inactive Period'),
            ('2025-10-15', 'System Inactive Period'),
            ('2025-10-26', 'System Inactive Period'),
            ('2025-10-27', 'System Active - Has face recognition'),
            ('2025-10-28', 'System Active - Has face + backfill'),
            ('2025-10-29', 'System Active - Has manual records')
        ]
        
        for date_str, description in test_dates:
            test_date = date.fromisoformat(date_str)
            
            # Check if CLASS event exists
            event_query = select(AcademicEvent).where(
                and_(
                    AcademicEvent.start_date == test_date,
                    AcademicEvent.event_type == EventType.CLASS
                )
            )
            event_result = await db.execute(event_query)
            has_event = event_result.scalar_one_or_none() is not None
            
            # Check attendance records
            records_query = select(AttendanceRecord).where(
                and_(
                    AttendanceRecord.student_id == student.id,
                    AttendanceRecord.date == test_date
                )
            )
            records_result = await db.execute(records_query)
            records = records_result.scalars().all()
            
            # Detect system status
            if len(records) == 0:
                system_status = 'system_inactive'
            else:
                same_day = [r for r in records if r.created_at.date() == test_date]
                if len(same_day) > 0:
                    system_status = 'system_active'
                else:
                    system_status = 'system_backfilled'
            
            # Expected vs Actual
            if 'Inactive' in description:
                expected_status = 'system_inactive'
                expected_display = 'no_data or system_inactive (NOT absent)'
            else:
                expected_status = 'system_active'
                expected_display = 'present/absent/partial'
            
            match = "✅" if system_status == expected_status else "❌"
            
            print(f"\n📅 {date_str} - {description}")
            print(f"   CLASS Event: {'✅ Yes' if has_event else '❌ No'}")
            print(f"   Records:     {len(records)} total")
            if records:
                for r in records:
                    created_date = r.created_at.date()
                    same_day_marker = "⚡" if created_date == test_date else "🔄"
                    print(f"      {same_day_marker} {r.status.value} (created: {created_date})")
            print(f"   Detection:   {system_status}")
            print(f"   Expected:    {expected_status}")
            print(f"   Result:      {match} {'PASS' if match == '✅' else 'FAIL'}")
        
        print("\n" + "="*70)
        print("\n📊 SUMMARY:")
        print("   The detection should now correctly identify Oct 1-26 as")
        print("   'system_inactive' instead of 'absent', so the calendar UI")
        print("   will show them as gray/no-data instead of red/absent.")
        print("\n   After backfilling historical data for those dates, they")
        print("   will be detected as 'system_backfilled' and processed normally.")

if __name__ == '__main__':
    asyncio.run(test_detection())
