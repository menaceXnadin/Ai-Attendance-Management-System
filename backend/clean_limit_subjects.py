#!/usr/bin/env python3

import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import get_db
from app.models import Faculty, Subject
from sqlalchemy import select, delete, func

# Subject templates for different types of faculties
SUBJECT_TEMPLATES = {
    "Computer Science": [
        "Programming Fundamentals", "Data Structures", "Web Development", "Database Systems", "Software Engineering"
    ],
    "Electronics": [
        "Circuit Analysis", "Digital Electronics", "Microprocessors", "Signal Processing", "Communication Systems"
    ],
    "Civil Engineering": [
        "Structural Analysis", "Concrete Technology", "Surveying", "Fluid Mechanics", "Construction Management"
    ],
    "Management": [
        "Marketing Management", "Financial Management", "Operations Management", "Human Resource Management", "Strategic Management"
    ],
    "Default": [
        "Mathematics", "Physics", "English", "Statistics", "Research Methodology"
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

async def clean_and_limit_subjects():
    """Clean up subjects and ensure maximum 5 subjects per semester per faculty"""
    
    print("=== Cleaning and Limiting Subjects to 5 Per Semester ===")
    print()
    
    total_subjects_deleted = 0
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
                faculty_subjects_deleted = 0
                faculty_subjects_created = 0
                
                # For each semester (1-8)
                for semester in range(1, 9):
                    print(f"  Semester {semester}:")
                    
                    # Get all existing subjects for this faculty and semester
                    existing_subjects_result = await db.execute(
                        select(Subject).where(
                            Subject.faculty_id == faculty.id
                        ).where(
                            Subject.class_schedule.op('->>')('semester') == str(semester)
                        ).order_by(Subject.created_at)
                    )
                    existing_subjects = existing_subjects_result.scalars().all()
                    
                    print(f"    Found {len(existing_subjects)} existing subjects")
                    
                    # If more than 5 subjects, delete the excess ones
                    if len(existing_subjects) > 5:
                        subjects_to_delete = existing_subjects[5:]  # Keep first 5, delete rest
                        for subject in subjects_to_delete:
                            await db.execute(delete(Subject).where(Subject.id == subject.id))
                            faculty_subjects_deleted += 1
                            total_subjects_deleted += 1
                            print(f"    ❌ Deleted: {subject.name} ({subject.code})")
                        
                        # Update the list to only include remaining subjects
                        existing_subjects = existing_subjects[:5]
                    
                    # If less than 5 subjects, create new ones
                    subjects_needed = 5 - len(existing_subjects)
                    if subjects_needed > 0:
                        print(f"    Creating {subjects_needed} new subjects...")
                        
                        # Get existing subject names to avoid duplicates
                        existing_names = {s.name for s in existing_subjects}
                        
                        for i in range(subjects_needed):
                            # Try to find a subject name that doesn't exist
                            for template_subject in subjects_template:
                                subject_name = f"{template_subject} {semester}"
                                if subject_name not in existing_names:
                                    break
                            else:
                                # If all template subjects exist, create a generic one
                                subject_name = f"Subject {len(existing_subjects) + i + 1} - Semester {semester}"
                            
                            # Create unique subject code
                            base_code = f"{faculty.name[:3].upper()}{semester:02d}{len(existing_subjects) + i + 1:02d}"
                            subject_code = base_code
                            
                            # Ensure code is unique across all faculties
                            counter = 1
                            while True:
                                code_check = await db.execute(
                                    select(Subject).where(Subject.code == subject_code)
                                )
                                if not code_check.scalar_one_or_none():
                                    break
                                subject_code = f"{base_code}_{counter}"
                                counter += 1
                            
                            # Create subject
                            new_subject = Subject(
                                name=subject_name,
                                code=subject_code,
                                description=f"{subject_name} for {faculty.name}",
                                credits=3,
                                faculty_id=faculty.id,
                                class_schedule={"semester": semester, "faculty": faculty.name}
                            )
                            
                            db.add(new_subject)
                            faculty_subjects_created += 1
                            total_subjects_created += 1
                            existing_names.add(subject_name)
                            
                            print(f"    ✅ Created: {subject_name} ({subject_code})")
                    
                    elif subjects_needed == 0:
                        print(f"    ✅ Perfect! Already has exactly 5 subjects")
                
                print(f"  Faculty Summary: Created {faculty_subjects_created}, Deleted {faculty_subjects_deleted}")
                print()
            
            # Commit all changes
            await db.commit()
            print(f"✅ Successfully processed all faculties!")
            print(f"📊 Total Summary:")
            print(f"   - Subjects created: {total_subjects_created}")
            print(f"   - Subjects deleted: {total_subjects_deleted}")
            print(f"   - Final structure: {len(faculties)} faculties × 8 semesters × 5 subjects = {len(faculties) * 8 * 5} total subjects")
            
            # Verify the final count
            final_count_result = await db.execute(select(func.count(Subject.id)))
            final_count = final_count_result.scalar()
            print(f"   - Actual subjects in database: {final_count}")
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            await db.rollback()
            raise
        finally:
            break  # Exit the async for loop

if __name__ == "__main__":
    asyncio.run(clean_and_limit_subjects())
