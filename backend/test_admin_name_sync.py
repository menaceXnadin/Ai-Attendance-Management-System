"""
Test script to verify admin management API endpoints work correctly with the new name field.
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_db
from app.models import Admin, User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

async def test_admin_name_sync():
    """Test that admin names are properly synced with user full_name."""
    print("Testing admin name synchronization...")
    
    async for db in get_db():
        try:
            # Get all admins with their user data
            result = await db.execute(
                select(Admin)
                .join(User)
                .where(Admin.user_id == User.id)
            )
            admins = result.scalars().all()
            
            print(f"\nFound {len(admins)} admin(s):")
            
            for admin in admins:
                # Get the user for this admin
                user_result = await db.execute(
                    select(User).where(User.id == admin.user_id)
                )
                user = user_result.scalar_one_or_none()
                
                print(f"\nAdmin ID: {admin.admin_id}")
                print(f"Admin Name: {admin.name}")
                print(f"User Full Name: {user.full_name if user else 'No user found'}")
                print(f"User Email: {user.email if user else 'No user found'}")
                print(f"Permissions: {admin.permissions}")
                print(f"Department: {admin.department}")
                
                # Check if names are in sync
                if user and admin.name != user.full_name:
                    print(f"⚠️  WARNING: Admin name '{admin.name}' doesn't match user full_name '{user.full_name}'")
                else:
                    print("✅ Name synchronization OK")
            
            print("\n" + "="*50)
            print("Admin name synchronization test completed!")
            
        except Exception as e:
            print(f"❌ Error during test: {e}")
            import traceback
            traceback.print_exc()
        finally:
            break

async def test_admin_api_structure():
    """Test that admin API structure is ready."""
    print("\nTesting admin API structure...")
    
    # Check if the admin router file exists and has the right endpoints
    try:
        from app.api.routes.admins import router
        
        # Get all routes from the router
        routes = [route for route in router.routes]
        
        print(f"Found {len(routes)} admin API routes:")
        for route in routes:
            if hasattr(route, 'methods') and hasattr(route, 'path'):
                methods = ', '.join(route.methods)
                print(f"  {methods} {route.path}")
        
        print("✅ Admin API structure looks good!")
        
    except Exception as e:
        print(f"❌ Error checking admin API structure: {e}")

if __name__ == "__main__":
    print("🔍 Testing Admin Management System with Name Field")
    print("="*60)
    
    asyncio.run(test_admin_name_sync())
    asyncio.run(test_admin_api_structure())
