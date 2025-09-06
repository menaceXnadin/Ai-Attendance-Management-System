import asyncpg
import asyncio

async def fix_cascade_delete():
    conn = await asyncpg.connect('postgresql://postgres:nadin123@localhost:5432/attendancedb')
    
    try:
        print("🔧 Fixing CASCADE DELETE constraint...")
        
        # First, drop the existing constraint
        await conn.execute("""
            ALTER TABLE event_sessions 
            DROP CONSTRAINT IF EXISTS event_sessions_parent_event_id_fkey
        """)
        print("   ✅ Dropped existing foreign key constraint")
        
        # Add the constraint with CASCADE DELETE
        await conn.execute("""
            ALTER TABLE event_sessions 
            ADD CONSTRAINT event_sessions_parent_event_id_fkey 
            FOREIGN KEY (parent_event_id) 
            REFERENCES academic_events(id) 
            ON DELETE CASCADE
        """)
        print("   ✅ Added new foreign key constraint with CASCADE DELETE")
        
        print("🎉 CASCADE DELETE constraint fixed successfully!")
        
    except Exception as e:
        print(f"❌ Error fixing constraint: {e}")
    
    finally:
        await conn.close()

asyncio.run(fix_cascade_delete())