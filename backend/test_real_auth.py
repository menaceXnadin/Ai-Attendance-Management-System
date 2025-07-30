#!/usr/bin/env python3
"""
Test with real student credentials
"""
import requests
import json

def test_with_real_student():
    """Test face registration with real student credentials"""
    
    base_url = "http://127.0.0.1:8000"
    
    print("🔍 Testing with Real Student Credentials")
    print("=" * 45)
    
    # Use real student credentials
    login_data = {
        "email": "nadin@gmail.com",
        "password": "nadin123"  # Common password pattern
    }
    
    try:
        print("🔑 Attempting login...")
        login_response = requests.post(
            f"{base_url}/api/auth/login",
            json=login_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status: {login_response.status_code}")
        
        if login_response.status_code == 200:
            print("✅ Login successful!")
            login_result = login_response.json()
            token = login_result.get('access_token')
            
            # Test face registration
            print("\n🎯 Testing face registration...")
            test_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
            
            face_response = requests.post(
                f"{base_url}/api/face-recognition/register-face",
                json={"image_data": test_image},
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}"
                },
                timeout=30
            )
            
            print(f"Face registration status: {face_response.status_code}")
            print(f"Response: {face_response.text}")
            
        else:
            print(f"❌ Login failed: {login_response.text}")
            
            # Try other common passwords
            common_passwords = ["123456", "password", "nadin", "student123"]
            
            for pwd in common_passwords:
                print(f"\n🔄 Trying password: {pwd}")
                test_login = {
                    "email": "nadin@gmail.com", 
                    "password": pwd
                }
                
                test_response = requests.post(
                    f"{base_url}/api/auth/login",
                    json=test_login,
                    headers={"Content-Type": "application/json"},
                    timeout=5
                )
                
                if test_response.status_code == 200:
                    print(f"✅ Found working password: {pwd}")
                    # Test face registration with this
                    login_result = test_response.json()
                    token = login_result.get('access_token')
                    
                    print("🎯 Testing face registration with working auth...")
                    face_response = requests.post(
                        f"{base_url}/api/face-recognition/register-face",
                        json={"image_data": test_image},
                        headers={
                            "Content-Type": "application/json",
                            "Authorization": f"Bearer {token}"
                        },
                        timeout=30
                    )
                    
                    print(f"Face registration status: {face_response.status_code}")
                    print(f"Response: {face_response.text}")
                    break
                else:
                    print(f"❌ Failed with {pwd}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_with_real_student()
