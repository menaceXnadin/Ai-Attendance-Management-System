#!/usr/bin/env python3
"""
Create the academic_events table and populate with sample data
"""

import sqlite3
from datetime import datetime, date

# Connect to database
conn = sqlite3.connect('attendance.db')
cursor = conn.cursor()

print("Creating academic_events table...")

# Create the academic_events table based on the SQLAlchemy model
cursor.execute("""
CREATE TABLE IF NOT EXISTS academic_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    start_time TIME,
    end_time TIME,
    is_all_day BOOLEAN DEFAULT 0,
    holiday_type VARCHAR(50),
    subject_id INTEGER,
    faculty_id INTEGER,
    class_room VARCHAR(100),
    color_code VARCHAR(7) NOT NULL,
    is_recurring BOOLEAN DEFAULT 0,
    recurrence_pattern TEXT,
    created_by INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    attendance_required BOOLEAN DEFAULT 0,
    notification_settings TEXT
)
""")

print("Table created successfully!")

# Add some sample events for September 2025
sample_events = [
    {
        'title': 'Test Event',
        'description': 'A test event for September 3rd',
        'event_type': 'special_event',
        'start_date': '2025-09-03',
        'end_date': '2025-09-03',
        'is_all_day': 1,
        'color_code': '#8B5CF6',
        'created_by': 1
    },
    {
        'title': 'Mathematics Class',
        'description': 'Regular mathematics lecture',
        'event_type': 'class',
        'start_date': '2025-09-03',
        'start_time': '09:00',
        'end_time': '10:30',
        'is_all_day': 0,
        'color_code': '#22C55E',
        'created_by': 1
    },
    {
        'title': 'Saturday Holiday',
        'description': 'Weekend holiday in Nepal',
        'event_type': 'holiday',
        'start_date': '2025-09-07',
        'is_all_day': 1,
        'color_code': '#EF4444',
        'created_by': 1
    }
]

print("Inserting sample events...")
for event in sample_events:
    cursor.execute("""
        INSERT INTO academic_events 
        (title, description, event_type, start_date, end_date, start_time, end_time, 
         is_all_day, color_code, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        event['title'],
        event['description'],
        event['event_type'],
        event['start_date'],
        event.get('end_date'),
        event.get('start_time'),
        event.get('end_time'),
        event['is_all_day'],
        event['color_code'],
        event['created_by']
    ))

# Commit changes
conn.commit()

# Verify the data
cursor.execute("SELECT COUNT(*) FROM academic_events")
count = cursor.fetchone()[0]
print(f"Total events created: {count}")

cursor.execute("SELECT id, title, event_type, start_date, color_code FROM academic_events")
events = cursor.fetchall()
print("Created events:")
for event in events:
    print(f"  {event[0]}: {event[1]} ({event[2]}) on {event[3]} - {event[4]}")

conn.close()
print("Done!")