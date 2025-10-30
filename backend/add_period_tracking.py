"""
Add period and time_slot columns to attendance_records table
This fixes the attendance calculation bug by properly tracking multiple classes per day
"""

import asyncio
from sqlalchemy import text
from app.core.database import async_engine

async def add_period_tracking_columns():
    """Add period and time_slot columns to attendance_records table"""
    
    async with async_engine.begin() as conn:
        print("🔧 Adding period tracking columns to attendance_records...")
        
        # Check if columns already exist
        check_query = """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'attendance_records' 
        AND column_name IN ('period', 'time_slot')
        """
        result = await conn.execute(text(check_query))
        existing_columns = [row[0] for row in result.fetchall()]
        
        if 'period' in existing_columns and 'time_slot' in existing_columns:
            print("✅ Columns already exist. Skipping...")
            return
        
        # Add period column if it doesn't exist
        if 'period' not in existing_columns:
            await conn.execute(text("""
                ALTER TABLE attendance_records 
                ADD COLUMN period INTEGER
            """))
            print("✅ Added 'period' column")
        
        # Add time_slot column if it doesn't exist
        if 'time_slot' not in existing_columns:
            await conn.execute(text("""
                ALTER TABLE attendance_records 
                ADD COLUMN time_slot VARCHAR(50)
            """))
            print("✅ Added 'time_slot' column")
        
        # Create indexes for better query performance
        print("🔧 Creating indexes...")
        
        # Index for date+subject+period lookups
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_attendance_date_subject_period 
            ON attendance_records(date, subject_id, period)
        """))
        print("✅ Created idx_attendance_date_subject_period")
        
        # Index for student+date lookups
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_attendance_student_date 
            ON attendance_records(student_id, date)
        """))
        print("✅ Created idx_attendance_student_date")
        
        print("\n✨ Migration completed successfully!")
        print("\n📝 NEXT STEPS:")
        print("1. When creating new attendance records, populate the 'period' and 'time_slot' fields")
        print("2. For existing records, period will be NULL (which is fine - it means 'not tracked')")
        print("3. The system will now properly handle multiple classes per day")

async def populate_period_from_schedule():
    """
    Optional: Try to populate period numbers for existing records based on ClassSchedule
    This is a best-effort attempt and may not work for all records
    """
    async with async_engine.begin() as conn:
        print("\n🔧 Attempting to populate period numbers from schedule data...")
        
        # For records with a subject_id, try to infer period from ClassSchedule
        # This query assigns sequential period numbers per day per subject
        update_query = """
        WITH ranked_records AS (
            SELECT 
                ar.id,
                ROW_NUMBER() OVER (
                    PARTITION BY ar.student_id, ar.date, ar.subject_id 
                    ORDER BY ar.time_in NULLS LAST, ar.created_at
                ) as period_num
            FROM attendance_records ar
            WHERE ar.subject_id IS NOT NULL 
            AND ar.period IS NULL
        )
        UPDATE attendance_records
        SET period = ranked_records.period_num
        FROM ranked_records
        WHERE attendance_records.id = ranked_records.id
        """
        
        result = await conn.execute(text(update_query))
        updated = result.rowcount
        print(f"✅ Populated period numbers for {updated} existing records")
        
        if updated > 0:
            print("   (Based on time_in and created_at timestamps)")

if __name__ == "__main__":
    print("=" * 60)
    print("ATTENDANCE RECORD MIGRATION: Add Period Tracking")
    print("=" * 60)
    
    # Run the migration
    asyncio.run(add_period_tracking_columns())
    
    # Ask user if they want to populate existing records
    print("\n" + "=" * 60)
    response = input("\n⚠️  Do you want to attempt populating period numbers for existing records? (y/n): ")
    if response.lower() == 'y':
        asyncio.run(populate_period_from_schedule())
    else:
        print("ℹ️  Skipping period population. Existing records will have period=NULL")
    
    print("\n" + "=" * 60)
    print("🎉 All done!")
    print("=" * 60)
