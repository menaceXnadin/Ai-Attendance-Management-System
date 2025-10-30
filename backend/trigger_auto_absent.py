"""
Manual trigger for auto-absent processing
Run this script anytime during development to mark students absent for missed classes
"""

import asyncio
from app.core.database import AsyncSessionLocal
from app.services.auto_absent_service import auto_absent_service

async def run_auto_absent():
    """Manually trigger auto-absent processing"""
    print("🔄 Starting auto-absent processing...")
    
    async with AsyncSessionLocal() as db:
        try:
            result = await auto_absent_service.process_auto_absent_for_today(db)
            
            if result["success"]:
                print(f"\n✅ Auto-absent processing completed!")
                print(f"   📅 Date: {result['processed_date']}")
                print(f"   🏫 Expired classes: {result['expired_classes']}")
                print(f"   👥 Students marked absent: {result['students_marked_absent']}")
                print(f"   📝 New records created: {result['new_records_created']}")
                
                if result.get('class_details'):
                    print(f"\n📋 Class-by-class breakdown:")
                    for detail in result['class_details']:
                        print(f"   • {detail['subject_name']} ({detail['time_slot']}): {detail['students_affected']} students")
            else:
                print(f"⚠️ Processing completed with warnings: {result.get('message', 'Unknown')}")
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            raise

if __name__ == "__main__":
    print("=" * 60)
    print("Manual Auto-Absent Trigger")
    print("=" * 60)
    asyncio.run(run_auto_absent())
    print("\n" + "=" * 60)
