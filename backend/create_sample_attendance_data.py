import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_engine, Base
from app.models import Faculty, Subject, Student, User, UserRole
from app.core.database import get_db
from sqlalchemy import text

async def create_sample_data():
    """Create sample faculties, subjects, and students for testing the attendance workflow."""
    
    # Create all tables
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async for db in get_db():
        # Sample faculties
        faculties_data = [
            {"name": "Computer Science & Engineering", "description": "Computer Science and Engineering Faculty"},
            {"name": "Electrical Engineering", "description": "Electrical and Electronics Engineering Faculty"},
            {"name": "Mechanical Engineering", "description": "Mechanical Engineering Faculty"},
            {"name": "Civil Engineering", "description": "Civil Engineering Faculty"},
            {"name": "Business Administration", "description": "Business and Management Faculty"},
        ]
        
        # Check if faculties already exist
        result = await db.execute(text("SELECT COUNT(*) FROM faculties"))
        faculty_count = result.scalar()
        
        faculties = []
        if faculty_count == 0:
            print("Creating sample faculties...")
            for faculty_data in faculties_data:
                faculty = Faculty(
                    name=faculty_data["name"],
                    description=faculty_data["description"]
                )
                db.add(faculty)
                faculties.append(faculty)
            
            await db.commit()
            
            # Refresh to get IDs
            for faculty in faculties:
                await db.refresh(faculty)
        else:
            print(f"Found {faculty_count} existing faculties")
            # Get existing faculties
            result = await db.execute(text("SELECT id, name FROM faculties"))
            faculty_rows = result.fetchall()
            for row in faculty_rows:
                faculty = Faculty(id=row[0], name=row[1])
                faculties.append(faculty)
        
        # Sample subjects for each faculty
        subjects_data = [
            # Computer Science & Engineering
            {"name": "Data Structures and Algorithms", "code": "CSE101", "credits": 4, "faculty_idx": 0},
            {"name": "Database Management Systems", "code": "CSE201", "credits": 3, "faculty_idx": 0},
            {"name": "Computer Networks", "code": "CSE301", "credits": 3, "faculty_idx": 0},
            {"name": "Machine Learning", "code": "CSE401", "credits": 4, "faculty_idx": 0},
            {"name": "Software Engineering", "code": "CSE202", "credits": 3, "faculty_idx": 0},
            
            # Electrical Engineering
            {"name": "Circuit Analysis", "code": "EEE101", "credits": 4, "faculty_idx": 1},
            {"name": "Digital Electronics", "code": "EEE201", "credits": 3, "faculty_idx": 1},
            {"name": "Power Systems", "code": "EEE301", "credits": 4, "faculty_idx": 1},
            {"name": "Control Systems", "code": "EEE302", "credits": 3, "faculty_idx": 1},
            
            # Mechanical Engineering
            {"name": "Thermodynamics", "code": "MEE101", "credits": 4, "faculty_idx": 2},
            {"name": "Fluid Mechanics", "code": "MEE201", "credits": 3, "faculty_idx": 2},
            {"name": "Machine Design", "code": "MEE301", "credits": 4, "faculty_idx": 2},
            
            # Civil Engineering
            {"name": "Structural Analysis", "code": "CEE101", "credits": 4, "faculty_idx": 3},
            {"name": "Geotechnical Engineering", "code": "CEE201", "credits": 3, "faculty_idx": 3},
            {"name": "Transportation Engineering", "code": "CEE301", "credits": 3, "faculty_idx": 3},
            
            # Business Administration
            {"name": "Financial Management", "code": "BBA101", "credits": 3, "faculty_idx": 4},
            {"name": "Marketing Management", "code": "BBA201", "credits": 3, "faculty_idx": 4},
            {"name": "Human Resource Management", "code": "BBA301", "credits": 3, "faculty_idx": 4},
        ]
        
        # Check if subjects already exist
        result = await db.execute(text("SELECT COUNT(*) FROM subjects"))
        subject_count = result.scalar()
        
        if subject_count == 0:
            print("Creating sample subjects...")
            for subject_data in subjects_data:
                if subject_data["faculty_idx"] < len(faculties):
                    faculty = faculties[subject_data["faculty_idx"]]
                    subject = Subject(
                        name=subject_data["name"],
                        code=subject_data["code"],
                        credits=subject_data["credits"],
                        faculty_id=faculty.id,
                        description=f"Subject for {faculty.name}"
                    )
                    db.add(subject)
            
            await db.commit()
            print("Sample subjects created successfully!")
        else:
            print(f"Found {subject_count} existing subjects")
        
        # Create some sample students
        result = await db.execute(text("SELECT COUNT(*) FROM students"))
        student_count = result.scalar()
        
        if student_count < 10:
            print("Creating sample students...")
            
            # Sample students for different faculties and semesters
            sample_users = [
                {"email": "john.doe@example.com", "full_name": "John Doe", "faculty_idx": 0, "semester": 3, "batch": 2023},
                {"email": "jane.smith@example.com", "full_name": "Jane Smith", "faculty_idx": 0, "semester": 3, "batch": 2023},
                {"email": "mike.johnson@example.com", "full_name": "Mike Johnson", "faculty_idx": 1, "semester": 2, "batch": 2024},
                {"email": "sarah.wilson@example.com", "full_name": "Sarah Wilson", "faculty_idx": 1, "semester": 2, "batch": 2024},
                {"email": "alex.brown@example.com", "full_name": "Alex Brown", "faculty_idx": 2, "semester": 4, "batch": 2022},
                {"email": "emily.davis@example.com", "full_name": "Emily Davis", "faculty_idx": 2, "semester": 4, "batch": 2022},
                {"email": "david.miller@example.com", "full_name": "David Miller", "faculty_idx": 3, "semester": 1, "batch": 2025},
                {"email": "lisa.garcia@example.com", "full_name": "Lisa Garcia", "faculty_idx": 3, "semester": 1, "batch": 2025},
                {"email": "chris.martinez@example.com", "full_name": "Chris Martinez", "faculty_idx": 4, "semester": 2, "batch": 2024},
                {"email": "amy.taylor@example.com", "full_name": "Amy Taylor", "faculty_idx": 4, "semester": 2, "batch": 2024},
            ]
            
            for i, user_data in enumerate(sample_users):
                if user_data["faculty_idx"] < len(faculties):
                    # Create user
                    user = User(
                        email=user_data["email"],
                        full_name=user_data["full_name"],
                        hashed_password="dummy_hash",  # In real app, this would be properly hashed
                        role=UserRole.student,
                        is_active=True
                    )
                    db.add(user)
                    await db.flush()  # Flush to get the user ID
                    
                    # Create student
                    faculty = faculties[user_data["faculty_idx"]]
                    student = Student(
                        user_id=user.id,
                        student_id=f"STU{2023+i:04d}",
                        faculty_id=faculty.id,
                        semester=user_data["semester"],
                        year=(user_data["semester"] + 1) // 2,  # Approximate year based on semester
                        batch=user_data["batch"],
                        phone_number=f"+1234567{i:03d}",
                        emergency_contact=f"+1234567{i+100:03d}"
                    )
                    db.add(student)
            
            await db.commit()
            print("Sample students created successfully!")
        else:
            print(f"Found {student_count} existing students")
        
        print("\n✅ Sample data creation completed!")
        print("You can now test the attendance workflow with:")
        print("- Multiple faculties")
        print("- Multiple subjects per faculty")
        print("- Students enrolled in different semesters")
        
        break  # Exit the async generator

if __name__ == "__main__":
    asyncio.run(create_sample_data())
