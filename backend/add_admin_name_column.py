#!/usr/bin/env python3
"""
Add name column to admin table
"""
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def add_name_column_to_admin():
    async with AsyncSessionLocal() as db:
        try:
            # Check if name column already exists
            result = await db.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'admins' AND column_name = 'name'"
            ))
            existing_column = result.scalar_one_or_none()
            
            if existing_column:
                print("✅ Name column already exists in admins table")
                return
            
            print("🔧 Adding name column to admins table...")
            
            # Add name column (nullable initially)
            await db.execute(text("ALTER TABLE admins ADD COLUMN name VARCHAR"))
            
            # Update existing records by copying names from users table
            await db.execute(text("""
                UPDATE admins 
                SET name = users.full_name
                FROM users 
                WHERE admins.user_id = users.id
            """))
            
            # Make the column non-nullable after setting values
            await db.execute(text("ALTER TABLE admins ALTER COLUMN name SET NOT NULL"))
            
            await db.commit()
            print("✅ Successfully added name column to admins table")
            
            # Verify the changes
            result = await db.execute(text(
                "SELECT admin_id, name, department FROM admins LIMIT 5"
            ))
            admins = result.fetchall()
            
            print("\n📋 Sample admin data with new name column:")
            for admin in admins:
                print(f"  Admin ID: {admin[0]}, Name: {admin[1]}, Department: {admin[2]}")
                
        except Exception as e:
            await db.rollback()
            print(f"❌ Error adding name column: {str(e)}")
            raise

if __name__ == "__main__":
    asyncio.run(add_name_column_to_admin())
