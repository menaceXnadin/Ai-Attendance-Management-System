#!/usr/bin/env python3
"""
Test the API login endpoint directly
"""
import requests
import json

def test_api_login():
    """Test the login API endpoint"""
    print("🧪 Testing API Login Endpoint...")
    print("-" * 40)
    
    # API endpoint
    url = "http://localhost:8000/api/auth/login"
    
    # Login data
    login_data = {
        "email": "admin@attendance.com",
        "password": "admin123"
    }
    
    try:
        print(f"🔗 Testing: {url}")
        print(f"📝 Data: {json.dumps(login_data, indent=2)}")
        
        # Make the request
        response = requests.post(url, json=login_data)
        
        print(f"📊 Status Code: {response.status_code}")
        print(f"📄 Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Login API test PASSED!")
            print(f"   Token received: {data.get('access_token', 'N/A')[:20]}...")
            print(f"   User: {data.get('user', {}).get('full_name', 'N/A')}")
            return True
        else:
            print("❌ Login API test FAILED!")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend server!")
        print("   Make sure the backend is running on port 8000")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    test_api_login()
