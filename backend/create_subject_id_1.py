#!/usr/bin/env python3

import psycopg2
import sys
from psycopg2 import sql

def create_subject_with_id_1():
    """Create a subject with ID=1 in the database"""
    
    print("=== Creating Subject with ID=1 ===")
    
    try:
        # Connect to the database
        conn = psycopg2.connect(
            dbname="attendancedb",
            user="postgres",
            password="nadin123",
            host="localhost",
            port="5432"
        )
        
        # Set autocommit mode
        conn.autocommit = True
        
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
        
        # Check for subject with ID=1
        cur.execute("SELECT id FROM subjects WHERE id = 1")
        subject_1 = cur.fetchone()
        
        if subject_1:
            print("✅ Subject with ID=1 already exists!")
            return
            
        # Get a faculty ID to use
        cur.execute("SELECT id FROM faculties LIMIT 1")
        faculty_result = cur.fetchone()
        faculty_id = faculty_result[0] if faculty_result else None
        
        if not faculty_id:
            print("❌ Warning: No faculty found in database. Creating subject without faculty_id.")
        
        # Ensure the sequence is updated if needed
        cur.execute("SELECT setval('subjects_id_seq', 1, false)")
        
        # Create the subject with ID=1
        cur.execute("""
            INSERT INTO subjects (id, name, code, description, credits, faculty_id, class_schedule) 
            VALUES (1, 'Default Subject', 'DEF101', 'Default subject for face recognition', 3, %s, '{"semester": 1, "faculty": "Default"}')
        """, (faculty_id,))
        
        print("✅ Successfully created subject with ID=1!")
        
        # Verify the subject was created
        cur.execute("SELECT * FROM subjects WHERE id = 1")
        new_subject = cur.fetchone()
        print(f"New subject details: {new_subject}")
        
        # Close cursor and connection
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        
if __name__ == "__main__":
    create_subject_with_id_1()
