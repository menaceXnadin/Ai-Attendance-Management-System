#!/usr/bin/env python3
"""
Fix admin password by creating a new hash with current bcrypt version
"""
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models import User
from sqlalchemy import select

async def fix_admin_password():
    """Fix the admin password hash"""
    print("🔧 Fixing Admin Password...")
    print("-" * 40)
    
    try:
        # Generate new password hash
        new_password = "admin123"
        new_hash = get_password_hash(new_password)
        print(f"✅ Generated new password hash for '{new_password}'")
        
        async with AsyncSessionLocal() as session:
            # Find admin user
            result = await session.execute(
                select(User).where(User.email == "admin@attendance.com")
            )
            user = result.scalar_one_or_none()
            
            if not user:
                print("❌ Admin user not found")
                return False
            
            # Update password hash
            user.hashed_password = new_hash
            await session.commit()
            print("✅ Admin password hash updated successfully")
            
            return True
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

async def main():
    print("🚀 Fixing Admin Password Hash")
    print("=" * 50)
    
    success = await fix_admin_password()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 Admin password fixed!")
        print("You can now login with:")
        print("   Email: admin@attendance.com")
        print("   Password: admin123")
    else:
        print("💥 Failed to fix admin password!")

if __name__ == "__main__":
    asyncio.run(main())
