#!/usr/bin/env python3
"""
Test the calendar API endpoint directly
"""
import requests
import json

def test_calendar_api():
    """Test calendar API endpoint"""
    print("🌐 Testing Calendar API endpoint...")
    
    # Test without auth first
    try:
        base_url = "http://localhost:8000"
        endpoint = f"{base_url}/api/calendar/events"
        
        # Add query parameters for August 2025
        params = {
            'start_date': '2025-08-01',
            'end_date': '2025-08-31'
        }
        
        print(f"📡 Making request to: {endpoint}")
        print(f"📊 Parameters: {params}")
        
        response = requests.get(endpoint, params=params)
        
        print(f"🔍 Response status: {response.status_code}")
        print(f"📝 Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success! Got {len(data)} events")
            
            saturday_events = [e for e in data if 'Saturday' in e.get('title', '')]
            print(f"📅 Saturday events found: {len(saturday_events)}")
            
            for event in saturday_events[:5]:  # Show first 5
                print(f"  - {event.get('title')} ({event.get('start_date')})")
                
        elif response.status_code == 401:
            print("❌ Unauthorized - Need token")
            print("💡 Try logging in first to get a token")
            
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"📝 Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - Is the backend running on localhost:8000?")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_calendar_api()
