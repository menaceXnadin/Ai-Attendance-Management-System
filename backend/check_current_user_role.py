#!/usr/bin/env python3
"""
Check current user's role in database
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models import User, Admin

async def check_user_role():
    async for db in get_db():
        try:
            # Get all users to see their roles
            result = await db.execute(select(User))
            users = result.scalars().all()
            
            print("=== ALL USERS IN DATABASE ===")
            for user in users:
                role_display = user.role.value if hasattr(user.role, 'value') else user.role
                print(f"Email: {user.email}")
                print(f"Name: {user.full_name}")
                print(f"Role: {role_display} (type: {type(user.role)})")
                print(f"Active: {user.is_active}")
                
                # Check if admin profile exists
                if role_display == "admin":
                    admin_result = await db.execute(select(Admin).filter(Admin.user_id == user.id))
                    admin_profile = admin_result.scalar_one_or_none()
                    if admin_profile:
                        print(f"Admin Profile: YES (ID: {admin_profile.admin_id})")
                    else:
                        print(f"Admin Profile: NO - MISSING!")
                print("-" * 50)
            
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            break

if __name__ == "__main__":
    asyncio.run(check_user_role())
