#!/usr/bin/env python3

import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import get_db
from app.models import Faculty, Subject
from sqlalchemy import select, delete, func, text

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

async def force_clean_all_subjects():
    """Forcefully clean ALL subjects and ensure exactly 5 subjects per semester per faculty"""
    
    print("=== FORCE CLEANING ALL SUBJECTS - Max 5 Per Semester ===")
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
            
            # STEP 1: DELETE ALL EXISTING SUBJECTS
            print("🗑️  STEP 1: Deleting ALL existing subjects...")
            delete_result = await db.execute(delete(Subject))
            await db.commit()
            print(f"   ✅ Deleted ALL existing subjects")
            print()
            
            # STEP 2: CREATE EXACTLY 5 SUBJECTS FOR EACH SEMESTER OF EACH FACULTY
            print("🔨 STEP 2: Creating exactly 5 subjects per semester per faculty...")
            for faculty in faculties:
                print(f"Processing Faculty: {faculty.name}")
                subjects_template = get_subject_template(faculty.name)
                faculty_subjects_created = 0
                
                # For each semester (1-8)
                for semester in range(1, 9):
                    print(f"  Semester {semester}: Creating 5 subjects...")
                    
                    # Create exactly 5 subjects for this semester
                    for i in range(5):
                        # Get subject name from template (cycle through if needed)
                        subject_base_name = subjects_template[i % len(subjects_template)]
                        
                        # Create unique subject name and code
                        subject_name = f"{subject_base_name} S{semester}"
                        subject_code = f"{faculty.name[:3].upper()}{semester:02d}{i+1:02d}"
                        
                        # Handle duplicate codes (shouldn't happen since we deleted everything)
                        counter = 1
                        original_code = subject_code
                        while True:
                            code_check = await db.execute(
                                select(Subject).where(Subject.code == subject_code)
                            )
                            if not code_check.scalar_one_or_none():
                                break
                            subject_code = f"{original_code}_{counter}"
                            counter += 1
                        
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
                        
                        print(f"    ✅ {i+1}/5: {subject_name} ({subject_code})")
                
                print(f"  Faculty Total: {faculty_subjects_created} subjects created")
                print()
            
            # Commit all changes
            await db.commit()
            print(f"✅ Successfully processed all faculties!")
            print(f"📊 Final Summary:")
            print(f"   - Total subjects created: {total_subjects_created}")
            print(f"   - Expected structure: {len(faculties)} faculties × 8 semesters × 5 subjects = {len(faculties) * 8 * 5} total subjects")
            
            # Verify the final count
            final_count_result = await db.execute(select(func.count(Subject.id)))
            final_count = final_count_result.scalar()
            print(f"   - Actual subjects in database: {final_count}")
            
            if final_count == len(faculties) * 8 * 5:
                print("   🎯 PERFECT! Database structure is exactly as expected!")
            else:
                print(f"   ⚠️  Warning: Expected {len(faculties) * 8 * 5} but got {final_count}")
            
            # STEP 3: Verify each faculty has exactly 5 subjects per semester
            print()
            print("🔍 STEP 3: Verifying subject distribution...")
            for faculty in faculties:
                print(f"Faculty: {faculty.name}")
                for semester in range(1, 9):
                    # Count subjects for this faculty and semester
                    count_result = await db.execute(
                        select(func.count(Subject.id)).where(
                            Subject.faculty_id == faculty.id
                        ).where(
                            Subject.class_schedule.op('->>')('semester') == str(semester)
                        )
                    )
                    count = count_result.scalar()
                    
                    if count == 5:
                        status = "✅"
                    else:
                        status = f"❌ ({count})"
                    
                    print(f"  Semester {semester}: {status}")
                print()
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            await db.rollback()
            raise
        finally:
            break  # Exit the async for loop

if __name__ == "__main__":
    asyncio.run(force_clean_all_subjects())
