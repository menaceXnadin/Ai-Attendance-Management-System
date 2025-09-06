#!/usr/bin/env python3

import requests
import json

# Test API response to see event_type format
url = "http://localhost:8000/api/calendar/events"
params = {
    "start_date": "2025-08-01",
    "end_date": "2025-08-31"
}

# We need to get an auth token first - let's just check what we get without auth
try:
    response = requests.get(url, params=params)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        events = response.json()
        print(f"Number of events: {len(events)}")
        
        if events:
            print("\nFirst few events:")
            for i, event in enumerate(events[:3]):
                print(f"\nEvent {i+1}:")
                print(f"  Title: {event.get('title')}")
                print(f"  Type: {event.get('event_type')} (type: {type(event.get('event_type'))})")
                print(f"  Color: {event.get('color_code')}")
                print(f"  Date: {event.get('start_date')}")
    else:
        print(f"Error: {response.text}")
        
except Exception as e:
    print(f"Error making request: {e}")
