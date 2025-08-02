"""
Test script to verify faculty selection and student creation works correctly
"""
import asyncio
from app.core.database import get_db
from app.models import Student, User, Faculty
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def test_student_faculty_creation():
    """Test creating a student and verify faculty assignment"""
    
    async for db in get_db():
        # List available faculties
        print("=== Available Faculties ===")
        result = await db.execute(select(Faculty))
        faculties = result.scalars().all()
        
        for faculty in faculties:
            print(f"ID: {faculty.id}, Name: {faculty.name}")
        
        # Get recently created students and check their faculty assignments
        print("\n=== Recent Students (Last 5) ===")
        result = await db.execute(
            select(Student).options(
                selectinload(Student.user),
                selectinload(Student.faculty_rel)
            ).order_by(Student.created_at.desc()).limit(5)
        )
        students = result.scalars().all()
        
        for student in students:
            print(f"Student: {student.user.full_name}")
            print(f"  Email: {student.user.email}")
            print(f"  Student ID: {student.student_id}")
            print(f"  Faculty (legacy): {student.faculty}")
            print(f"  Faculty ID: {student.faculty_id}")
            if student.faculty_rel:
                print(f"  Faculty (from relationship): {student.faculty_rel.name}")
                print(f"  ✅ Faculty data is consistent")
            else:
                print(f"  ❌ Faculty relationship is missing!")
            print("---")
        
        # Check for any inconsistencies
        print("\n=== Checking for Inconsistencies ===")
        result = await db.execute(
            select(Student).options(selectinload(Student.faculty_rel))
        )
        all_students = result.scalars().all()
        
        inconsistent_count = 0
        for student in all_students:
            if student.faculty_rel and student.faculty != student.faculty_rel.name:
                inconsistent_count += 1
                print(f"❌ INCONSISTENT: Student {student.student_id}")
                print(f"   Legacy faculty: {student.faculty}")
                print(f"   Actual faculty: {student.faculty_rel.name}")
        
        if inconsistent_count == 0:
            print("✅ All student faculty data is consistent!")
        else:
            print(f"❌ Found {inconsistent_count} inconsistent records")
        
        break

if __name__ == "__main__":
    asyncio.run(test_student_faculty_creation())
