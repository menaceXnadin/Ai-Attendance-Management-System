"""
Add sample schedule data for testing
"""
import sys
sys.path.append('.')
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.models import ClassSchedule, Subject, Faculty, DayOfWeek
from datetime import time
import os
from dotenv import load_dotenv

async def add_sample_schedules():
    load_dotenv()
    DATABASE_URL = os.getenv('DATABASE_URL')
    engine = create_async_engine(DATABASE_URL)
    async_session = async_sessionmaker(engine)
    
    async with async_session() as session:
        # Get existing subjects and faculties
        subjects_result = await session.execute(select(Subject).limit(10))
        subjects = subjects_result.scalars().all()
        
        faculties_result = await session.execute(select(Faculty).limit(5))
        faculties = faculties_result.scalars().all()
        
        if not subjects or not faculties:
            print("❌ No subjects or faculties found. Please add some first.")
            return
        
        print(f"📚 Found {len(subjects)} subjects and {len(faculties)} faculties")
        
        # Sample schedule data
        sample_schedules = [
            # Computer Science Faculty (faculty_id=1) - Semester 1
            {
                "subject_id": subjects[0].id,
                "faculty_id": faculties[0].id,
                "day_of_week": DayOfWeek.MONDAY,
                "start_time": time(8, 0),  # 08:00
                "end_time": time(9, 30),   # 09:30
                "semester": 1,
                "academic_year": 2025,
                "classroom": "Room 101",
                "instructor_name": "Dr. Sarah Johnson"
            },
            {
                "subject_id": subjects[1].id if len(subjects) > 1 else subjects[0].id,
                "faculty_id": faculties[0].id,
                "day_of_week": DayOfWeek.MONDAY,
                "start_time": time(9, 45),  # 09:45
                "end_time": time(11, 15),   # 11:15
                "semester": 1,
                "academic_year": 2025,
                "classroom": "Room 102",
                "instructor_name": "Prof. Michael Chen"
            },
            {
                "subject_id": subjects[2].id if len(subjects) > 2 else subjects[0].id,
                "faculty_id": faculties[0].id,
                "day_of_week": DayOfWeek.MONDAY,
                "start_time": time(11, 30),  # 11:30
                "end_time": time(13, 0),     # 13:00
                "semester": 1,
                "academic_year": 2025,
                "classroom": "Lab A",
                "instructor_name": "Dr. Emily Rodriguez"
            },
            {
                "subject_id": subjects[3].id if len(subjects) > 3 else subjects[0].id,
                "faculty_id": faculties[0].id,
                "day_of_week": DayOfWeek.MONDAY,
                "start_time": time(14, 0),   # 14:00
                "end_time": time(15, 30),    # 15:30
                "semester": 1,
                "academic_year": 2025,
                "classroom": "Room 103",
                "instructor_name": "Dr. James Wilson"
            },
            {
                "subject_id": subjects[4].id if len(subjects) > 4 else subjects[0].id,
                "faculty_id": faculties[0].id,
                "day_of_week": DayOfWeek.MONDAY,
                "start_time": time(15, 45),  # 15:45
                "end_time": time(17, 15),    # 17:15
                "semester": 1,
                "academic_year": 2025,
                "classroom": "Lab B",
                "instructor_name": "Prof. Lisa Anderson"
            },
            # Sunday schedule (working day in Nepal)
            {
                "subject_id": subjects[0].id,
                "faculty_id": faculties[0].id,
                "day_of_week": DayOfWeek.SUNDAY,
                "start_time": time(8, 0),
                "end_time": time(9, 30),
                "semester": 1,
                "academic_year": 2025,
                "classroom": "Room 101",
                "instructor_name": "Dr. Sarah Johnson"
            },
            {
                "subject_id": subjects[1].id if len(subjects) > 1 else subjects[0].id,
                "faculty_id": faculties[0].id,
                "day_of_week": DayOfWeek.SUNDAY,
                "start_time": time(9, 45),
                "end_time": time(11, 15),
                "semester": 1,
                "academic_year": 2025,
                "classroom": "Room 102",
                "instructor_name": "Prof. Michael Chen"
            },
            {
                "subject_id": subjects[2].id if len(subjects) > 2 else subjects[0].id,
                "faculty_id": faculties[0].id,
                "day_of_week": DayOfWeek.SUNDAY,
                "start_time": time(11, 30),
                "end_time": time(13, 0),
                "semester": 1,
                "academic_year": 2025,
                "classroom": "Lab A",
                "instructor_name": "Dr. Emily Rodriguez"
            }
        ]
        
        added_count = 0
        for schedule_data in sample_schedules:
            try:
                # Check if schedule already exists
                existing = await session.execute(
                    select(ClassSchedule).where(
                        ClassSchedule.subject_id == schedule_data["subject_id"],
                        ClassSchedule.faculty_id == schedule_data["faculty_id"],
                        ClassSchedule.day_of_week == schedule_data["day_of_week"],
                        ClassSchedule.start_time == schedule_data["start_time"],
                        ClassSchedule.academic_year == schedule_data["academic_year"]
                    )
                )
                if existing.scalar_one_or_none():
                    continue  # Skip if already exists
                
                schedule = ClassSchedule(**schedule_data)
                session.add(schedule)
                added_count += 1
                
            except Exception as e:
                print(f"❌ Error adding schedule: {e}")
                continue
        
        await session.commit()
        print(f"✅ Added {added_count} sample schedules!")
        
        # Show the created schedules
        all_schedules = await session.execute(
            select(ClassSchedule).order_by(ClassSchedule.day_of_week, ClassSchedule.start_time)
        )
        schedules = all_schedules.scalars().all()
        
        print(f"\n📅 Current Schedules ({len(schedules)} total):")
        print("=" * 80)
        
        for schedule in schedules:
            subject_name = "Unknown"
            faculty_name = "Unknown"
            
            # Get subject name
            if schedule.subject_id:
                subject_result = await session.execute(select(Subject).where(Subject.id == schedule.subject_id))
                subject = subject_result.scalar_one_or_none()
                if subject:
                    subject_name = f"{subject.name} ({subject.code})"
            
            # Get faculty name
            if schedule.faculty_id:
                faculty_result = await session.execute(select(Faculty).where(Faculty.id == schedule.faculty_id))
                faculty = faculty_result.scalar_one_or_none()
                if faculty:
                    faculty_name = faculty.name
            
            print(f"🎓 {schedule.day_of_week.value.title()}: {schedule.start_time.strftime('%H:%M')}-{schedule.end_time.strftime('%H:%M')}")
            print(f"   📚 Subject: {subject_name}")
            print(f"   🏛️  Faculty: {faculty_name}")
            print(f"   🏫 Classroom: {schedule.classroom}")
            print(f"   👨‍🏫 Instructor: {schedule.instructor_name}")
            print(f"   📊 Semester: {schedule.semester}, Year: {schedule.academic_year}")
            print()

if __name__ == "__main__":
    print("🕐 Creating sample class schedules...")
    asyncio.run(add_sample_schedules())