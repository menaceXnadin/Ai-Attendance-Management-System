import asyncpg
import asyncio

async def fix_boolean_fields():
    conn = await asyncpg.connect('postgresql://postgres:nadin123@localhost:5432/attendancedb')
    
    # Check null boolean fields
    null_booleans = await conn.fetch('''
        SELECT id, title, is_recurring, attendance_required, is_all_day 
        FROM academic_events 
        WHERE is_recurring IS NULL OR attendance_required IS NULL OR is_all_day IS NULL
        LIMIT 5
    ''')
    
    print(f'📅 Found events with null boolean fields:')
    for event in null_booleans:
        print(f'  ID: {event["id"]}, Title: {event["title"]}, is_recurring: {event["is_recurring"]}, attendance_required: {event["attendance_required"]}, is_all_day: {event["is_all_day"]}')
    
    # Fix null boolean fields
    updates = [
        "UPDATE academic_events SET is_recurring = false WHERE is_recurring IS NULL",
        "UPDATE academic_events SET attendance_required = false WHERE attendance_required IS NULL", 
        "UPDATE academic_events SET is_all_day = false WHERE is_all_day IS NULL"
    ]
    
    for update in updates:
        result = await conn.execute(update)
        print(f'✅ {update}: {result}')
    
    # Verify fix
    remaining_nulls = await conn.fetch('''
        SELECT COUNT(*) as count 
        FROM academic_events 
        WHERE is_recurring IS NULL OR attendance_required IS NULL OR is_all_day IS NULL
    ''')
    
    print(f'📊 Remaining null boolean fields: {remaining_nulls[0]["count"]}')
    
    await conn.close()

asyncio.run(fix_boolean_fields())