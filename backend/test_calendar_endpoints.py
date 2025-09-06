#!/usr/bin/env python3
"""
Quick test of calendar endpoints with proper authentication
"""
import requests
import json

def test_calendar_endpoints():
    """Test calendar endpoints with authentication"""
    base_url = "http://localhost:8000"
    
    # Step 1: Login to get token
    print("🔐 Logging in...")
    login_data = {
        "email": "admin@attendance.com",
        "password": "admin123"
    }
    
    try:
        login_response = requests.post(
            f"{base_url}/api/auth/login",
            json=login_data,
            headers={"Content-Type": "application/json"}
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get('access_token')
            print(f"✅ Login successful, token: {token[:20]}...")
            
            # Step 2: Test calendar events endpoint
            print("\n📅 Testing calendar events endpoint...")
            events_response = requests.get(
                f"{base_url}/api/calendar/events?start_date=2025-09-01&end_date=2025-09-30",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                }
            )
            
            print(f"Events endpoint status: {events_response.status_code}")
            if events_response.status_code == 200:
                events = events_response.json()
                print(f"✅ Got {len(events)} events")
                for event in events[:3]:  # Show first 3
                    print(f"  - {event.get('title')} ({event.get('start_date')})")
            else:
                print(f"❌ Events error: {events_response.text}")
            
            # Step 3: Test calendar stats endpoint
            print("\n📊 Testing calendar stats endpoint...")
            stats_response = requests.get(
                f"{base_url}/api/calendar/stats/overview",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                }
            )
            
            print(f"Stats endpoint status: {stats_response.status_code}")
            if stats_response.status_code == 200:
                stats = stats_response.json()
                print(f"✅ Stats: {json.dumps(stats, indent=2)}")
            else:
                print(f"❌ Stats error: {stats_response.text}")
                
        else:
            print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_calendar_endpoints()
