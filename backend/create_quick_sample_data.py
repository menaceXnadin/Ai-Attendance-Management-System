led to #!/usr/bin/env python3
"""
Quick Sample Data Creator for Testing Admin Workflow
Creates minimal but complete data needed for admin attendance workflow testing
"""
import asyncio
import sys
import os
from datetime import datetime, timedelta
import random

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.database import AsyncSessionLocal, async_engine, Base
from app.models import (
    Faculty, Subject, Student, User, Admin, AttendanceRecord,
    UserRole, AttendanceStatus, AttendanceMethod
)
from app.core.security import get_password_hash

async def main():
    """Create minimal sample data for admin workflow testing"""
    print("🚀 Creating Sample Data for Admin Workflow Testing")
    print("=" * 60)

    async with AsyncSessionLocal() as session:
        try:
            # 1. Ensure admin user exists
            print("\n👨‍💼 Checking admin user...")
            result = await session.execute(select(User).where(User.email == "admin@attendance.com"))
            admin_user = result.scalar_one_or_none()
            
            if not admin_user:
                print("   Creating admin user...")
                admin_user = User(
                    email="admin@attendance.com",
                    full_name="System Administrator",
                    hashed_password=get_password_hash("admin123"),
                    role=UserRole.admin,
                    is_active=True,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                session.add(admin_user)
                await session.commit()
                await session.refresh(admin_user)
                
                # Create admin profile
                admin_profile = Admin(
                    user_id=admin_user.id,
                    admin_id="ADM001",
                    department="IT Administration",
                    permissions={"manage_all": True},
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                session.add(admin_profile)
                await session.commit()
                print(f"   ✅ Created admin: {admin_user.email}")
            else:
                print(f"   ✅ Admin exists: {admin_user.email}")

            # 2. Get existing faculties or create basic ones
            print("\n🏫 Checking faculties...")
            result = await session.execute(select(Faculty))
            faculties = result.scalars().all()
            
            if not faculties:
                print("   Creating faculties...")
                sample_faculties = [
                    {"name": "Computer Science", "description": "Computer Science Department"},
                    {"name": "Engineering", "description": "Engineering Department"},
                    {"name": "Business", "description": "Business Department"}
                ]
                
                for faculty_data in sample_faculties:
                    faculty = Faculty(**faculty_data, created_at=datetime.now())
                    session.add(faculty)
                
                await session.commit()
                result = await session.execute(select(Faculty))
                faculties = result.scalars().all()
                print(f"   ✅ Created {len(faculties)} faculties")
            else:
                print(f"   ✅ Found {len(faculties)} existing faculties")

            # 3. Get existing subjects or create basic ones
            print("\n📚 Checking subjects...")
            result = await session.execute(select(Subject))
            subjects = result.scalars().all()
            
            if len(subjects) < 5:
                print("   Creating subjects...")
                for faculty in faculties:
                    for i in range(2):  # 2 subjects per faculty
                        subject = Subject(
                            name=f"{faculty.name} Subject {i+1}",
                            code=f"{faculty.name[:3].upper()}{100+i}",
                            description=f"Sample subject for {faculty.name}",
                            credits=3,
                            faculty_id=faculty.id,
                            class_schedule={"semester": i+1, "days": ["Monday", "Wednesday"]},
                            created_at=datetime.now(),
                            updated_at=datetime.now()
                        )
                        session.add(subject)
                
                await session.commit()
                result = await session.execute(select(Subject))
                subjects = result.scalars().all()
                print(f"   ✅ Created {len(subjects)} subjects")
            else:
                print(f"   ✅ Found {len(subjects)} existing subjects")

            # 4. Create some students if needed
            print("\n👥 Checking students...")
            result = await session.execute(select(Student))
            students = result.scalars().all()
            
            target_students = 15  # Minimum students for testing
            if len(students) < target_students:
                print(f"   Creating {target_students - len(students)} students...")
                
                # Get the highest existing student number to avoid duplicates
                result = await session.execute(text("SELECT MAX(CAST(SUBSTRING(student_id FROM '[0-9]+') AS INTEGER)) FROM students WHERE student_id ~ '^[A-Z]{3}[0-9]+'"))
                max_num = result.scalar() or 1000
                
                for i, faculty in enumerate(faculties):
                    students_per_faculty = 5
                    for j in range(students_per_faculty):
                        student_num = max_num + (i * students_per_faculty) + j + 1
                        
                        # Create user
                        user = User(
                            email=f"student{student_num}@test.edu",
                            full_name=f"Test Student {student_num}",
                            hashed_password=get_password_hash("student123"),
                            role=UserRole.student,
                            is_active=True,
                            created_at=datetime.now(),
                            updated_at=datetime.now()
                        )
                        session.add(user)
                        await session.commit()
                        await session.refresh(user)
                        
                        # Create student
                        student = Student(
                            user_id=user.id,
                            student_id=f"{faculty.name[:3].upper()}{student_num}",
                            faculty=faculty.name,
                            faculty_id=faculty.id,
                            semester=random.randint(1, 6),
                            year=random.randint(1, 3),
                            batch=random.randint(2022, 2025),
                            phone_number=f"+977-98{random.randint(10000000, 99999999)}",
                            created_at=datetime.now(),
                            updated_at=datetime.now()
                        )
                        session.add(student)
                        await session.commit()
                        print(f"   ✅ Created: {student.student_id} - {user.full_name}")
                
                result = await session.execute(select(Student))
                students = result.scalars().all()
            else:
                print(f"   ✅ Found {len(students)} existing students")

            # 5. Create some sample attendance records
            print("\n📊 Creating sample attendance...")
            
            # Get subjects and students for attendance
            result = await session.execute(select(Subject).limit(3))
            sample_subjects = result.scalars().all()
            
            result = await session.execute(select(Student).limit(10))
            sample_students = result.scalars().all()
            
            if sample_subjects and sample_students:
                attendance_count = 0
                # Create attendance for last 7 days
                for days_ago in range(7):
                    date = datetime.now() - timedelta(days=days_ago)
                    
                    for subject in sample_subjects:
                        for student in sample_students:
                            # 80% chance of having attendance record
                            if random.random() < 0.8:
                                status_choices = [AttendanceStatus.present, AttendanceStatus.absent, AttendanceStatus.late]
                                status_weights = [80, 15, 5]
                                status_value = random.choices(status_choices, weights=status_weights)[0]
                                
                                attendance = AttendanceRecord(
                                    student_id=student.id,
                                    subject_id=subject.id,
                                    date=date,
                                    status=status_value,  # Use enum directly
                                    method=AttendanceMethod.manual,  # Use enum directly
                                    marked_by=admin_user.id,
                                    created_at=datetime.now()
                                )
                                session.add(attendance)
                                attendance_count += 1
                
                await session.commit()
                print(f"   ✅ Created {attendance_count} attendance records")

            print("\n" + "=" * 60)
            print("🎉 SAMPLE DATA CREATION COMPLETED!")
            print("=" * 60)
            print(f"📊 Summary:")
            print(f"   👨‍💼 Admin Users: 1")
            print(f"   🏫 Faculties: {len(faculties)}")
            print(f"   📚 Subjects: {len(subjects)}")
            print(f"   👥 Students: {len(students)}")
            print("\n🔑 Login Credentials:")
            print("   Admin: admin@attendance.com / admin123")
            print("   Students: student[number]@test.edu / student123")
            print("\n✅ Ready to test admin workflow!")

        except Exception as e:
            print(f"\n❌ Error: {str(e)}")
            await session.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(main())
