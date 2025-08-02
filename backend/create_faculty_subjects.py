#!/usr/bin/env python3

import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import get_db
from app.models import Faculty, Subject
from sqlalchemy import select

# Subject templates for different types of faculties
SUBJECT_TEMPLATES = {
    "Computer Science": [
        "Programming Fundamentals", "Data Structures", "Algorithms", "Database Systems", "Operating Systems",
        "Software Engineering", "Web Development", "Computer Networks", "Artificial Intelligence", "Machine Learning",
        "Computer Graphics", "Cybersecurity", "Mobile App Development", "Cloud Computing", "DevOps"
    ],
    "Electronics": [
        "Circuit Analysis", "Digital Electronics", "Analog Electronics", "Microprocessors", "Signal Processing",
        "Power Electronics", "Communication Systems", "Control Systems", "VLSI Design", "Embedded Systems",
        "Electronic Instrumentation", "RF Engineering", "Antenna Design", "Optical Communication", "Robotics"
    ],
    "Civil Engineering": [
        "Structural Analysis", "Concrete Technology", "Soil Mechanics", "Fluid Mechanics", "Surveying",
        "Transportation Engineering", "Environmental Engineering", "Construction Management", "Hydraulics", "Geotechnical Engineering",
        "Steel Structures", "Highway Engineering", "Water Resources", "Building Design", "Project Planning"
    ],
    "Management": [
        "Principles of Management", "Marketing Management", "Financial Management", "Human Resource Management", "Operations Management",
        "Strategic Management", "Organizational Behavior", "Business Ethics", "Entrepreneurship", "Project Management",
        "International Business", "Digital Marketing", "Supply Chain Management", "Quality Management", "Leadership"
    ],
    "Default": [
        "Mathematics", "Physics", "Chemistry", "English", "Statistics",
        "Research Methodology", "Technical Writing", "Ethics", "Environmental Studies", "Economics",
        "Psychology", "Sociology", "Philosophy", "History", "General Knowledge"
    ]
}

def get_subject_template(faculty_name):
    """Get appropriate subject template based on faculty name"""
    faculty_lower = faculty_name.lower()
    
    if "computer" in faculty_lower or "it" in faculty_lower or "software" in faculty_lower:
        return SUBJECT_TEMPLATES["Computer Science"]
    elif "electronic" in faculty_lower or "electrical" in faculty_lower:
        return SUBJECT_TEMPLATES["Electronics"]
    elif "civil" in faculty_lower or "construction" in faculty_lower:
        return SUBJECT_TEMPLATES["Civil Engineering"]
    elif "management" in faculty_lower or "business" in faculty_lower or "mba" in faculty_lower:
        return SUBJECT_TEMPLATES["Management"]
    else:
        return SUBJECT_TEMPLATES["Default"]

async def populate_subjects():
    """Populate subjects for all faculties and semesters"""
    
    print("=== Populating Subjects for All Faculties ===")
    print()
    
    total_subjects_created = 0
    
    async for db in get_db():
        try:
            # Get all faculties
            result = await db.execute(select(Faculty))
            faculties = result.scalars().all()
            
            print(f"Found {len(faculties)} faculties:")
            for faculty in faculties:
                print(f"  - {faculty.name} (ID: {faculty.id})")
            print()
            
            # For each faculty
            for faculty in faculties:
                print(f"Processing Faculty: {faculty.name}")
                subjects_template = get_subject_template(faculty.name)
                faculty_subjects_created = 0
                
                # For each semester (1-8)
                for semester in range(1, 9):
                    print(f"  Semester {semester}:")
                    
                    # Create 5 subjects per semester
                    for i in range(5):
                        # Get a subject name from template (cycle through if needed)
                        subject_base_name = subjects_template[i % len(subjects_template)]
                        
                        # Create unique subject name and code
                        subject_name = f"{subject_base_name} {semester}"
                        subject_code = f"{faculty.name[:3].upper()}{semester:02d}{i+1:02d}"
                        
                        # Check if subject already exists
                        existing_check = await db.execute(
                            select(Subject).where(Subject.code == subject_code)
                        )
                        if existing_check.scalar_one_or_none():
                            print(f"    Subject {subject_code} already exists, skipping...")
                            continue
                        
                        # Create subject
                        new_subject = Subject(
                            name=subject_name,
                            code=subject_code,
                            description=f"{subject_base_name} for {faculty.name}, Semester {semester}",
                            credits=3,
                            faculty_id=faculty.id,
                            class_schedule={"semester": semester, "faculty": faculty.name}
                        )
                        
                        db.add(new_subject)
                        faculty_subjects_created += 1
                        total_subjects_created += 1
                        
                        print(f"    ✅ Created: {subject_name} ({subject_code})")
                
                print(f"  Created {faculty_subjects_created} subjects for {faculty.name}")
                print()
            
            # Commit all changes
            await db.commit()
            print(f"✅ Successfully created {total_subjects_created} subjects!")
            print(f"📊 Summary: {len(faculties)} faculties × 8 semesters × 5 subjects = {len(faculties) * 8 * 5} total subjects")
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            await db.rollback()
            raise
        finally:
            break  # Exit the async for loop

if __name__ == "__main__":
    asyncio.run(populate_subjects())
