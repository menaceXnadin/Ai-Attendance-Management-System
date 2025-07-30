#!/usr/bin/env python3
"""
Check and Fix Admin Profiles
"""
import asyncio
import sys
import os
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models import User, Admin, UserRole

async def check_and_fix_admin_profiles():
    admin_emails = [
        "dny10@gmail.com",
        "drg12@gmail.com", 
        "sp14@gmail.com",
        "npoudel13@gmail.com"
    ]
    
    admin_data = {
        "dny10@gmail.com": {"admin_id": "ADM002", "department": "Academic Administration"},
        "drg12@gmail.com": {"admin_id": "ADM003", "department": "Student Affairs"},
        "sp14@gmail.com": {"admin_id": "ADM004", "department": "Faculty Management"},
        "npoudel13@gmail.com": {"admin_id": "ADM005", "department": "System Administration"}
    }
    
    async with AsyncSessionLocal() as session:
        for email in admin_emails:
            print(f"\n🔍 Checking admin profile for {email}...")
            
            # Get user
            result = await session.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            
            if not user:
                print(f"   ❌ User not found: {email}")
                continue
                
            # Check if admin profile exists
            result = await session.execute(select(Admin).where(Admin.user_id == user.id))
            admin_profile = result.scalar_one_or_none()
            
            if admin_profile:
                print(f"   ✅ Admin profile exists: {admin_profile.admin_id}")
            else:
                print(f"   🔧 Creating missing admin profile...")
                
                # Create admin profile
                admin_profile = Admin(
                    user_id=user.id,
                    admin_id=admin_data[email]["admin_id"],
                    name=user.full_name,  # Add name directly to admin table
                    department=admin_data[email]["department"],
                    permissions=[
                        "manage_students",
                        "manage_faculty", 
                        "manage_subjects",
                        "view_reports",
                        "manage_attendance",
                        "manage_users",
                        "system_settings"
                    ],
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                
                session.add(admin_profile)
                await session.commit()
                await session.refresh(admin_profile)
                
                print(f"   ✅ Created admin profile: {admin_profile.admin_id}")

if __name__ == "__main__":
    asyncio.run(check_and_fix_admin_profiles())
