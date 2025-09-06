import requests
import json
from datetime import datetime, timedelta

def verify_calendar_events():
    """Verify that all event types are available and should be visible in the frontend"""
    
    # Get auth token
    login_response = requests.post('http://localhost:8000/api/auth/login', 
        json={'email': 'admin@attendance.com', 'password': 'admin123'})

    if login_response.status_code == 200:
        token = login_response.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}
        
        # Get events for September 2025
        response = requests.get('http://localhost:8000/api/calendar/events?start_date=2025-09-01&end_date=2025-09-30', 
                               headers=headers)
        
        if response.status_code == 200:
            events = response.json()
            
            print("🎯 CALENDAR EVENT VERIFICATION")
            print(f"📅 Total events in September 2025: {len(events)}")
            
            # Group by event type
            event_groups = {}
            for event in events:
                event_type = event['event_type']
                if event_type not in event_groups:
                    event_groups[event_type] = []
                event_groups[event_type].append(event)
            
            print(f"\n📊 Event Types Summary:")
            for event_type, type_events in event_groups.items():
                print(f"  • {event_type}: {len(type_events)} events")
            
            print(f"\n🔍 Sample Events by Type:")
            for event_type, type_events in event_groups.items():
                print(f"\n  📋 {event_type.upper()}:")
                for event in type_events[:2]:  # Show first 2 of each type
                    title = event['title']
                    date = event['start_date']
                    color = event.get('color_code', 'No color')
                    print(f"    - {date}: {title} (Color: {color})")
                if len(type_events) > 2:
                    print(f"    ... and {len(type_events) - 2} more")
            
            # Verify we have the test events we created
            expected_events = {
                'exam': ['Midterm Examinations Begin'],
                'special_event': ['College Sports Day'],
                'cancelled_class': ['Faculty Meeting - Classes Cancelled']
            }
            
            print(f"\n✅ VERIFICATION:")
            all_found = True
            for event_type, expected_titles in expected_events.items():
                type_events = event_groups.get(event_type, [])
                for expected_title in expected_titles:
                    found = any(event['title'] == expected_title for event in type_events)
                    status = "✅" if found else "❌"
                    print(f"  {status} {event_type}: {expected_title}")
                    if not found:
                        all_found = False
            
            if all_found:
                print(f"\n🎉 SUCCESS: All test events found! Frontend should display:")
                print(f"  • Green Academic Days (CLASS events)")
                print(f"  • Red Saturday Holidays (HOLIDAY events)")
                print(f"  • Orange Exams (EXAM events)")
                print(f"  • Purple Special Events (SPECIAL_EVENT events)")
                print(f"  • Gray Cancelled Classes (CANCELLED_CLASS events)")
            else:
                print(f"\n⚠️  Some test events are missing. Check the calendar creation.")
                
        else:
            print(f"❌ API Error: {response.status_code} - {response.text}")
    else:
        print(f"❌ Login failed: {login_response.status_code}")

if __name__ == '__main__':
    verify_calendar_events()