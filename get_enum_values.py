#!/usr/bin/env python3

import psycopg2
import psycopg2.extras
from collections import defaultdict

def get_enum_values():
    """Get enum values for user roles and day of week"""
    
    try:
        # Connect to the PostgreSQL database
        conn = psycopg2.connect(
            host="localhost",
            database="attendancedb",
            user="postgres",
            password="nadin123"
        )
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        print("=== USER ROLE ENUM VALUES ===")
        cursor.execute("""
            SELECT enumlabel 
            FROM pg_enum 
            WHERE enumtypid = (
                SELECT oid 
                FROM pg_type 
                WHERE typname = (
                    SELECT udt_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' 
                    AND column_name = 'role'
                )
            )
            ORDER BY enumsortorder;
        """)
        role_enum_values = cursor.fetchall()
        
        print("Available user roles:")
        for role in role_enum_values:
            print(f"  - {role['enumlabel']}")
        
        # Get actual users with different roles
        print("\n=== USERS BY ROLE ===")
        cursor.execute("SELECT role, COUNT(*) as count FROM users GROUP BY role")
        user_counts = cursor.fetchall()
        
        for count in user_counts:
            print(f"  {count['role']}: {count['count']} users")
        
        # Get sample users
        cursor.execute("SELECT id, email, full_name, role FROM users LIMIT 10")
        sample_users = cursor.fetchall()
        print(f"\nSample users:")
        for user in sample_users:
            print(f"  {dict(user)}")
        
        # Check day_of_week enum values
        print("\n=== DAY_OF_WEEK ENUM VALUES ===")
        cursor.execute("""
            SELECT enumlabel 
            FROM pg_enum 
            WHERE enumtypid = (
                SELECT oid 
                FROM pg_type 
                WHERE typname = (
                    SELECT udt_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'class_schedules' 
                    AND column_name = 'day_of_week'
                )
            )
            ORDER BY enumsortorder;
        """)
        day_enum_values = cursor.fetchall()
        
        print("Available day_of_week values:")
        for day in day_enum_values:
            print(f"  - {day['enumlabel']}")
        
        # Now analyze subjects properly
        print("\n=== SUBJECTS ANALYSIS ===")
        cursor.execute("""
            SELECT 
                f.id as faculty_id,
                f.name as faculty_name,
                COUNT(s.id) as total_subjects
            FROM faculties f
            LEFT JOIN subjects s ON f.id = s.faculty_id
            GROUP BY f.id, f.name
            ORDER BY f.id;
        """)
        faculty_subjects = cursor.fetchall()
        
        for fs in faculty_subjects:
            print(f"Faculty {fs['faculty_id']}: {fs['faculty_name']} - {fs['total_subjects']} subjects")
        
        # Check subjects with semester information
        cursor.execute("""
            SELECT 
                s.faculty_id,
                f.name as faculty_name,
                s.class_schedule->>'semester' as semester,
                COUNT(*) as subject_count
            FROM subjects s
            LEFT JOIN faculties f ON s.faculty_id = f.id
            WHERE s.class_schedule->>'semester' IS NOT NULL
            GROUP BY s.faculty_id, f.name, s.class_schedule->>'semester'
            ORDER BY s.faculty_id, (s.class_schedule->>'semester')::int;
        """)
        semester_counts = cursor.fetchall()
        
        print(f"\n=== SUBJECTS WITH SEMESTER INFO ===")
        for sc in semester_counts:
            print(f"  Faculty {sc['faculty_id']} ({sc['faculty_name']}) - Semester {sc['semester']}: {sc['subject_count']} subjects")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error getting enum values: {e}")

if __name__ == "__main__":
    get_enum_values()