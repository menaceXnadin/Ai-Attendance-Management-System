"""
Populate the database with dummy data for documentation screenshots.
Creates sample faculty, students, and admin users.
"""
import asyncio
import sys
import os
from datetime import datetime

import random
from sqlalchemy import select

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models import User, Admin, UserRole, Faculty, Student
from app.core.security import get_password_hash

FACULTIES = [
    {"name": "Computer Science", "description": "Department of Computer Science"},
    {"name": "Electronics", "description": "Department of Electronics"},
    {"name": "Civil Engineering", "description": "Department of Civil Engineering"},
    {"name": "Business Administration", "description": "Department of Business Administration"},
]

ADMIN_USERS = [
    {"full_name": "Alice Johnson", "email": "alice.admin@example.com", "password": "admin@alice", "admin_id": "ADM100", "department": "Computer Science"},
    {"full_name": "Bob Smith", "email": "bob.admin@example.com", "password": "admin@bob", "admin_id": "ADM101", "department": "Electronics"},
    {"full_name": "Carol Lee", "email": "carol.admin@example.com", "password": "admin@carol", "admin_id": "ADM102", "department": "Civil Engineering"},
]

STUDENT_NAMES = [
    "John Doe", "Jane Roe", "Mike Brown", "Lisa White", "Tom Black", "Sara Green", "Chris Blue", "Nina Red"
]

async def create_faculties(session: AsyncSession):
    print("Creating faculties...")
    faculties = []
    for fac in FACULTIES:
        # Check if faculty already exists
        result = await session.execute(
            select(Faculty).where(Faculty.name == fac["name"])
        )
        existing = result.scalar_one_or_none()
        if existing:
            print(f"  ⚠️ Faculty already exists: {fac['name']}")
            faculties.append(existing)
            continue
        faculty = Faculty(name=fac["name"], description=fac["description"])
        session.add(faculty)
        await session.commit()
        await session.refresh(faculty)
        faculties.append(faculty)
    return faculties

async def create_admins(session: AsyncSession):
    print("Creating admin users...")
    admins = []
    for admin_data in ADMIN_USERS:
        user = User(
            email=admin_data["email"],
            full_name=admin_data["full_name"],
            hashed_password=get_password_hash(admin_data["password"]),
            role=UserRole.admin,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        admin = Admin(
            user_id=user.id,
            admin_id=admin_data["admin_id"],
            name=admin_data["full_name"],
            department=admin_data["department"],
            permissions=[
                "manage_students", "manage_faculty", "manage_subjects", "view_reports", "manage_attendance", "manage_users", "system_settings"
            ],
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(admin)
        await session.commit()
        await session.refresh(admin)
        admins.append(admin)
    return admins

async def create_students(session: AsyncSession, faculties):
    print("Creating students...")
    students = []
    for i, name in enumerate(STUDENT_NAMES):
        email = f"student{i+1}@example.com"
        password = "student@123"
        faculty = random.choice(faculties)
        user = User(
            email=email,
            full_name=name,
            hashed_password=get_password_hash(password),
            role=UserRole.student,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        student = Student(
            user_id=user.id,
            student_id=f"STU{1000+i}",
            faculty=faculty.name,
            faculty_id=faculty.id,
            semester=random.randint(1, 8),
            year=random.randint(1, 4),
            batch=2022 + (i % 3),
            phone_number=f"98000000{i+1}",
            emergency_contact=f"98000001{i+1}",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(student)
        await session.commit()
        await session.refresh(student)
        students.append(student)
    return students

async def main():
    async with AsyncSessionLocal() as session:
        faculties = await create_faculties(session)
        await create_admins(session)
        await create_students(session, faculties)
        print("\n✅ Dummy data population complete! You can now take screenshots for documentation.")

if __name__ == "__main__":
    asyncio.run(main())
