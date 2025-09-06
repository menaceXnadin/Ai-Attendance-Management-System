#!/usr/bin/env python3
"""
Verify that the frontend will receive sessions correctly after the fixes
"""

import requests
import json
from datetime import datetime

def verify_frontend_data():
    base_url = 'http://localhost:8000'
    
    print("🔐 Logging in to get access token...")
    login_data = {'email': 'admin@attendance.com', 'password': 'admin123'}
    
    try:
        login_response = requests.post(f'{base_url}/api/auth/login', json=login_data)
        
        if login_response.status_code == 200:
            token = login_response.json()['access_token']
            headers = {'Authorization': f'Bearer {token}'}
            
            print('✅ Login successful!')
            
            # Get events as the frontend would
            today = datetime.now().strftime('%Y-%m-%d')
            print(f"🔍 Fetching events for {today}...")
            
            events_response = requests.get(
                f'{base_url}/api/calendar/events?start_date={today}&end_date={today}',
                headers=headers
            )
            
            if events_response.status_code == 200:
                events = events_response.json()
                print(f"📅 Found {len(events)} events for today")
                
                for event in events:
                    print(f"\n📍 Event: {event['title']} (ID: {event['id']})")
                    print(f"   Date: {event['start_date']}")
                    print(f"   Time: {event.get('start_time', 'N/A')} - {event.get('end_time', 'N/A')}")
                    
                    # Fetch sessions for this event
                    sessions_response = requests.get(
                        f'{base_url}/api/event-sessions/events/{event["id"]}/sessions',
                        headers=headers
                    )
                    
                    if sessions_response.status_code == 200:
                        sessions = sessions_response.json()
                        print(f"   🎯 Sessions: {len(sessions)}")
                        
                        for session in sessions:
                            print(f"      - {session['title']} ({session['start_time']} - {session['end_time']})")
                            print(f"        Color: {session.get('color_code', 'N/A')}")
                            
                            # Test the date parsing logic that was fixed
                            session_start_time = session['start_time']
                            session_end_time = session['end_time']
                            
                            # Apply the fix: handle both HH:MM and HH:MM:SS formats
                            if len(session_start_time) == 5:
                                session_start_time += ':00'
                            if len(session_end_time) == 5:
                                session_end_time += ':00'
                                
                            test_start = f"{event['start_date']}T{session_start_time}"
                            test_end = f"{event['start_date']}T{session_end_time}"
                            
                            print(f"        Frontend would parse as: {test_start} to {test_end}")
                            
                            # Test if dates are valid
                            try:
                                import datetime as dt
                                start_date = dt.datetime.fromisoformat(test_start)
                                end_date = dt.datetime.fromisoformat(test_end)
                                print(f"        ✅ Dates are valid: {start_date} to {end_date}")
                            except ValueError as e:
                                print(f"        ❌ Invalid dates: {e}")
                    else:
                        print(f"   ❌ Failed to fetch sessions: {sessions_response.text}")
                        
            else:
                print(f"❌ Failed to fetch events: {events_response.text}")
        else:
            print(f"❌ Failed to login: {login_response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - Is the backend running on localhost:8000?")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    verify_frontend_data()