import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models import Faculty, Subject, Student, User
from app.schemas import UserCreate, StudentCreate, UserRole
from app.core.security import get_password_hash
from datetime import datetime

async def create_sample_data():
    """Create sample faculties, subjects, and students for testing."""
    async with AsyncSessionLocal() as db:
        print("🏫 Creating sample faculties...")
        
        # Create sample faculties
        faculties_data = [
            {"name": "Computer Science & Engineering", "description": "Department of Computer Science and Engineering"},
            {"name": "Electronics & Communication", "description": "Department of Electronics and Communication Engineering"},
            {"name": "Mechanical Engineering", "description": "Department of Mechanical Engineering"},
            {"name": "Civil Engineering", "description": "Department of Civil Engineering"},
            {"name": "Business Administration", "description": "School of Business Administration"},
        ]
        
        created_faculties = []
        for faculty_data in faculties_data:
            # Check if faculty already exists
            result = await db.execute(select(Faculty).where(Faculty.name == faculty_data["name"]))
            existing_faculty = result.scalar_one_or_none()
            
            if not existing_faculty:
                faculty = Faculty(**faculty_data)
                db.add(faculty)
                await db.commit()
                await db.refresh(faculty)
                created_faculties.append(faculty)
                print(f"   ✅ Created faculty: {faculty.name}")
            else:
                created_faculties.append(existing_faculty)
                print(f"   ⚠️  Faculty already exists: {existing_faculty.name}")
        
        print(f"\n📚 Creating sample subjects...")
        
        # Create sample subjects for each faculty
        subjects_data = [
            # Computer Science & Engineering
            {"name": "Data Structures & Algorithms", "code": "CSE301", "description": "Fundamental data structures and algorithms", "credits": 4, "faculty_id": created_faculties[0].id},
            {"name": "Database Management Systems", "code": "CSE302", "description": "Design and implementation of database systems", "credits": 3, "faculty_id": created_faculties[0].id},
            {"name": "Computer Networks", "code": "CSE401", "description": "Networking protocols and architectures", "credits": 3, "faculty_id": created_faculties[0].id},
            {"name": "Software Engineering", "code": "CSE402", "description": "Software development methodologies", "credits": 3, "faculty_id": created_faculties[0].id},
            
            # Electronics & Communication
            {"name": "Digital Signal Processing", "code": "ECE301", "description": "Processing of digital signals", "credits": 4, "faculty_id": created_faculties[1].id},
            {"name": "Communication Systems", "code": "ECE302", "description": "Modern communication techniques", "credits": 3, "faculty_id": created_faculties[1].id},
            {"name": "VLSI Design", "code": "ECE401", "description": "Very Large Scale Integration design", "credits": 3, "faculty_id": created_faculties[1].id},
            
            # Mechanical Engineering  
            {"name": "Thermodynamics", "code": "ME301", "description": "Study of heat and energy transfer", "credits": 3, "faculty_id": created_faculties[2].id},
            {"name": "Machine Design", "code": "ME302", "description": "Design of mechanical components", "credits": 4, "faculty_id": created_faculties[2].id},
            {"name": "Manufacturing Processes", "code": "ME401", "description": "Industrial manufacturing techniques", "credits": 3, "faculty_id": created_faculties[2].id},
            
            # Civil Engineering
            {"name": "Structural Analysis", "code": "CE301", "description": "Analysis of civil structures", "credits": 4, "faculty_id": created_faculties[3].id},
            {"name": "Concrete Technology", "code": "CE302", "description": "Properties and applications of concrete", "credits": 3, "faculty_id": created_faculties[3].id},
            
            # Business Administration
            {"name": "Strategic Management", "code": "MBA301", "description": "Business strategy and planning", "credits": 3, "faculty_id": created_faculties[4].id},
            {"name": "Financial Management", "code": "MBA302", "description": "Corporate finance and investment", "credits": 3, "faculty_id": created_faculties[4].id},
        ]
        
        created_subjects = []
        for subject_data in subjects_data:
            # Check if subject already exists
            result = await db.execute(select(Subject).where(Subject.code == subject_data["code"]))
            existing_subject = result.scalar_one_or_none()
            
            if not existing_subject:
                subject = Subject(**subject_data)
                db.add(subject)
                await db.commit()
                await db.refresh(subject)
                created_subjects.append(subject)
                print(f"   ✅ Created subject: {subject.name} ({subject.code})")
            else:
                created_subjects.append(existing_subject)
                print(f"   ⚠️  Subject already exists: {existing_subject.name} ({existing_subject.code})")
        
        print(f"\n👥 Creating sample students...")
        
        # Create sample students
        students_data = [
            # Computer Science students
            {"name": "Alice Johnson", "email": "alice.johnson@example.com", "student_id": "CSE001", "faculty_id": created_faculties[0].id, "semester": 5, "year": 3, "batch": 2022},
            {"name": "Bob Smith", "email": "bob.smith@example.com", "student_id": "CSE002", "faculty_id": created_faculties[0].id, "semester": 5, "year": 3, "batch": 2022},
            {"name": "Charlie Brown", "email": "charlie.brown@example.com", "student_id": "CSE003", "faculty_id": created_faculties[0].id, "semester": 3, "year": 2, "batch": 2023},
            {"name": "Diana Prince", "email": "diana.prince@example.com", "student_id": "CSE004", "faculty_id": created_faculties[0].id, "semester": 3, "year": 2, "batch": 2023},
            
            # Electronics students
            {"name": "Eve Wilson", "email": "eve.wilson@example.com", "student_id": "ECE001", "faculty_id": created_faculties[1].id, "semester": 5, "year": 3, "batch": 2022},
            {"name": "Frank Miller", "email": "frank.miller@example.com", "student_id": "ECE002", "faculty_id": created_faculties[1].id, "semester": 5, "year": 3, "batch": 2022},
            {"name": "Grace Lee", "email": "grace.lee@example.com", "student_id": "ECE003", "faculty_id": created_faculties[1].id, "semester": 7, "year": 4, "batch": 2021},
            
            # Mechanical students  
            {"name": "Henry Ford", "email": "henry.ford@example.com", "student_id": "ME001", "faculty_id": created_faculties[2].id, "semester": 5, "year": 3, "batch": 2022},
            {"name": "Ivy Chen", "email": "ivy.chen@example.com", "student_id": "ME002", "faculty_id": created_faculties[2].id, "semester": 5, "year": 3, "batch": 2022},
            
            # Civil students
            {"name": "Jack Turner", "email": "jack.turner@example.com", "student_id": "CE001", "faculty_id": created_faculties[3].id, "semester": 5, "year": 3, "batch": 2022},
            {"name": "Kate Davis", "email": "kate.davis@example.com", "student_id": "CE002", "faculty_id": created_faculties[3].id, "semester": 5, "year": 3, "batch": 2022},
            
            # Business students
            {"name": "Liam Parker", "email": "liam.parker@example.com", "student_id": "MBA001", "faculty_id": created_faculties[4].id, "semester": 3, "year": 2, "batch": 2023},
            {"name": "Mia Rodriguez", "email": "mia.rodriguez@example.com", "student_id": "MBA002", "faculty_id": created_faculties[4].id, "semester": 3, "year": 2, "batch": 2023},
        ]
        
        for student_data in students_data:
            # Check if user already exists
            result = await db.execute(select(User).where(User.email == student_data["email"]))
            existing_user = result.scalar_one_or_none()
            
            if not existing_user:
                # Create user first
                user = User(
                    email=student_data["email"],
                    full_name=student_data["name"],
                    hashed_password=get_password_hash("student123"),  # Default password
                    role=UserRole.STUDENT,
                    is_active=True,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)
                
                # Create student profile
                # Map faculty_id to faculty name for the legacy column
                faculty_names = {
                    9: "Computer Science & Engineering",  # CSE
                    10: "Electronics & Communication",     # ECE
                    5: "Mechanical Engineering",          # ME
                    4: "Civil Engineering",               # CE
                    6: "Business Administration"          # MBA
                }
                
                student = Student(
                    user_id=user.id,
                    student_id=student_data["student_id"],
                    faculty=faculty_names.get(student_data["faculty_id"], "Engineering"),  # Legacy column
                    faculty_id=student_data["faculty_id"],  # New foreign key column
                    semester=student_data["semester"],
                    year=student_data["year"],
                    batch=student_data["batch"],
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                db.add(student)
                await db.commit()
                await db.refresh(student)
                
                print(f"   ✅ Created student: {student_data['name']} ({student_data['student_id']})")
            else:
                print(f"   ⚠️  Student already exists: {student_data['name']} ({student_data['email']})")
        
        print(f"\n🎉 Sample data creation completed!")
        print(f"   📊 Faculties: {len(created_faculties)}")
        print(f"   📚 Subjects: {len(created_subjects)}")
        print(f"   👥 Students: {len(students_data)}")

if __name__ == "__main__":
    asyncio.run(create_sample_data())
