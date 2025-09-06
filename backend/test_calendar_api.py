#!/usr/bin/env python3
"""
Test the calendar API endpoint directly
"""
import requests
import json

# --- Configuration ---
BASE_URL = "http://localhost:8000"
ADMIN_EMAIL = "admin@attendance.com"
ADMIN_PASSWORD = "admin123"
# --- End Configuration ---

def get_auth_token():
    """Authenticate and get JWT token."""
    login_data = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        response.raise_for_status()
        return response.json().get("access_token")
    except requests.exceptions.RequestException as e:
        print(f"❌ Authentication failed: {e}")
        if e.response:
            print(f"    Response: {e.response.text}")
        return None

def fetch_calendar_events(token):
    """Fetch calendar events using the auth token."""
    if not token:
        return

    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "start_date": "2025-09-01",
        "end_date": "2025-09-30"
    }
    try:
        response = requests.get(f"{BASE_URL}/api/calendar/events", headers=headers, params=params)
        response.raise_for_status()
        events = response.json()
        
        print("✅ Successfully fetched calendar events:")
        print(json.dumps(events, indent=2))
        
        if not events:
            print("\n⚠️ Warning: The API returned an empty list of events.")
            print("   This could mean there are no events in the current date range or a filter is applied.")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to fetch calendar events: {e}")
        if e.response:
            print(f"    Response: {e.response.text}")

def test_calendar_api():
    """Test calendar API endpoint"""
    print("🌐 Testing Calendar API endpoint...")
    
    # Test without auth first
    try:
        endpoint = f"{BASE_URL}/api/calendar/events"
        
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
    print("--- Starting API Test ---")
    auth_token = get_auth_token()
    if auth_token:
        print(f"🔑 Successfully obtained auth token: ...{auth_token[-10:]}")
        fetch_calendar_events(auth_token)
    else:
        print("\nCould not proceed without a valid auth token.")
    print("--- API Test Finished ---")
