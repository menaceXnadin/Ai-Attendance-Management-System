#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.calendar import AcademicEvent, EventType
from sqlalchemy import text

def update_event_colors():
    """Update event colors based on their types"""
    
    # Define proper colors for each event type enum
    color_mapping = {
        EventType.CLASS: '#22C55E',          # Green for classes
        EventType.EXAM: '#F97316',           # Orange for exams
        EventType.HOLIDAY: '#EF4444',        # Red for holidays
        EventType.SPECIAL_EVENT: '#8B5CF6',  # Purple for special events
        EventType.CANCELLED_CLASS: '#64748B' # Gray for cancelled
    }
    
    db = SessionLocal()
    
    try:
        events = db.query(AcademicEvent).all()
        updated_count = 0
        
        print(f'📊 Processing {len(events)} events...\n')
        
        for event in events:
            # Get the appropriate color for this event type
            new_color = color_mapping.get(event.event_type)
            
            if new_color and event.color_code != new_color:
                print(f'🎨 Updating {event.title} ({event.event_type.value}): {event.color_code} -> {new_color}')
                event.color_code = new_color
                updated_count += 1
            elif not new_color:
                print(f'⚠️  Unknown event type: {event.event_type} for event: {event.title}')
                # Default to purple for unknown types
                if event.color_code != '#8B5CF6':
                    event.color_code = '#8B5CF6'
                    updated_count += 1
        
        if updated_count > 0:
            db.commit()
            print(f'\n✅ Updated {updated_count} events with proper colors')
        else:
            print('\nℹ️  No events needed color updates')
            
        # Show updated distribution
        print('\n🎨 Updated color distribution:')
        color_distribution = db.execute(text('''
            SELECT event_type, color_code, COUNT(*) as count
            FROM academic_events 
            GROUP BY event_type, color_code
            ORDER BY event_type, color_code
        ''')).fetchall()
        
        for dist in color_distribution:
            print(f'- {dist[0]} ({dist[1]}): {dist[2]} events')
            
    except Exception as e:
        print(f'❌ Error updating colors: {e}')
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    print('🎨 Updating event colors based on types...\n')
    update_event_colors()
