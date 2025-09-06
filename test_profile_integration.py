#!/usr/bin/env python3
"""
Test Profile Page Dashboard Integration
Verifies that the profile page is properly integrated with the student dashboard
"""

import asyncio
import aiohttp
import json
from datetime import datetime

# Test configuration
BASE_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:8080"

async def test_profile_integration():
    """Test profile page integration with dashboard"""
    print("🔍 Testing Profile Page Dashboard Integration")
    print("=" * 60)
    
    async with aiohttp.ClientSession() as session:
        # Test 1: Check if frontend is running
        try:
            async with session.get(FRONTEND_URL) as response:
                if response.status == 200:
                    print("✅ Frontend is running at", FRONTEND_URL)
                else:
                    print("❌ Frontend not accessible")
                    return
        except Exception as e:
            print(f"❌ Error accessing frontend: {e}")
            return
        
        # Test 2: Check backend API health
        try:
            async with session.get(f"{BASE_URL}/health") as response:
                if response.status == 200:
                    print("✅ Backend API is running at", BASE_URL)
                else:
                    print("❌ Backend API not accessible")
                    return
        except Exception as e:
            print(f"❌ Error accessing backend: {e}")
            return
        
        # Test 3: Check student profile endpoint
        print("\n🧪 Testing Profile API Endpoints:")
        
        # First login to get a token (using a test student)
        login_data = {
            "username": "student123",
            "password": "password123"
        }
        
        try:
            async with session.post(f"{BASE_URL}/api/auth/login", 
                                  data=login_data) as response:
                if response.status == 200:
                    result = await response.json()
                    token = result.get("access_token")
                    print("✅ Successfully logged in as test student")
                    
                    # Test profile data endpoint
                    headers = {"Authorization": f"Bearer {token}"}
                    async with session.get(f"{BASE_URL}/api/auth/me", 
                                         headers=headers) as profile_response:
                        if profile_response.status == 200:
                            profile_data = await profile_response.json()
                            print("✅ Profile data retrieved successfully")
                            print(f"   Student ID: {profile_data.get('student_id', 'N/A')}")
                            print(f"   Name: {profile_data.get('full_name', 'N/A')}")
                            print(f"   Email: {profile_data.get('email', 'N/A')}")
                            print(f"   Department: {profile_data.get('department', 'N/A')}")
                            print(f"   Year: {profile_data.get('academic_year', 'N/A')}")
                        else:
                            print("❌ Failed to retrieve profile data")
                else:
                    print("❌ Login failed - using anonymous access")
        except Exception as e:
            print(f"❌ Error testing profile endpoints: {e}")
        
        # Test 4: Check face registration status
        print("\n🎭 Testing Face Registration Status:")
        try:
            # Test the face registration endpoint
            async with session.get(f"{BASE_URL}/api/students/face-registration-status") as response:
                if response.status == 200:
                    face_status = await response.json()
                    print("✅ Face registration status endpoint working")
                    print(f"   Status: {face_status}")
                else:
                    print("❌ Face registration status not accessible")
        except Exception as e:
            print(f"❌ Error checking face registration: {e}")

def check_frontend_files():
    """Check if the profile page files are properly structured"""
    print("\n📁 Checking Frontend File Structure:")
    
    import os
    
    files_to_check = [
        "frontend/src/pages/ProfilePage.tsx",
        "frontend/src/components/StudentProfile.tsx", 
        "frontend/src/components/StudentSidebar.tsx",
        "frontend/src/components/StudentFormEnhanced.tsx"
    ]
    
    for file_path in files_to_check:
        full_path = os.path.join(os.getcwd(), file_path)
        if os.path.exists(full_path):
            print(f"✅ {file_path} exists")
            
            # Check file size to ensure it's not empty
            size = os.path.getsize(full_path)
            if size > 100:  # At least 100 bytes
                print(f"   Size: {size} bytes")
            else:
                print(f"   ⚠️  File seems too small: {size} bytes")
        else:
            print(f"❌ {file_path} missing")

def check_navigation_consistency():
    """Check if navigation routes are consistent"""
    print("\n🧭 Checking Navigation Consistency:")
    
    import re
    
    try:
        # Check StudentSidebar.tsx for profile route
        with open("frontend/src/components/StudentSidebar.tsx", "r") as f:
            sidebar_content = f.read()
            
        if "/student/profile" in sidebar_content:
            print("✅ Profile route found in StudentSidebar")
        else:
            print("❌ Profile route not found in StudentSidebar")
            
        # Check App.tsx for route definition
        with open("frontend/src/App.tsx", "r") as f:
            app_content = f.read()
            
        if "/student/profile" in app_content and "ProfilePage" in app_content:
            print("✅ Profile route properly defined in App.tsx")
        else:
            print("❌ Profile route not properly defined in App.tsx")
            
    except Exception as e:
        print(f"❌ Error checking navigation: {e}")

async def main():
    """Main test function"""
    print("🚀 Profile Page Integration Test")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Check file structure first
    check_frontend_files()
    
    # Check navigation consistency
    check_navigation_consistency()
    
    # Test API integration
    await test_profile_integration()
    
    print("\n" + "=" * 60)
    print("📋 Next Steps:")
    print("1. Navigate to http://localhost:8080/student/profile")
    print("2. Verify the profile page has the sidebar navigation")
    print("3. Check that you can navigate between sections")
    print("4. Ensure the profile feels integrated with the dashboard")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
