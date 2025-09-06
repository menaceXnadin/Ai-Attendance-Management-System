#!/usr/bin/env python3
"""
Database Migration Script: Initialize Semester Configuration Table

This script creates the semester_configurations table and populates it
with the current semester data that was previously hardcoded.

Run this script to migrate from hardcoded semester dates to dynamic configuration.
"""

import asyncio
import sys
from datetime import date, datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_engine, SessionLocal
from app.models import SemesterConfiguration, Base


async def create_semester_config_table():
    """Create the semester_configurations table"""
    print("📋 Creating semester_configurations table...")
    
    # Create the table using SQLAlchemy
    async with async_engine.begin() as conn:
        # Create the table if it doesn't exist
        await conn.run_sync(Base.metadata.create_all, tables=[SemesterConfiguration.__table__])
    
    print("✅ semester_configurations table created successfully")


async def populate_default_semester_config():
    """Populate the table with current semester data"""
    print("📝 Populating with default semester configuration...")
    
    async with SessionLocal() as db:
        try:
            # Check if we already have semester configurations
            existing_check = await db.execute(
                text("SELECT COUNT(*) FROM semester_configurations")
            )
            count = existing_check.scalar()
            
            if count > 0:
                print(f"⚠️  Found {count} existing semester configurations. Skipping initialization.")
                return
            
            # Create the current semester configuration (Fall 2025)
            current_semester = SemesterConfiguration(
                semester_number=5,
                academic_year=2025,
                semester_name="Fall 2025",
                start_date=date(2025, 8, 1),
                end_date=date(2025, 12, 15),
                total_weeks=16,
                exam_week_start=date(2025, 12, 9),
                exam_week_end=date(2025, 12, 15),
                is_current=True,
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(current_semester)
            
            # Add future semester (Spring 2026)
            spring_semester = SemesterConfiguration(
                semester_number=6,
                academic_year=2026,
                semester_name="Spring 2026",
                start_date=date(2026, 1, 15),
                end_date=date(2026, 5, 15),
                total_weeks=16,
                exam_week_start=date(2026, 5, 9),
                exam_week_end=date(2026, 5, 15),
                is_current=False,
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(spring_semester)
            
            # Add previous semester (Spring 2025) - marked as not current
            previous_semester = SemesterConfiguration(
                semester_number=4,
                academic_year=2025,
                semester_name="Spring 2025",
                start_date=date(2025, 1, 15),
                end_date=date(2025, 5, 15),
                total_weeks=16,
                exam_week_start=date(2025, 5, 9),
                exam_week_end=date(2025, 5, 15),
                is_current=False,
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(previous_semester)
            
            await db.commit()
            
            print("✅ Default semester configurations created:")
            print("   • Spring 2025 (Previous - Semester 4)")
            print("   • Fall 2025 (Current - Semester 5)")
            print("   • Spring 2026 (Future - Semester 6)")
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Error populating semester configurations: {e}")
            raise


async def verify_migration():
    """Verify that the migration was successful"""
    print("🔍 Verifying migration...")
    
    async with SessionLocal() as db:
        try:
            # Check semester configurations
            result = await db.execute(
                text("""
                    SELECT id, semester_name, semester_number, academic_year, 
                           start_date, end_date, is_current, is_active 
                    FROM semester_configurations 
                    ORDER BY academic_year, semester_number
                """)
            )
            
            rows = result.fetchall()
            
            if not rows:
                print("❌ No semester configurations found!")
                return False
            
            print(f"✅ Found {len(rows)} semester configurations:")
            for row in rows:
                current_marker = " (CURRENT)" if row[6] else ""
                active_marker = " [ACTIVE]" if row[7] else " [INACTIVE]"
                print(f"   • {row[1]} - Semester {row[2]}/{row[3]} ({row[4]} to {row[5]}){current_marker}{active_marker}")
            
            # Check for current semester
            current_count = sum(1 for row in rows if row[6])  # is_current
            if current_count == 1:
                print("✅ Exactly one current semester found")
            else:
                print(f"⚠️  Found {current_count} current semesters (should be 1)")
            
            return True
            
        except Exception as e:
            print(f"❌ Error verifying migration: {e}")
            return False


async def main():
    """Main migration function"""
    print("🚀 Starting Semester Configuration Migration")
    print("=" * 50)
    
    try:
        # Step 1: Create table
        await create_semester_config_table()
        
        # Step 2: Populate with default data
        await populate_default_semester_config()
        
        # Step 3: Verify migration
        success = await verify_migration()
        
        if success:
            print("\n🎉 Migration completed successfully!")
            print("\nNext steps:")
            print("1. Test the student dashboard to ensure it uses dynamic semester dates")
            print("2. Use the admin API endpoints to manage semester configurations")
            print("3. Update any remaining hardcoded semester references")
        else:
            print("\n❌ Migration verification failed!")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n💥 Migration failed with error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    print("Dynamic Semester Configuration Migration")
    print("This will replace hardcoded semester dates with database configuration")
    
    # Run the migration
    asyncio.run(main())