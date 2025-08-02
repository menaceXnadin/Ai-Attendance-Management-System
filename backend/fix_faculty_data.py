"""
Fix inconsistent faculty data in student records
"""
import asyncio
from app.core.database import get_db
from app.models import Student
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def fix_faculty_inconsistencies():
    """Fix students where legacy faculty field doesn't match faculty_rel.name"""
    
    async for db in get_db():
        print("=== Fixing Faculty Inconsistencies ===")
        
        # Get all students with faculty relationships
        result = await db.execute(
            select(Student).options(selectinload(Student.faculty_rel))
        )
        students = result.scalars().all()
        
        fixed_count = 0
        for student in students:
            if student.faculty_rel and student.faculty != student.faculty_rel.name:
                print(f"Fixing Student {student.student_id}:")
                print(f"  Old faculty: {student.faculty}")
                print(f"  New faculty: {student.faculty_rel.name}")
                
                # Update the legacy faculty field to match the relationship
                student.faculty = student.faculty_rel.name
                fixed_count += 1
        
        if fixed_count > 0:
            await db.commit()
            print(f"\n✅ Fixed {fixed_count} inconsistent records")
        else:
            print("✅ No inconsistencies found")
        
        break

if __name__ == "__main__":
    asyncio.run(fix_faculty_inconsistencies())
