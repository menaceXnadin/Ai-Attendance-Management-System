#!/usr/bin/env python3
"""
Comprehensive Sample Data Creator for Attendance Management System
Creates faculties, subjects, students, admin users, and sample attendance records
"""
import asyncio
import sys
import os
from datetime import datetime, timedelta
import random

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.database import AsyncSessionLocal, async_engine, Base
from app.models import (
    Faculty, Subject, Student, User, Admin, AttendanceRecord,
    UserRole, AttendanceStatus, AttendanceMethod, Mark, Notification
)
from app.core.security import get_password_hash

class SampleDataCreator:
    def __init__(self):
        self.faculties = []
        self.subjects = []
        self.students = []
        self.admin_user = None

    async def init_database(self):
        """Initialize database tables"""
        print("🔧 Initializing database tables...")
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Database tables initialized")

    async def create_admin_user(self, session: AsyncSession):
        """Create an admin user for testing"""
        print("\n👨‍💼 Creating admin user...")
        
        # Check if admin already exists
        result = await session.execute(
            select(User).where(User.email == "admin@attendance.com")
        )
        existing_admin = result.scalar_one_or_none()
        
        if existing_admin:
            print("   ⚠️  Admin user already exists")
            self.admin_user = existing_admin
            return existing_admin
        
        # Create admin user
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
            name=admin_user.full_name,  # Add name directly to admin table
            department="IT Administration",
            permissions=[
                "manage_students",
                "manage_faculty",
                "manage_subjects",
                "view_reports",
                "manage_attendance"
            ],
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        session.add(admin_profile)
        await session.commit()
        await session.refresh(admin_profile)
        
        self.admin_user = admin_user
        print(f"   ✅ Created admin: {admin_user.full_name} (admin@attendance.com)")
        return admin_user

    async def create_faculties(self, session: AsyncSession):
        """Create sample faculties"""
        print("\n🏫 Creating faculties...")
        
        faculties_data = [
            {
                "name": "Computer Science & Engineering",
                "description": "Department of Computer Science and Engineering - Leading in software development, AI, and computing technologies"
            },
            {
                "name": "Electronics & Communication Engineering", 
                "description": "Department of Electronics and Communication Engineering - Specializing in electronics, telecommunications, and embedded systems"
            },
            {
                "name": "Mechanical Engineering",
                "description": "Department of Mechanical Engineering - Focused on mechanical systems, manufacturing, and automotive engineering"
            },
            {
                "name": "Civil Engineering",
                "description": "Department of Civil Engineering - Infrastructure development, construction, and environmental engineering"
            },
            {
                "name": "Business Administration",
                "description": "School of Business Administration - Management, finance, marketing, and entrepreneurship"
            },
            {
                "name": "Information Technology",
                "description": "Department of Information Technology - IT systems, web development, and information security"
            }
        ]
        
        for faculty_data in faculties_data:
            # Check if faculty exists
            result = await session.execute(
                select(Faculty).where(Faculty.name == faculty_data["name"])
            )
            existing_faculty = result.scalar_one_or_none()
            
            if existing_faculty:
                self.faculties.append(existing_faculty)
                print(f"   ⚠️  Faculty already exists: {existing_faculty.name}")
            else:
                faculty = Faculty(**faculty_data, created_at=datetime.now())
                session.add(faculty)
                await session.commit()
                await session.refresh(faculty)
                self.faculties.append(faculty)
                print(f"   ✅ Created faculty: {faculty.name}")

    async def create_subjects(self, session: AsyncSession):
        """Create sample subjects for each faculty"""
        print("\n📚 Creating subjects...")
        
        # Subjects mapped by faculty index and semester
        subjects_by_faculty = [
            # Computer Science & Engineering (index 0)
            [
                # Semester 1-2
                {"name": "Programming Fundamentals", "code": "CSE101", "credits": 4, "semester": 1},
                {"name": "Mathematics for Computing", "code": "CSE102", "credits": 3, "semester": 1},
                {"name": "Digital Logic Design", "code": "CSE103", "credits": 3, "semester": 1},
                {"name": "Data Structures", "code": "CSE201", "credits": 4, "semester": 2},
                {"name": "Computer Organization", "code": "CSE202", "credits": 3, "semester": 2},
                {"name": "Discrete Mathematics", "code": "CSE203", "credits": 3, "semester": 2},
                # Semester 3-4
                {"name": "Algorithms", "code": "CSE301", "credits": 4, "semester": 3},
                {"name": "Database Systems", "code": "CSE302", "credits": 3, "semester": 3},
                {"name": "Operating Systems", "code": "CSE303", "credits": 3, "semester": 3},
                {"name": "Computer Networks", "code": "CSE401", "credits": 3, "semester": 4},
                {"name": "Software Engineering", "code": "CSE402", "credits": 3, "semester": 4},
                {"name": "Web Technologies", "code": "CSE403", "credits": 3, "semester": 4},
                # Semester 5-6
                {"name": "Machine Learning", "code": "CSE501", "credits": 4, "semester": 5},
                {"name": "Artificial Intelligence", "code": "CSE502", "credits": 3, "semester": 5},
                {"name": "Cybersecurity", "code": "CSE503", "credits": 3, "semester": 5},
                {"name": "Cloud Computing", "code": "CSE601", "credits": 3, "semester": 6},
                {"name": "Mobile App Development", "code": "CSE602", "credits": 3, "semester": 6},
            ],
            # Electronics & Communication Engineering (index 1)
            [
                {"name": "Circuit Analysis", "code": "ECE101", "credits": 4, "semester": 1},
                {"name": "Electronic Devices", "code": "ECE102", "credits": 3, "semester": 1},
                {"name": "Digital Electronics", "code": "ECE201", "credits": 4, "semester": 2},
                {"name": "Signals and Systems", "code": "ECE202", "credits": 3, "semester": 2},
                {"name": "Communication Systems", "code": "ECE301", "credits": 3, "semester": 3},
                {"name": "Microprocessors", "code": "ECE302", "credits": 3, "semester": 3},
                {"name": "VLSI Design", "code": "ECE401", "credits": 3, "semester": 4},
                {"name": "Embedded Systems", "code": "ECE402", "credits": 3, "semester": 4},
                {"name": "Digital Signal Processing", "code": "ECE501", "credits": 4, "semester": 5},
                {"name": "Wireless Communication", "code": "ECE502", "credits": 3, "semester": 5},
            ],
            # Mechanical Engineering (index 2)
            [
                {"name": "Engineering Mechanics", "code": "ME101", "credits": 4, "semester": 1},
                {"name": "Engineering Drawing", "code": "ME102", "credits": 3, "semester": 1},
                {"name": "Thermodynamics", "code": "ME201", "credits": 4, "semester": 2},
                {"name": "Fluid Mechanics", "code": "ME202", "credits": 3, "semester": 2},
                {"name": "Machine Design", "code": "ME301", "credits": 3, "semester": 3},
                {"name": "Manufacturing Processes", "code": "ME302", "credits": 3, "semester": 3},
                {"name": "Heat Transfer", "code": "ME401", "credits": 3, "semester": 4},
                {"name": "Automobile Engineering", "code": "ME402", "credits": 3, "semester": 4},
                {"name": "Industrial Engineering", "code": "ME501", "credits": 3, "semester": 5},
            ],
            # Civil Engineering (index 3)
            [
                {"name": "Surveying", "code": "CE101", "credits": 3, "semester": 1},
                {"name": "Building Materials", "code": "CE102", "credits": 3, "semester": 1},
                {"name": "Structural Analysis", "code": "CE201", "credits": 4, "semester": 2},
                {"name": "Concrete Technology", "code": "CE202", "credits": 3, "semester": 2},
                {"name": "Geotechnical Engineering", "code": "CE301", "credits": 3, "semester": 3},
                {"name": "Transportation Engineering", "code": "CE302", "credits": 3, "semester": 3},
                {"name": "Environmental Engineering", "code": "CE401", "credits": 3, "semester": 4},
                {"name": "Construction Management", "code": "CE402", "credits": 3, "semester": 4},
            ],
            # Business Administration (index 4)
            [
                {"name": "Principles of Management", "code": "BBA101", "credits": 3, "semester": 1},
                {"name": "Business Mathematics", "code": "BBA102", "credits": 3, "semester": 1},
                {"name": "Financial Accounting", "code": "BBA201", "credits": 3, "semester": 2},
                {"name": "Marketing Management", "code": "BBA202", "credits": 3, "semester": 2},
                {"name": "Human Resource Management", "code": "BBA301", "credits": 3, "semester": 3},
                {"name": "Financial Management", "code": "BBA302", "credits": 3, "semester": 3},
                {"name": "Strategic Management", "code": "BBA401", "credits": 3, "semester": 4},
                {"name": "International Business", "code": "BBA402", "credits": 3, "semester": 4},
                {"name": "Entrepreneurship", "code": "BBA501", "credits": 3, "semester": 5},
            ],
            # Information Technology (index 5)
            [
                {"name": "Programming in C", "code": "IT101", "credits": 4, "semester": 1},
                {"name": "Computer Fundamentals", "code": "IT102", "credits": 3, "semester": 1},
                {"name": "Object Oriented Programming", "code": "IT201", "credits": 4, "semester": 2},
                {"name": "System Analysis", "code": "IT202", "credits": 3, "semester": 2},
                {"name": "Database Management", "code": "IT301", "credits": 3, "semester": 3},
                {"name": "Network Administration", "code": "IT302", "credits": 3, "semester": 3},
                {"name": "Web Development", "code": "IT401", "credits": 3, "semester": 4},
                {"name": "Information Security", "code": "IT402", "credits": 3, "semester": 4},
                {"name": "Project Management", "code": "IT501", "credits": 3, "semester": 5},
            ]
        ]
        
        for faculty_idx, faculty_subjects in enumerate(subjects_by_faculty):
            if faculty_idx < len(self.faculties):
                faculty = self.faculties[faculty_idx]
                print(f"   📖 Creating subjects for {faculty.name}...")
                
                for subject_data in faculty_subjects:
                    # Check if subject exists
                    result = await session.execute(
                        select(Subject).where(Subject.code == subject_data["code"])
                    )
                    existing_subject = result.scalar_one_or_none()
                    
                    if existing_subject:
                        self.subjects.append(existing_subject)
                        print(f"      ⚠️  Subject exists: {existing_subject.name}")
                    else:
                        subject = Subject(
                            name=subject_data["name"],
                            code=subject_data["code"],
                            description=f"{subject_data['name']} - Semester {subject_data['semester']} course for {faculty.name}",
                            credits=subject_data["credits"],
                            faculty_id=faculty.id,
                            class_schedule={
                                "semester": subject_data["semester"],
                                "days": ["Monday", "Wednesday", "Friday"],
                                "time": "10:00-11:00"
                            },
                            created_at=datetime.now(),
                            updated_at=datetime.now()
                        )
                        session.add(subject)
                        await session.commit()
                        await session.refresh(subject)
                        self.subjects.append(subject)
                        print(f"      ✅ Created: {subject.name} ({subject.code})")

    async def create_students(self, session: AsyncSession):
        """Create sample students for each faculty and semester"""
        print("\n👥 Creating students...")
        
        # Student names for realistic data
        first_names = [
            "Aarav", "Aditi", "Arjun", "Ananya", "Rohan", "Priya", "Vikram", "Shreya",
            "Karan", "Meera", "Siddharth", "Kavya", "Aryan", "Riya", "Harsh", "Sneha",
            "Rahul", "Pooja", "Amit", "Nisha", "Raj", "Divya", "Varun", "Ritika",
            "Nikhil", "Sakshi", "Akash", "Ishita", "Rohit", "Tanvi", "Yash", "Kriti",
            "Aditya", "Simran", "Kunal", "Isha", "Abhishek", "Neha", "Shubham", "Anjali"
        ]
        
        last_names = [
            "Sharma", "Patel", "Singh", "Kumar", "Gupta", "Agarwal", "Jain", "Verma",
            "Shah", "Mehta", "Gandhi", "Pandey", "Mishra", "Yadav", "Thakur", "Joshi",
            "Malhotra", "Chopra", "Bansal", "Mittal", "Saxena", "Aggarwal", "Goel", "Kaur"
        ]
        
        for faculty_idx, faculty in enumerate(self.faculties):
            print(f"   👨‍🎓 Creating students for {faculty.name}...")
            
            # Create 8-12 students per faculty across different semesters
            students_per_faculty = random.randint(8, 12)
            semesters = [1, 2, 3, 4, 5, 6] if faculty_idx < 4 else [1, 2, 3, 4]  # Business has fewer semesters
            
            for i in range(students_per_faculty):
                # Generate student data
                first_name = random.choice(first_names)
                last_name = random.choice(last_names)
                full_name = f"{first_name} {last_name}"
                
                # Create unique email and student ID
                email = f"{first_name.lower()}.{last_name.lower()}{i+1}@student.edu"
                faculty_code = faculty.name.split()[0][:3].upper()
                student_id = f"{faculty_code}{2020 + random.randint(1, 4)}{i+1:03d}"
                
                semester = random.choice(semesters)
                year = (semester + 1) // 2
                batch = 2025 - year + 1
                
                # Check if student exists
                result = await session.execute(
                    select(User).where(User.email == email)
                )
                existing_user = result.scalar_one_or_none()
                
                if existing_user:
                    continue
                
                # Create user
                user = User(
                    email=email,
                    full_name=full_name,
                    hashed_password=get_password_hash("student123"),
                    role=UserRole.student,
                    is_active=True,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                
                session.add(user)
                await session.commit()
                await session.refresh(user)
                
                # Create student profile
                student = Student(
                    user_id=user.id,
                    student_id=student_id,
                    faculty=faculty.name,  # Legacy column
                    faculty_id=faculty.id,
                    semester=semester,
                    year=year,
                    batch=batch,
                    phone_number=f"+977-98{random.randint(10000000, 99999999)}",
                    emergency_contact=f"+977-98{random.randint(10000000, 99999999)}",
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                
                session.add(student)
                await session.commit()
                await session.refresh(student)
                self.students.append(student)
                
                print(f"      ✅ Created: {full_name} ({student_id}) - Semester {semester}")

    async def create_sample_attendance(self, session: AsyncSession):
        """Create sample attendance records for the last 30 days"""
        print("\n📊 Creating sample attendance records...")
        
        # Get current date and create records for last 30 days
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=30)
        
        # Group students by faculty and semester for efficient processing
        students_by_faculty_semester = {}
        for student in self.students:
            key = (student.faculty_id, student.semester)
            if key not in students_by_faculty_semester:
                students_by_faculty_semester[key] = []
            students_by_faculty_semester[key].append(student)
        
        # Get subjects for each faculty/semester combination
        total_records = 0
        
        for (faculty_id, semester), students in students_by_faculty_semester.items():
            # Find subjects for this faculty
            faculty_subjects = [s for s in self.subjects if s.faculty_id == faculty_id]
            if not faculty_subjects:
                continue
            
            print(f"   📅 Creating attendance for Faculty {faculty_id}, Semester {semester} ({len(students)} students)")
            
            attendance_batch = []
            
            # Create attendance for each weekday in the date range
            current_date = start_date
            while current_date <= end_date:
                # Skip weekends
                if current_date.weekday() < 5:  # Monday = 0, Friday = 4
                    # Randomly select 1-2 subjects for this day
                    day_subjects = random.sample(faculty_subjects, min(2, len(faculty_subjects)))
                    
                    for subject in day_subjects:
                        for student in students:
                            # 85% chance of being present, 10% absent, 5% late
                            status_choices = [AttendanceStatus.present, AttendanceStatus.absent, AttendanceStatus.late]
                            status_weights = [85, 10, 5]
                            status_value = random.choices(status_choices, weights=status_weights)[0]
                            
                            # Random method (mostly manual for now)
                            method_choices = [AttendanceMethod.manual, AttendanceMethod.face]
                            method_weights = [70, 30]
                            method_value = random.choices(method_choices, weights=method_weights)[0]
                            
                            # Create attendance record
                            attendance = AttendanceRecord(
                                student_id=student.id,
                                subject_id=subject.id,
                                date=datetime.combine(current_date, datetime.min.time()),
                                status=status_value,  # Use enum directly
                                method=method_value,  # Use enum directly
                                confidence_score=random.uniform(0.85, 0.99) if method_value == AttendanceMethod.face else None,
                                marked_by=self.admin_user.id,
                                notes="Sample attendance data" if random.random() < 0.1 else None,
                                created_at=datetime.now()
                            )
                            
                            # Add record individually to avoid bulk insert enum issues
                            session.add(attendance)
                            total_records += 1
                            
                            # Commit frequently to avoid large transactions and enum issues
                            if total_records % 50 == 0:
                                await session.commit()
                                print(f"   📝 Created {total_records} attendance records so far...")
                
                current_date += timedelta(days=1)
            
            # Commit remaining records
            await session.commit()
        
        print(f"   ✅ Created {total_records} attendance records")

    async def create_sample_marks(self, session: AsyncSession):
        """Create sample marks for students"""
        print("\n📝 Creating sample marks...")
        
        exam_types = ["Quiz 1", "Quiz 2", "Midterm", "Assignment 1", "Assignment 2", "Final"]
        total_marks_map = {"Quiz 1": 10, "Quiz 2": 10, "Midterm": 30, "Assignment 1": 15, "Assignment 2": 15, "Final": 50}
        
        total_marks_created = 0
        
        for student in self.students:
            # Get subjects for this student's faculty and semester level
            student_subjects = [
                s for s in self.subjects 
                if s.faculty_id == student.faculty_id and 
                s.class_schedule and 
                s.class_schedule.get("semester", 1) <= student.semester
            ]
            
            for subject in student_subjects[:4]:  # Limit to 4 subjects per student
                for exam_type in exam_types:
                    total_marks = total_marks_map[exam_type]
                    
                    # Generate realistic marks (70-95% of total marks)
                    percentage = random.uniform(0.70, 0.95)
                    marks_obtained = round(total_marks * percentage, 1)
                    
                    # Calculate grade
                    grade_percentage = (marks_obtained / total_marks) * 100
                    if grade_percentage >= 90:
                        grade = "A+"
                    elif grade_percentage >= 85:
                        grade = "A"
                    elif grade_percentage >= 80:
                        grade = "B+"
                    elif grade_percentage >= 75:
                        grade = "B"
                    elif grade_percentage >= 70:
                        grade = "C+"
                    elif grade_percentage >= 65:
                        grade = "C"
                    else:
                        grade = "D"
                    
                    exam_date = datetime.now() - timedelta(days=random.randint(1, 60))
                    
                    mark = Mark(
                        student_id=student.id,
                        subject_id=subject.id,
                        exam_type=exam_type,
                        marks_obtained=marks_obtained,
                        total_marks=total_marks,
                        grade=grade,
                        exam_date=exam_date,
                        created_at=datetime.now()
                    )
                    
                    session.add(mark)
                    total_marks_created += 1
        
        await session.commit()
        print(f"   ✅ Created {total_marks_created} mark records")

    async def create_sample_notifications(self, session: AsyncSession):
        """Create sample notifications for users"""
        print("\n🔔 Creating sample notifications...")
        
        notification_templates = [
            {
                "title": "Welcome to Attendance Management System",
                "message": "Your account has been successfully created. You can now access the attendance system.",
                "type": "success"
            },
            {
                "title": "Low Attendance Warning",
                "message": "Your attendance is below 75%. Please ensure regular attendance to avoid academic penalties.",
                "type": "warning"
            },
            {
                "title": "New Subject Added",
                "message": "A new subject has been added to your curriculum. Check your dashboard for details.",
                "type": "info"
            },
            {
                "title": "Exam Schedule Released",
                "message": "The midterm examination schedule has been published. Please check the academic calendar.",
                "type": "info"
            },
            {
                "title": "System Maintenance",
                "message": "The system will undergo maintenance on Sunday 2:00 AM - 4:00 AM. Services may be temporarily unavailable.",
                "type": "warning"
            }
        ]
        
        total_notifications = 0
        
        # Create notifications for all students
        for student in self.students:
            # Each student gets 2-4 random notifications
            num_notifications = random.randint(2, 4)
            selected_notifications = random.sample(notification_templates, num_notifications)
            
            for notif_template in selected_notifications:
                notification = Notification(
                    user_id=student.user_id,
                    title=notif_template["title"],
                    message=notif_template["message"],
                    type=notif_template["type"],
                    is_read=random.choice([True, False]),
                    action_url="/dashboard" if random.random() < 0.3 else None,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 7))
                )
                
                session.add(notification)
                total_notifications += 1
        
        # Create admin notifications
        admin_notifications = [
            {
                "title": "System Status Report",
                "message": "Weekly system performance report is available for review.",
                "type": "info"
            },
            {
                "title": "New Student Registrations",
                "message": "5 new students have registered this week. Please review and approve their accounts.",
                "type": "info"
            }
        ]
        
        for notif_template in admin_notifications:
            notification = Notification(
                user_id=self.admin_user.id,
                title=notif_template["title"],
                message=notif_template["message"],
                type=notif_template["type"],
                is_read=False,
                action_url="/admin/dashboard",
                created_at=datetime.now() - timedelta(days=random.randint(0, 3))
            )
            
            session.add(notification)
            total_notifications += 1
        
        await session.commit()
        print(f"   ✅ Created {total_notifications} notifications")

    async def run(self):
        """Run the complete sample data creation process"""
        print("🚀 Creating Comprehensive Sample Data for Attendance Management System")
        print("=" * 80)
        
        async with AsyncSessionLocal() as session:
            try:
                # Initialize database
                await self.init_database()
                
                # Create admin user first
                await self.create_admin_user(session)
                
                # Create faculties
                await self.create_faculties(session)
                
                # Create subjects
                await self.create_subjects(session)
                
                # Create students
                await self.create_students(session)
                
                # Create sample attendance records
                await self.create_sample_attendance(session)
                
                # Create sample marks
                await self.create_sample_marks(session)
                
                # Create sample notifications
                await self.create_sample_notifications(session)
                
                print("\n" + "=" * 80)
                print("🎉 SAMPLE DATA CREATION COMPLETED!")
                print("=" * 80)
                print(f"📊 Summary:")
                print(f"   👨‍💼 Admin Users: 1")
                print(f"   🏫 Faculties: {len(self.faculties)}")
                print(f"   📚 Subjects: {len(self.subjects)}")
                print(f"   👥 Students: {len(self.students)}")
                print(f"   📅 Attendance Records: ~{len(self.students) * 30 * 2} (estimated)")
                print("\n🔑 Login Credentials:")
                print("   Admin: admin@attendance.com / admin123")
                print("   Students: [firstname].[lastname][number]@student.edu / student123")
                print("\n✅ Your system is now ready for testing the admin workflow!")
                
            except Exception as e:
                print(f"\n❌ Error creating sample data: {str(e)}")
                await session.rollback()
                raise

async def main():
    """Main function to run the sample data creator"""
    creator = SampleDataCreator()
    await creator.run()

if __name__ == "__main__":
    asyncio.run(main())
