#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.calendar import AcademicEvent
from sqlalchemy import text

def check_events():
    """Check current events in database and their colors"""
    
    # Create a database session
    db = SessionLocal()
    
    try:
        print('📊 Current events in database:')
        events = db.query(AcademicEvent).all()
        
        if not events:
            print('❌ No events found in database')
            return
            
        for event in events:
            print(f'- Title: {event.title}')
            print(f'  Type: {event.event_type}')
            print(f'  Color: {event.color_code}')
            print(f'  Date: {event.start_date}')
            print()
        
        print(f'📊 Total events: {len(events)}')
        
        # Get unique event types
        event_types = db.execute(text('SELECT DISTINCT event_type FROM academic_events')).fetchall()
        print('\n🏷️ Unique event types in database:')
        for et in event_types:
            print(f'- {et[0]}')
            
        # Check color distribution
        print('\n🎨 Event type and color distribution:')
        color_distribution = db.execute(text('''
            SELECT event_type, color_code, COUNT(*) as count
            FROM academic_events 
            GROUP BY event_type, color_code
            ORDER BY event_type, color_code
        ''')).fetchall()
        
        for dist in color_distribution:
            print(f'- {dist[0]} ({dist[1]}): {dist[2]} events')
            
    except Exception as e:
        print(f'❌ Error: {e}')
    finally:
        db.close()

def update_event_colors():
    """Update event colors based on their types"""
    
    # Define proper colors for each event type
    color_mapping = {
        'class': '#22C55E',      # Green for classes
        'CLASS': '#22C55E',
        'exam': '#F97316',       # Orange for exams
        'EXAM': '#F97316',
        'holiday': '#EF4444',    # Red for holidays
        'HOLIDAY': '#EF4444',
        'special_event': '#8B5CF6',  # Purple for special events
        'SPECIAL_EVENT': '#8B5CF6',
        'cancelled_class': '#64748B',  # Gray for cancelled
        'CANCELLED_CLASS': '#64748B'
    }
    
    db = SessionLocal()
    
    try:
        events = db.query(AcademicEvent).all()
        updated_count = 0
        
        for event in events:
            # Get the appropriate color for this event type
            new_color = color_mapping.get(event.event_type)
            
            if new_color and event.color_code != new_color:
                print(f'🎨 Updating {event.title} ({event.event_type}): {event.color_code} -> {new_color}')
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
            print(f'✅ Updated {updated_count} events with proper colors')
        else:
            print('ℹ️  No events needed color updates')
            
    except Exception as e:
        print(f'❌ Error updating colors: {e}')
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    print('🔍 Checking current event colors...\n')
    check_events()
    
    print('\n' + '='*50)
    print('🎨 Updating event colors based on types...\n')
    update_event_colors()
    
    print('\n' + '='*50)
    print('🔍 Checking updated event colors...\n')
    check_events()
