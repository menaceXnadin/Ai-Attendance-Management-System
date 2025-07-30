#!/usr/bin/env python3
"""
Debug authentication flow and face registration step by step
"""
import requests
import json
import sys
from pathlib import Path

def test_student_registration_and_face():
    """Test complete flow: register student -> login -> register face"""
    
    base_url = "http://127.0.0.1:8000"
    
    print("🔍 Testing Complete Authentication & Face Registration Flow")
    print("=" * 60)
    
    # Step 1: Register a test student
    print("\n1️⃣ Registering test student...")
    student_data = {
        "email": "testuser@example.com",
        "password": "testpass123",
        "student_id": "TEST001", 
        "name": "Test User",
        "faculty": "Engineering",
        "semester": "1",
        "batch": "2024"
    }
    
    try:
        register_response = requests.post(
            f"{base_url}/api/auth/register-student",
            json=student_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"📊 Registration Status: {register_response.status_code}")
        if register_response.status_code == 201:
            print("✅ Student registered successfully")
        elif register_response.status_code == 400:
            response_data = register_response.json()
            if "already registered" in response_data.get("detail", "").lower():
                print("ℹ️ Student already exists, continuing...")
            else:
                print(f"❌ Registration failed: {response_data}")
        else:
            print(f"❌ Registration failed: {register_response.text}")
            
    except Exception as e:
        print(f"❌ Registration error: {e}")
    
    # Step 2: Login to get auth token
    print("\n2️⃣ Logging in to get auth token...")
    login_data = {
        "email": student_data["email"],
        "password": student_data["password"]
    }
    
    try:
        login_response = requests.post(
            f"{base_url}/api/auth/login",
            json=login_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"🔑 Login Status: {login_response.status_code}")
        if login_response.status_code == 200:
            login_result = login_response.json()
            token = login_result.get('access_token')
            user_data = login_result.get('user', {})
            
            print(f"✅ Login successful!")
            print(f"   User ID: {user_data.get('id')}")
            print(f"   Email: {user_data.get('email')}")
            print(f"   Token length: {len(token) if token else 0}")
            
            if not token:
                print("❌ No access token received")
                return False
                
            # Step 3: Test face registration with auth token
            print(f"\n3️⃣ Testing face registration with auth token...")
            
            # Create a test image (simple base64)
            test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
            
            registration_data = {
                "image_data": test_image_base64
            }
            
            auth_headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            }
            
            face_response = requests.post(
                f"{base_url}/api/face-recognition/register-face",
                json=registration_data,
                headers=auth_headers,
                timeout=30  # Longer timeout for face processing
            )
            
            print(f"🎯 Face Registration Status: {face_response.status_code}")
            print(f"🎯 Response Headers: {dict(face_response.headers)}")
            
            if face_response.status_code == 200:
                face_result = face_response.json()
                print(f"✅ Face registration successful!")
                print(f"   Response: {json.dumps(face_result, indent=2)}")
                return True
            else:
                print(f"❌ Face registration failed")
                print(f"   Response: {face_response.text}")
                
                # Try to parse error details
                try:
                    error_data = face_response.json()
                    print(f"   Error details: {json.dumps(error_data, indent=2)}")
                except:
                    pass
                
                return False
        else:
            print(f"❌ Login failed: {login_response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False

def test_token_validation():
    """Test if any existing tokens are valid"""
    print("\n🔍 Testing Token Validation")
    print("=" * 30)
    
    # This would test any tokens stored in browser localStorage
    # For now, just test the auth endpoints
    
    base_url = "http://127.0.0.1:8000"
    
    try:
        # Test the /auth/me endpoint without token
        me_response = requests.get(f"{base_url}/api/auth/me", timeout=5)
        print(f"📊 /auth/me without token: {me_response.status_code}")
        
        if me_response.status_code == 401:
            print("✅ Endpoint properly requires authentication")
        else:
            print(f"⚠️ Unexpected response: {me_response.text}")
            
    except Exception as e:
        print(f"❌ Token validation error: {e}")

def main():
    """Main debug function"""
    
    # Test 1: Token validation
    test_token_validation()
    
    # Test 2: Complete flow
    success = test_student_registration_and_face()
    
    print("\n" + "=" * 60)
    print("🎯 DIAGNOSIS SUMMARY:")
    if success:
        print("✅ Face registration works with proper authentication")
        print("💡 Issue is likely frontend authentication state")
    else:
        print("❌ Face registration failing even with valid authentication")
        print("💡 Issue might be in backend face processing")
    
    print("\n🔧 NEXT STEPS:")
    print("1. Check browser developer console for frontend errors")
    print("2. Verify user login state in frontend")
    print("3. Check if token is being sent properly from frontend")
    print("4. Verify backend is running and accessible")

if __name__ == "__main__":
    main()
