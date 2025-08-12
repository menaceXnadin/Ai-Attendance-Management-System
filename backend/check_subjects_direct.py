#!/usr/bin/env python3

import psycopg2
import sys
from psycopg2 import sql

def check_subjects():
    """Check subjects in the database directly using psycopg2"""
    
    print("=== Checking Subjects in Database ===")
    
    try:
        # Connect to the database
        conn = psycopg2.connect(
            dbname="attendancedb",
            user="postgres",
            password="nadin123",
            host="localhost",
            port="5432"
        )
        
        # Create a cursor
        cur = conn.cursor()
        
        # Check if subjects table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'subjects'
            )
        """)
        table_exists = cur.fetchone()[0]
        
        if not table_exists:
            print("❌ Error: 'subjects' table does not exist!")
            return
        
        # Count subjects
        cur.execute("SELECT COUNT(*) FROM subjects")
        count = cur.fetchone()[0]
        print(f"📊 Total subjects in database: {count}")
        
        # Check for subject with ID=1
        cur.execute("SELECT * FROM subjects WHERE id = 1")
        subject_1 = cur.fetchone()
        
        if subject_1:
            print(f"✅ Subject with ID=1 exists: {subject_1}")
        else:
            print("❌ Subject with ID=1 does NOT exist!")
            
        # List a few subjects for reference
        print("\nSample subjects in database:")
        cur.execute("SELECT id, name, code, faculty_id FROM subjects ORDER BY id LIMIT 5")
        subjects = cur.fetchall()
        
        if subjects:
            for subject in subjects:
                print(f"  - ID {subject[0]}: {subject[1]} ({subject[2]}) - Faculty ID: {subject[3]}")
        else:
            print("  No subjects found!")
            
        # Close cursor and connection
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        
if __name__ == "__main__":
    check_subjects()
