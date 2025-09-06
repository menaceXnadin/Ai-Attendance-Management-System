#!/usr/bin/env python3

"""
Check database schema
"""

import psycopg2
from psycopg2.extras import RealDictCursor

def check_schema():
    conn = psycopg2.connect(host='localhost', database='attendancedb', user='postgres', password='nadin123')
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print("📋 SUBJECTS TABLE SCHEMA:")
            cur.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'subjects' 
                ORDER BY ordinal_position
            """)
            
            for row in cur.fetchall():
                print(f"  {row['column_name']}: {row['data_type']}")
            
            print("\n📋 CLASS_SCHEDULES TABLE SCHEMA:")
            cur.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'class_schedules' 
                ORDER BY ordinal_position
            """)
            
            for row in cur.fetchall():
                print(f"  {row['column_name']}: {row['data_type']}")
            
            print("\n📋 STUDENTS TABLE SCHEMA:")
            cur.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'students' 
                ORDER BY ordinal_position
            """)
            
            for row in cur.fetchall():
                print(f"  {row['column_name']}: {row['data_type']}")
    
    finally:
        conn.close()

if __name__ == "__main__":
    check_schema()
