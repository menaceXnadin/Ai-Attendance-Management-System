#!/usr/bin/env python3

import asyncio
from sqlalchemy import text
from app.core.database import sync_engine, AsyncSessionLocal
from app.models import Faculty, Student

def check_faculty_table():
    """Check if faculty table exists and has data"""
    print("Checking faculty table...")
    
    with sync_engine.connect() as conn:
        # Check if table exists
        result = conn.execute(text("SELECT * FROM faculties"))
        rows = result.fetchall()
        print(f"Faculty count: {len(rows)}")
        
        if rows:
            print("Faculty data:")
            for row in rows:
                print(f"  ID: {row[0]}, Name: {row[1]}, Description: {row[2]}")
        else:
            print("No faculty data found!")
        
        return len(rows) > 0

async def create_default_faculties():
    """Create default faculty entries"""
    print("Creating default faculties...")
    
    default_faculties = [
        {"name": "Computer Science", "description": "Bachelor of Computer Science and Information Technology"},
        {"name": "Business Administration", "description": "Bachelor of Business Administration"},
        {"name": "Civil Engineering", "description": "Bachelor of Civil Engineering"},
        {"name": "Electrical Engineering", "description": "Bachelor of Electrical Engineering"},
        {"name": "Management", "description": "Bachelor of Business Management"},
        {"name": "Arts", "description": "Bachelor of Arts"},
        {"name": "Science", "description": "Bachelor of Science"}
    ]
    
    async with AsyncSessionLocal() as session:
        try:
            for faculty_data in default_faculties:
                # Check if faculty already exists
                existing = await session.execute(
                    text("SELECT id FROM faculties WHERE name = :name"),
                    {"name": faculty_data["name"]}
                )
                if not existing.fetchone():
                    faculty = Faculty(**faculty_data)
                    session.add(faculty)
                    print(f"Added faculty: {faculty_data['name']}")
                else:
                    print(f"Faculty already exists: {faculty_data['name']}")
            
            await session.commit()
            print("Default faculties created successfully!")
            
        except Exception as e:
            await session.rollback()
            print(f"Error creating faculties: {e}")
            raise

async def update_students_faculty():
    """Update students with faculty_id based on their faculty field"""
    print("Updating students with faculty_id...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Get all students without faculty_id
            students_result = await session.execute(
                text("SELECT id, faculty FROM students WHERE faculty_id IS NULL")
            )
            students = students_result.fetchall()
            print(f"Found {len(students)} students without faculty_id")
            
            # Get all faculties
            faculties_result = await session.execute(
                text("SELECT id, name FROM faculties")
            )
            faculties = {row[1].lower(): row[0] for row in faculties_result.fetchall()}
            
            updated_count = 0
            for student_id, faculty_name in students:
                if faculty_name:
                    faculty_key = faculty_name.lower().strip()
                    
                    # Try exact match first
                    faculty_id = faculties.get(faculty_key)
                    
                    # Try partial match
                    if not faculty_id:
                        for f_name, f_id in faculties.items():
                            if faculty_key in f_name or f_name in faculty_key:
                                faculty_id = f_id
                                break
                    
                    # Default to Computer Science if no match
                    if not faculty_id:
                        faculty_id = faculties.get('computer science', 1)
                    
                    if faculty_id:
                        await session.execute(
                            text("UPDATE students SET faculty_id = :faculty_id WHERE id = :student_id"),
                            {"faculty_id": faculty_id, "student_id": student_id}
                        )
                        updated_count += 1
            
            await session.commit()
            print(f"Updated {updated_count} students with faculty_id")
            
        except Exception as e:
            await session.rollback()
            print(f"Error updating students: {e}")
            raise

async def main():
    print("=== Faculty Table Check and Setup ===")
    
    # Check if faculty table has data
    has_data = check_faculty_table()
    
    if not has_data:
        # Create default faculties
        await create_default_faculties()
        
        # Check again
        check_faculty_table()
    
    # Update students with faculty_id
    await update_students_faculty()
    
    print("=== Setup Complete ===")

if __name__ == "__main__":
    asyncio.run(main())
