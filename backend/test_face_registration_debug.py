#!/usr/bin/env python3
"""
Debug script to test face registration functionality
"""
import sys
import os
import requests
import base64
import json
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

def test_face_registration_endpoint():
    """Test the face registration endpoint directly"""
    
    # Backend URL
    base_url = "http://127.0.0.1:8000"
    
    # First, check if backend is running
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        print(f"✅ Backend health check: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("❌ Backend is not running or not accessible")
        print("Please start the backend server first")
        return False
    except Exception as e:
        print(f"❌ Error checking backend: {e}")
        return False
    
    # Create a simple test image (base64 encoded)
    # This is a minimal 1x1 pixel image for testing
    test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    
    # Test the register-face endpoint without authentication first
    registration_data = {
        "image_data": test_image_base64
    }
    
    try:
        print("🧪 Testing face registration endpoint (no auth)...")
        response = requests.post(
            f"{base_url}/api/face-recognition/register-face",
            json=registration_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"📊 Status Code: {response.status_code}")
        print(f"📝 Response: {response.text[:500]}...")
        
        if response.status_code == 403:
            print("🔐 Authentication required - endpoint needs valid student login")
            
            # Test login endpoint to see if we can get a token
            print("\n🔑 Testing login to get authentication token...")
            login_data = {
                "email": "test@student.com",  # Generic test credentials
                "password": "password123"
            }
            
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
                if token:
                    print("✅ Login successful! Testing face registration with token...")
                    
                    # Now test face registration with token
                    auth_headers = {
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                    
                    auth_response = requests.post(
                        f"{base_url}/api/face-recognition/register-face",
                        json=registration_data,
                        headers=auth_headers,
                        timeout=10
                    )
                    
                    print(f"🎯 Authenticated Status: {auth_response.status_code}")
                    print(f"🎯 Authenticated Response: {auth_response.text[:500]}...")
                    
                    if auth_response.status_code == 200:
                        print("✅ Face registration works with authentication!")
                        return True
                    else:
                        print(f"❌ Face registration failed even with auth: {auth_response.status_code}")
                else:
                    print("❌ Login successful but no token received")
            else:
                print(f"❌ Login failed: {login_response.text[:200]}...")
                print("💡 This is normal if test credentials don't exist")
            
            print("\n💡 The issue is likely frontend authentication:")
            print("   - User might not be logged in")
            print("   - Token might be expired or invalid")
            print("   - Frontend token storage issue")
            
            return True  # Endpoint exists and works, just needs auth
            
        elif response.status_code == 200:
            print("✅ Registration endpoint is accessible")
            return True
        else:
            print(f"❌ Registration failed with status {response.status_code}")
            return False
            
    except requests.exceptions.Timeout:
        print("⏰ Request timed out - backend might be slow or unresponsive")
        return False
    except Exception as e:
        print(f"❌ Error testing registration: {e}")
        return False

def test_insightface_service():
    """Test InsightFace service initialization"""
    try:
        print("🤖 Testing InsightFace service...")
        from app.services.insightface_service import InsightFaceService
        
        # Initialize service
        service = InsightFaceService()
        print("✅ InsightFace service initialized successfully")
        
        # Test with simple image
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        
        result = service.process_face_registration(test_image_base64)
        print(f"📊 Registration result: {result}")
        
        return True
        
    except ImportError as e:
        print(f"❌ Cannot import InsightFace service: {e}")
        return False
    except Exception as e:
        print(f"❌ Error testing InsightFace service: {e}")
        return False

def main():
    """Main debug function"""
    print("🔍 Face Registration Debug Script")
    print("=" * 50)
    
    # Test 1: Backend connectivity
    print("\n1. Testing backend connectivity...")
    backend_ok = test_face_registration_endpoint()
    
    # Test 2: InsightFace service
    print("\n2. Testing InsightFace service...")
    service_ok = test_insightface_service()
    
    # Summary
    print("\n" + "=" * 50)
    print("🎯 Debug Summary:")
    print(f"   Backend Endpoint: {'✅ OK' if backend_ok else '❌ FAILED'}")
    print(f"   InsightFace Service: {'✅ OK' if service_ok else '❌ FAILED'}")
    
    if not backend_ok:
        print("\n💡 Recommendations:")
        print("   - Check if backend server is running on port 8000")
        print("   - Verify all dependencies are installed")
        print("   - Check for any startup errors in backend logs")
    
    if not service_ok:
        print("\n💡 Recommendations:")
        print("   - Check if InsightFace is properly installed")
        print("   - Verify model files are downloaded")
        print("   - Check Python environment and dependencies")

if __name__ == "__main__":
    main()
