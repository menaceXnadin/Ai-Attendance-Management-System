#!/usr/bin/env python3
"""
Script to populate default faculties in the database
"""
import asyncio
import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models import Faculty

async def create_default_faculties():
    """Create default faculties"""
    default_faculties = [
        {"name": "Computer Science", "description": "Department of Computer Science and Technology"},
        {"name": "Information Technology", "description": "Department of Information Technology"},
        {"name": "Electronics Engineering", "description": "Department of Electronics and Communication"},
        {"name": "Civil Engineering", "description": "Department of Civil Engineering"},
        {"name": "Mechanical Engineering", "description": "Department of Mechanical Engineering"},
        {"name": "Business Administration", "description": "Department of Business Administration"},
        {"name": "Mathematics", "description": "Department of Mathematics"},
        {"name": "Physics", "description": "Department of Physics"},
    ]
    
    async with AsyncSessionLocal() as session:
        try:
            for faculty_data in default_faculties:
                # Check if faculty already exists
                from sqlalchemy import select
                result = await session.execute(
                    select(Faculty).where(Faculty.name == faculty_data["name"])
                )
                existing = result.scalar_one_or_none()
                
                if not existing:
                    faculty = Faculty(**faculty_data)
                    session.add(faculty)
                    print(f"Added faculty: {faculty_data['name']}")
                else:
                    print(f"Faculty already exists: {faculty_data['name']}")
            
            await session.commit()
            print("Default faculties created successfully!")
            
        except Exception as e:
            print(f"Error creating faculties: {e}")
            await session.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(create_default_faculties())
