import asyncpg
import asyncio

async def verify_events():
    conn = await asyncpg.connect('postgresql://postgres:nadin123@localhost:5432/attendancedb')
    
    # Check all events are properly formatted
    events = await conn.fetch('''
        SELECT id, title, event_type, start_date, is_active, 
               is_recurring, attendance_required, is_all_day
        FROM academic_events 
        WHERE is_active = true
        ORDER BY start_date DESC
        LIMIT 10
    ''')
    
    print(f'✅ Found {len(events)} active events:')
    for event in events:
        print(f'  ID: {event["id"]}, Title: {event["title"]}, Type: {event["event_type"]}, Date: {event["start_date"]}')
        print(f'      Active: {event["is_active"]}, Recurring: {event["is_recurring"]}, Attendance: {event["attendance_required"]}, All Day: {event["is_all_day"]}')
    
    # Check for any remaining NULL values that could cause issues
    null_check = await conn.fetch('''
        SELECT COUNT(*) as count
        FROM academic_events 
        WHERE is_active = true AND (
            is_recurring IS NULL OR 
            attendance_required IS NULL OR 
            is_all_day IS NULL
        )
    ''')
    
    print(f'\n📊 Events with NULL boolean fields: {null_check[0]["count"]}')
    
    await conn.close()

asyncio.run(verify_events())