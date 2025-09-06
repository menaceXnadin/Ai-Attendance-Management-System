import asyncpg
import asyncio

async def fix_events():
    conn = await asyncpg.connect('postgresql://postgres:nadin123@localhost:5432/attendancedb')
    
    # First check current state
    events = await conn.fetch('SELECT id, title, is_active FROM academic_events WHERE is_active IS NULL OR is_active = false')
    print(f'📅 Found {len(events)} inactive/null events:')
    for event in events[:5]:  # Show first 5
        print(f'  ID: {event["id"]}, Title: {event["title"]}, Active: {event["is_active"]}')
    
    if events:
        # Update all inactive/null events to be active
        updated = await conn.execute('UPDATE academic_events SET is_active = true WHERE is_active IS NULL OR is_active = false')
        print(f'✅ Updated {updated.split()[1]} events to active')
        
        # Verify the fix
        active_events = await conn.fetch('SELECT COUNT(*) as count FROM academic_events WHERE is_active = true')
        print(f'📊 Total active events now: {active_events[0]["count"]}')
    else:
        print('✅ All events are already active')
    
    await conn.close()

asyncio.run(fix_events())