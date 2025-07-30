#!/usr/bin/env python3
"""
Test script to verify admin login functionality
"""
import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Add the app directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.core.security import verify_password
from app.models import User

async def test_admin_login():
    """Test admin login functionality"""
    print("🧪 Testing Admin Login...")
    print("-" * 40)
    
    try:
        # Test database connection
        async with AsyncSessionLocal() as session:
            print("✅ Database connection successful")
            
            # Find admin user
            result = await session.execute(
                select(User).where(User.email == "admin@attendance.com")
            )
            user = result.scalar_one_or_none()
            
            if not user:
                print("❌ Admin user not found in database")
                return False
                
            print(f"✅ Admin user found: {user.full_name}")
            print(f"   Email: {user.email}")
            print(f"   Role: {user.role}")
            print(f"   Active: {user.is_active}")
            
            # Test password verification
            test_password = "admin123"
            is_valid = verify_password(test_password, user.hashed_password)
            
            if is_valid:
                print(f"✅ Password verification successful for '{test_password}'")
                return True
            else:
                print(f"❌ Password verification failed for '{test_password}'")
                print(f"   Stored hash: {user.hashed_password[:20]}...")
                return False
                
    except Exception as e:
        print(f"❌ Error during test: {str(e)}")
        return False

async def main():
    """Main test function"""
    print("🚀 Starting Admin Login Test")
    print("=" * 50)
    
    success = await test_admin_login()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 Admin login test PASSED!")
        print("You should be able to login with:")
        print("   Email: admin@attendance.com")
        print("   Password: admin123")
    else:
        print("💥 Admin login test FAILED!")
        print("Check the errors above for details.")

if __name__ == "__main__":
    asyncio.run(main())
