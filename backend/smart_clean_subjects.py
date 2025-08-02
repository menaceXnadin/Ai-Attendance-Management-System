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

async def smart_clean_subjects():
    """Smart clean: Reorganize subjects to exactly 5 per semester without breaking constraints"""
    
    print("=== SMART CLEANING: Reorganizing to Max 5 Per Semester ===")
    print()
    
    total_subjects_deleted = 0
    total_subjects_created = 0
    total_subjects_updated = 0
    
    async for db in get_db():
        try:
            # Get all faculties
            result = await db.execute(select(Faculty))
            faculties = result.scalars().all()
            
            print(f"Found {len(faculties)} faculties")
            print()
            
            # STEP 1: Analyze current subject distribution
            print("🔍 STEP 1: Analyzing current subject distribution...")
            for faculty in faculties:
                print(f"Faculty: {faculty.name} (ID: {faculty.id})")
                
                # Get ALL subjects for this faculty
                all_subjects_result = await db.execute(
                    select(Subject).where(Subject.faculty_id == faculty.id).order_by(Subject.created_at)
                )
                all_subjects = all_subjects_result.scalars().all()
                
                print(f"  Total subjects: {len(all_subjects)}")
                
                # Count subjects per semester
                semester_counts = {}
                unassigned_subjects = []
                
                for subject in all_subjects:
                    # Try to extract semester from various sources
                    semester = None
                    
                    # Check class_schedule JSON
                    if subject.class_schedule and isinstance(subject.class_schedule, dict):
                        semester = subject.class_schedule.get('semester')
                    
                    # Check subject code pattern (like COM0101 = semester 1)
                    if not semester and subject.code:
                        import re
                        match = re.search(r'(\d{2})(\d{2})$', subject.code)
                        if match:
                            semester = int(match.group(1))
                    
                    # Check subject name for semester clues
                    if not semester and subject.name:
                        import re
                        match = re.search(r'[Ss](\d+)', subject.name)
                        if match:
                            semester = int(match.group(1))
                    
                    if semester and 1 <= semester <= 8:
                        if semester not in semester_counts:
                            semester_counts[semester] = []
                        semester_counts[semester].append(subject)
                    else:
                        unassigned_subjects.append(subject)
                
                # Show distribution
                for sem in range(1, 9):
                    count = len(semester_counts.get(sem, []))
                    status = "✅" if count <= 5 else f"❌ ({count})"
                    print(f"    Semester {sem}: {count} subjects {status}")
                
                if unassigned_subjects:
                    print(f"    Unassigned: {len(unassigned_subjects)} subjects")
                
                print()
            
            # STEP 2: Fix each faculty
            print("🔨 STEP 2: Fixing subject distribution...")
            
            for faculty in faculties:
                print(f"Processing Faculty: {faculty.name}")
                subjects_template = get_subject_template(faculty.name)
                
                # Get all subjects for this faculty again
                all_subjects_result = await db.execute(
                    select(Subject).where(Subject.faculty_id == faculty.id).order_by(Subject.created_at)
                )
                all_subjects = all_subjects_result.scalars().all()
                
                # Organize subjects by semester
                semester_subjects = {}
                unassigned_subjects = []
                
                for subject in all_subjects:
                    semester = None
                    
                    # Extract semester (same logic as above)
                    if subject.class_schedule and isinstance(subject.class_schedule, dict):
                        semester = subject.class_schedule.get('semester')
                    
                    if not semester and subject.code:
                        import re
                        match = re.search(r'(\d{2})(\d{2})$', subject.code)
                        if match:
                            semester = int(match.group(1))
                    
                    if not semester and subject.name:
                        import re
                        match = re.search(r'[Ss](\d+)', subject.name)
                        if match:
                            semester = int(match.group(1))
                    
                    if semester and 1 <= semester <= 8:
                        if semester not in semester_subjects:
                            semester_subjects[semester] = []
                        semester_subjects[semester].append(subject)
                    else:
                        unassigned_subjects.append(subject)
                
                # Process each semester
                for semester in range(1, 9):
                    current_subjects = semester_subjects.get(semester, [])
                    print(f"  Semester {semester}: {len(current_subjects)} subjects")
                    
                    # If more than 5 subjects, delete excess (keep first 5)
                    if len(current_subjects) > 5:
                        subjects_to_keep = current_subjects[:5]
                        subjects_to_delete = current_subjects[5:]
                        
                        for subject in subjects_to_delete:
                            # Check if subject has attendance records
                            attendance_check = await db.execute(
                                text("SELECT COUNT(*) FROM attendance_records WHERE subject_id = :subject_id"),
                                {"subject_id": subject.id}
                            )
                            attendance_count = attendance_check.scalar()
                            
                            if attendance_count > 0:
                                print(f"    ⚠️  Keeping {subject.name} (has {attendance_count} attendance records)")
                            else:
                                await db.execute(delete(Subject).where(Subject.id == subject.id))
                                total_subjects_deleted += 1
                                print(f"    ❌ Deleted: {subject.name}")
                        
                        # Update current_subjects to only include kept subjects
                        current_subjects = subjects_to_keep
                        semester_subjects[semester] = current_subjects
                    
                    # Update remaining subjects to have correct semester info
                    for subject in current_subjects:
                        old_schedule = subject.class_schedule or {}
                        new_schedule = {**old_schedule, "semester": semester, "faculty": faculty.name}
                        subject.class_schedule = new_schedule
                        total_subjects_updated += 1
                    
                    # If less than 5 subjects, create new ones
                    subjects_needed = 5 - len(current_subjects)
                    if subjects_needed > 0:
                        print(f"    Creating {subjects_needed} new subjects for semester {semester}...")
                        
                        for i in range(subjects_needed):
                            # Get subject name from template
                            subject_base_name = subjects_template[i % len(subjects_template)]
                            subject_name = f"{subject_base_name} S{semester}"
                            
                            # Create unique code
                            subject_code = f"{faculty.name[:3].upper()}{semester:02d}{len(current_subjects) + i + 1:02d}"
                            
                            # Ensure code is unique
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
                            total_subjects_created += 1
                            print(f"    ✅ Created: {subject_name} ({subject_code})")
                
                # Handle unassigned subjects
                if unassigned_subjects:
                    print(f"  Processing {len(unassigned_subjects)} unassigned subjects...")
                    for subject in unassigned_subjects:
                        # Try to assign to a semester that needs subjects
                        assigned = False
                        for semester in range(1, 9):
                            current_count = len(semester_subjects.get(semester, []))
                            if current_count < 5:
                                # Assign this subject to this semester
                                subject.class_schedule = {"semester": semester, "faculty": faculty.name}
                                if semester not in semester_subjects:
                                    semester_subjects[semester] = []
                                semester_subjects[semester].append(subject)
                                total_subjects_updated += 1
                                assigned = True
                                print(f"    📍 Assigned {subject.name} to semester {semester}")
                                break
                        
                        if not assigned:
                            # Delete if can't assign anywhere
                            attendance_check = await db.execute(
                                text("SELECT COUNT(*) FROM attendance_records WHERE subject_id = :subject_id"),
                                {"subject_id": subject.id}
                            )
                            attendance_count = attendance_check.scalar()
                            
                            if attendance_count > 0:
                                # Force assign to semester 8 if has attendance records
                                subject.class_schedule = {"semester": 8, "faculty": faculty.name}
                                total_subjects_updated += 1
                                print(f"    🚨 Force assigned {subject.name} to semester 8 (has attendance records)")
                            else:
                                await db.execute(delete(Subject).where(Subject.id == subject.id))
                                total_subjects_deleted += 1
                                print(f"    ❌ Deleted unassigned: {subject.name}")
                
                print(f"  Faculty {faculty.name} processed")
                print()
            
            # Commit all changes
            await db.commit()
            print(f"✅ Successfully processed all faculties!")
            print(f"📊 Final Summary:")
            print(f"   - Subjects created: {total_subjects_created}")
            print(f"   - Subjects updated: {total_subjects_updated}")
            print(f"   - Subjects deleted: {total_subjects_deleted}")
            
            # Verify the final count and distribution
            final_count_result = await db.execute(select(func.count(Subject.id)))
            final_count = final_count_result.scalar()
            print(f"   - Total subjects in database: {final_count}")
            
            # Final verification
            print()
            print("🔍 FINAL VERIFICATION:")
            for faculty in faculties:
                print(f"Faculty: {faculty.name}")
                for semester in range(1, 9):
                    count_result = await db.execute(
                        select(func.count(Subject.id)).where(
                            Subject.faculty_id == faculty.id
                        ).where(
                            Subject.class_schedule.op('->>')('semester') == str(semester)
                        )
                    )
                    count = count_result.scalar()
                    status = "✅" if count <= 5 else f"❌ ({count})"
                    print(f"  Semester {semester}: {count} subjects {status}")
                print()
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            await db.rollback()
            raise
        finally:
            break  # Exit the async for loop

if __name__ == "__main__":
    asyncio.run(smart_clean_subjects())
