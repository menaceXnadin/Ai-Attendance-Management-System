#!/usr/bin/env python3
"""
Create Multiple Admin Users for Attendance Management System
Adds the requested admin users to the database
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
from app.core.security import get_password_hash

class MultipleAdminCreator:
    def __init__(self):
        self.admin_users_data = [
            {
                "full_name": "Deo Narayan Yadav",
                "email": "dny10@gmail.com",
                "password": "admin@deo",
                "admin_id": "ADM002",
                "department": "Academic Administration"
            },
            {
                "full_name": "Dadhi Ram Ghimire",
                "email": "drg12@gmail.com",
                "password": "admin@dadhi",
                "admin_id": "ADM003",
                "department": "Student Affairs"
            },
            {
                "full_name": "Subash Pariyar",
                "email": "sp14@gmail.com",
                "password": "admin@subash",
                "admin_id": "ADM004",
                "department": "Faculty Management"
            },
            {
                "full_name": "Nawaraj Poudel",
                "email": "npoudel13@gmail.com",
                "password": "admin@nawaraj",
                "admin_id": "ADM005",
                "department": "System Administration"
            }
        ]

    async def create_admin_user(self, session: AsyncSession, admin_data: dict):
        """Create an admin user with the given data"""
        print(f"\n👨‍💼 Creating admin user: {admin_data['full_name']}...")
        
        # Check if admin already exists by email
        result = await session.execute(
            select(User).where(User.email == admin_data['email'])
        )
        existing_admin = result.scalar_one_or_none()
        
        if existing_admin:
            print(f"   ⚠️  Admin user already exists: {admin_data['email']}")
            return existing_admin
        
        # Check if admin_id already exists
        result = await session.execute(
            select(Admin).where(Admin.admin_id == admin_data['admin_id'])
        )
        existing_admin_id = result.scalar_one_or_none()
        
        if existing_admin_id:
            print(f"   ⚠️  Admin ID already exists: {admin_data['admin_id']}")
            # Generate a new admin_id
            admin_data['admin_id'] = admin_data['admin_id'] + "_NEW"
        
        try:
            # Create admin user
            admin_user = User(
                email=admin_data['email'],
                full_name=admin_data['full_name'],
                hashed_password=get_password_hash(admin_data['password']),
                role=UserRole.admin,
                is_active=True,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            session.add(admin_user)
            await session.commit()
            await session.refresh(admin_user)
            
            # Create admin profile
            admin_profile = Admin(
                user_id=admin_user.id,
                admin_id=admin_data['admin_id'],
                name=admin_data['full_name'],  # Add name directly to admin table
                department=admin_data['department'],
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
            
            print(f"   ✅ Created admin: {admin_user.full_name} ({admin_user.email})")
            print(f"      Admin ID: {admin_profile.admin_id}")
            print(f"      Department: {admin_profile.department}")
            return admin_user
            
        except Exception as e:
            print(f"   ❌ Error creating admin {admin_data['full_name']}: {str(e)}")
            await session.rollback()
            raise

    async def create_all_admins(self, session: AsyncSession):
        """Create all admin users"""
        print("🚀 Creating Multiple Admin Users")
        print("=" * 60)
        
        created_admins = []
        
        for admin_data in self.admin_users_data:
            try:
                admin_user = await self.create_admin_user(session, admin_data)
                if admin_user:
                    created_admins.append(admin_user)
            except Exception as e:
                print(f"Failed to create admin {admin_data['full_name']}: {str(e)}")
                continue
        
        return created_admins

    async def run(self):
        """Run the admin creation process"""
        async with AsyncSessionLocal() as session:
            try:
                created_admins = await self.create_all_admins(session)
                
                print("\n" + "=" * 60)
                print("🎉 ADMIN CREATION COMPLETED!")
                print("=" * 60)
                print(f"📊 Summary:")
                print(f"   👨‍💼 New Admin Users Created: {len(created_admins)}")
                
                print("\n🔑 New Admin Login Credentials:")
                for admin_data in self.admin_users_data:
                    print(f"   📧 {admin_data['email']} / {admin_data['password']}")
                    print(f"      👤 {admin_data['full_name']} - {admin_data['department']}")
                    print()
                
                print("✅ All admin users are now ready to access the system!")
                
            except Exception as e:
                print(f"\n❌ Error creating admin users: {str(e)}")
                await session.rollback()
                raise

async def main():
    """Main function to run the admin creator"""
    creator = MultipleAdminCreator()
    await creator.run()

if __name__ == "__main__":
    asyncio.run(main())
