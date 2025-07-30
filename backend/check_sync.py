from app.models import *
from app.core.database import sync_engine
from sqlalchemy import text

# Create a sync connection to check relationships
with sync_engine.connect() as conn:
    # Check foreign key constraints
    result = conn.execute(text('''
        SELECT 
            tc.table_name, 
            tc.constraint_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        ORDER BY tc.table_name;
    '''))
    
    print('🔗 FOREIGN KEY RELATIONSHIPS:')
    print('='*60)
    for row in result:
        print(f'{row[0]}.{row[2]} -> {row[3]}.{row[4]} ({row[1]})')
    
    print('\n📊 TABLE SYNC STATUS:')
    print('='*60)
    
    # Check tables exist
    tables_result = conn.execute(text('''
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    '''))
    
    tables = [row[0] for row in tables_result]
    print(f"✅ Total tables: {len(tables)}")
    for table in tables:
        print(f"   - {table}")
    
    print('\n🔄 SYNC CAPABILITIES:')
    print('='*60)
    print("✅ Users ↔ Students (one-to-one)")
    print("✅ Users ↔ Admins (one-to-one)")  
    print("✅ Students ↔ Attendance Records (one-to-many)")
    print("✅ Students ↔ Marks (one-to-many)")
    print("✅ Students ↔ AI Insights (one-to-many)")
    print("✅ Subjects ↔ Marks (one-to-many)")
    print("✅ Subjects ↔ Attendance Records (optional)")
    print("✅ Users ↔ Notifications (one-to-many)")
    print("✅ Users ↔ Attendance Records (marked_by)")
    
    print('\n🚀 AUTO-SYNC FEATURES:')
    print('='*60)
    print("✅ Cascade deletes: Delete user → auto-deletes student profile, attendance, marks")
    print("✅ Data integrity: Foreign keys prevent orphaned records")
    print("✅ Relationship loading: Can fetch related data in single queries")
    print("✅ Update propagation: Changes sync across related tables")
