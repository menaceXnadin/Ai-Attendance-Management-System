#!/usr/bin/env python3
"""
Verify Admin Users
"""
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models import User, Admin, UserRole

async def verify_admin_users():
    admin_emails = [
        "dny10@gmail.com",
        "drg12@gmail.com", 
        "sp14@gmail.com",
        "npoudel13@gmail.com"
    ]
    
    print("🔍 Verifying Admin Users")
    print("=" * 50)
    
    async with AsyncSessionLocal() as session:
        for email in admin_emails:
            print(f"\n📧 Checking: {email}")
            
            # Get user
            result = await session.execute(
                select(User).where(User.email == email)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                print(f"   ❌ User not found!")
                continue
                
            print(f"   👤 User: {user.full_name}")
            print(f"   🔑 Role: {user.role}")
            print(f"   ✅ Active: {user.is_active}")
            
            # Check admin profile
            result = await session.execute(
                select(Admin).where(Admin.user_id == user.id)
            )
            admin_profile = result.scalar_one_or_none()
            
            if admin_profile:
                print(f"   🏢 Admin ID: {admin_profile.admin_id}")
                print(f"   � Name (Admin): {admin_profile.name}")
                print(f"   �📝 Department: {admin_profile.department}")
                print(f"   🛡️  Permissions: {', '.join(admin_profile.permissions) if admin_profile.permissions else 'None'}")
                print(f"   ✅ Admin Profile: Created")
            else:
                print(f"   ❌ Admin Profile: Missing")
    
    print("\n" + "=" * 50)
    print("✅ Admin verification completed!")

if __name__ == "__main__":
    asyncio.run(verify_admin_users())
