#!/usr/bin/env python3
"""
Authentication Test Script
Tests login functionality and verifies token-based authentication
"""

import asyncio
import aiohttp
import json
from datetime import datetime

# Test configuration
BASE_URL = "http://localhost:8000"

async def test_authentication():
    """Test authentication flow"""
    print("🔐 Testing Authentication Flow")
    print("=" * 60)
    
    async with aiohttp.ClientSession() as session:
        # Test 1: Check if we can access public endpoints
        try:
            async with session.get(f"{BASE_URL}/") as response:
                if response.status == 200:
                    result = await response.json()
                    print("✅ Backend API is accessible")
                    print(f"   Message: {result.get('message', 'N/A')}")
                else:
                    print("❌ Backend API not accessible")
                    return
        except Exception as e:
            print(f"❌ Error accessing backend: {e}")
            return

        # Test 2: Try to access protected endpoint without auth
        print("\n🔒 Testing Protected Endpoint Access:")
        try:
            async with session.get(f"{BASE_URL}/api/auth/me") as response:
                if response.status == 401:
                    print("✅ Protected endpoint correctly returns 401 without auth")
                else:
                    print(f"⚠️  Protected endpoint returned unexpected status: {response.status}")
        except Exception as e:
            print(f"❌ Error testing protected endpoint: {e}")

        # Test 3: Check if there are any existing users we can login with
        print("\n👤 Testing Login with Common Test Credentials:")
        
        test_credentials = [
            {"email": "admin@attendance.com", "password": "admin123"},  # Created by sample data script
            {"email": "nadin@gmail.com", "password": "password123"},  # First student in list
            {"email": "arohi@gmail.com", "password": "password123"},  # Second student in list
            {"email": "student1@example.com", "password": "password123"},  # Generated student
            {"email": "student1@example.com", "password": "student123"},  # Try alternate password
            {"email": "ramnepali@gmail.com", "password": "password123"},  # Real sounding student
            {"email": "mathstudent@gmail.com", "password": "password123"},  # Math student
            {"email": "admin@example.com", "password": "admin123"},
            {"email": "student@example.com", "password": "student123"},
            {"email": "test@test.com", "password": "password"},
            {"email": "user@test.com", "password": "password"},
        ]
        
        successful_login = None
        
        for creds in test_credentials:
            try:
                login_data = {
                    "email": creds["email"],
                    "password": creds["password"]
                }
                
                async with session.post(f"{BASE_URL}/api/auth/login", 
                                      json=login_data) as response:
                    if response.status == 200:
                        result = await response.json()
                        print(f"✅ Successfully logged in with {creds['email']}")
                        print(f"   User: {result.get('user', {}).get('full_name', 'N/A')}")
                        print(f"   Role: {result.get('user', {}).get('role', 'N/A')}")
                        
                        # Store token for further testing
                        token = result.get('access_token')
                        successful_login = {
                            "token": token,
                            "user": result.get('user', {}),
                            "credentials": creds
                        }
                        break
                    else:
                        error_text = await response.text()
                        print(f"❌ Login failed for {creds['email']}: {response.status}")
                        if response.status != 401:  # Don't show details for auth failures
                            print(f"   Error: {error_text}")
            except Exception as e:
                print(f"❌ Error testing login for {creds['email']}: {e}")

        # Test 4: If we have a successful login, test authenticated requests
        if successful_login:
            print(f"\n🎯 Testing Authenticated Requests:")
            token = successful_login["token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Test user info endpoint
            try:
                async with session.get(f"{BASE_URL}/api/auth/me", headers=headers) as response:
                    if response.status == 200:
                        user_data = await response.json()
                        print("✅ Successfully retrieved user info")
                        print(f"   Name: {user_data.get('full_name', 'N/A')}")
                        print(f"   Email: {user_data.get('email', 'N/A')}")
                        print(f"   Role: {user_data.get('role', 'N/A')}")
                    else:
                        print(f"❌ Failed to get user info: {response.status}")
            except Exception as e:
                print(f"❌ Error getting user info: {e}")
            
            # Test attendance endpoint (the one that was failing)
            if successful_login["user"].get("role") == "student":
                try:
                    # Get student data first
                    async with session.get(f"{BASE_URL}/api/students", headers=headers) as response:
                        if response.status == 200:
                            students = await response.json()
                            if students:
                                student_id = students[0].get('id')
                                print(f"✅ Retrieved student data, ID: {student_id}")
                                
                                # Test attendance endpoint
                                date_str = datetime.now().strftime("%Y-%m-%d")
                                async with session.get(f"{BASE_URL}/api/attendance?student_id={student_id}&date={date_str}", 
                                                     headers=headers) as att_response:
                                    if att_response.status == 200:
                                        print("✅ Successfully accessed attendance endpoint")
                                    else:
                                        print(f"❌ Attendance endpoint failed: {att_response.status}")
                                        error_text = await att_response.text()
                                        print(f"   Error: {error_text}")
                        else:
                            print(f"❌ Failed to get student data: {response.status}")
                except Exception as e:
                    print(f"❌ Error testing attendance endpoint: {e}")
        else:
            print("\n❌ No successful login found. Need to create test users.")
            print("\n📋 Recommendations:")
            print("1. Check if there are users in the database")
            print("2. Create a test user through the admin interface")
            print("3. Verify the login API endpoint is working correctly")

        print("\n" + "=" * 60)
        print("📋 Authentication Test Summary:")
        if successful_login:
            print(f"✅ Authentication working with: {successful_login['credentials']['email']}")
            print("✅ Token-based API access functional")
            print("📄 Token for frontend testing:")
            print(f"   {successful_login['token'][:50]}...")
        else:
            print("❌ Authentication issues detected")
            print("❌ No valid login credentials found")
        print("=" * 60)

async def main():
    """Main test function"""
    print("🚀 Authentication Flow Test")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    await test_authentication()

if __name__ == "__main__":
    asyncio.run(main())
