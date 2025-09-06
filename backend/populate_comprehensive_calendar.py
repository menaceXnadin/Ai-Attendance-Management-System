#!/usr/bin/env python3
"""
Populate comprehensive calendar data for the academic calendar
Creates a full month of varied events: classes, exams, holidays, special events
"""

import asyncio
import sys
import os
from datetime import date, datetime, time, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models import User, Subject, Faculty
from app.models.calendar import AcademicEvent, EventType, HolidayType

async def populate_calendar_events():
    """Create comprehensive calendar events for August 2025"""
    
    async with AsyncSessionLocal() as db:
        # Get admin user (creator)
        from app.models import UserRole
        admin_result = await db.execute(select(User).where(User.role == UserRole.admin).limit(1))
        admin_user = admin_result.scalar_one_or_none()
        
        if not admin_user:
            print("❌ No admin user found. Please create an admin user first.")
            return
        
        # Get available subjects and faculties
        subjects_result = await db.execute(select(Subject))
        subjects = subjects_result.scalars().all()
        
        faculties_result = await db.execute(select(Faculty))
        faculties = faculties_result.scalars().all()
        
        if not subjects:
            print("❌ No subjects found. Please create subjects first.")
            return
            
        if not faculties:
            print("❌ No faculties found. Please create faculties first.")
            return
        
        print(f"📚 Found {len(subjects)} subjects and {len(faculties)} faculties")
        
        # Clear existing events for August 2025
        existing_result = await db.execute(
            select(AcademicEvent).where(
                AcademicEvent.start_date >= date(2025, 8, 1),
                AcademicEvent.start_date <= date(2025, 8, 31)
            )
        )
        existing_events = existing_result.scalars().all()
        
        for event in existing_events:
            await db.delete(event)
        
        await db.commit()
        print(f"🗑️ Cleared {len(existing_events)} existing August events")
        
        # Create comprehensive event data
        events_to_create = []
        
        # 1. Regular Classes (Mon-Fri, various times)
        class_schedule = [
            {"subject": "Mathematics", "time": "09:00", "duration": 90, "room": "Math-101"},
            {"subject": "Physics", "time": "11:00", "duration": 90, "room": "Phy-201"},
            {"subject": "Chemistry", "time": "14:00", "duration": 90, "room": "Chem-301"},
            {"subject": "Computer Science", "time": "16:00", "duration": 90, "room": "CS-401"},
        ]
        
        # Create classes for weekdays in August
        for day in range(1, 32):
            event_date = date(2025, 8, day)
            # Skip weekends for regular classes
            if event_date.weekday() < 5:  # Monday = 0, Friday = 4
                for class_info in class_schedule:
                    # Find matching subject
                    subject = next((s for s in subjects if class_info["subject"].lower() in s.name.lower()), None)
                    if subject:
                        start_time = datetime.strptime(class_info["time"], "%H:%M").time()
                        end_time = (datetime.combine(date.today(), start_time) + 
                                  timedelta(minutes=class_info["duration"])).time()
                        
                        events_to_create.append(AcademicEvent(
                            title=f"{subject.name} Class",
                            description=f"Regular {subject.name} lecture session",
                            event_type=EventType.CLASS,
                            start_date=event_date,
                            start_time=start_time,
                            end_time=end_time,
                            subject_id=subject.id,
                            faculty_id=subject.faculty_id,
                            class_room=class_info["room"],
                            color_code="#10B981",  # Green for classes
                            attendance_required=True,
                            created_by=admin_user.id
                        ))
        
        # 2. Exams (spread throughout the month)
        exam_dates = [
            {"date": date(2025, 8, 5), "subject": "Mathematics", "type": "Midterm Exam"},
            {"date": date(2025, 8, 7), "subject": "Physics", "type": "Quiz"},
            {"date": date(2025, 8, 12), "subject": "Chemistry", "type": "Lab Exam"},
            {"date": date(2025, 8, 14), "subject": "Computer Science", "type": "Programming Test"},
            {"date": date(2025, 8, 19), "subject": "Mathematics", "type": "Final Exam"},
            {"date": date(2025, 8, 21), "subject": "Physics", "type": "Final Exam"},
            {"date": date(2025, 8, 26), "subject": "Chemistry", "type": "Final Exam"},
            {"date": date(2025, 8, 28), "subject": "Computer Science", "type": "Final Project"},
        ]
        
        for exam in exam_dates:
            subject = next((s for s in subjects if exam["subject"].lower() in s.name.lower()), None)
            if subject:
                events_to_create.append(AcademicEvent(
                    title=f"{exam['type']} - {subject.name}",
                    description=f"{exam['type']} for {subject.name} course",
                    event_type=EventType.EXAM,
                    start_date=exam["date"],
                    start_time=time(10, 0),
                    end_time=time(12, 0),
                    subject_id=subject.id,
                    faculty_id=subject.faculty_id,
                    class_room=f"Exam Hall {exam['date'].day % 3 + 1}",
                    color_code="#F59E0B",  # Amber for exams
                    attendance_required=True,
                    created_by=admin_user.id
                ))
        
        # 3. Holidays and Special Days
        holidays = [
            {"date": date(2025, 8, 1), "title": "New Month Celebration", "type": EventType.SPECIAL_EVENT},
            {"date": date(2025, 8, 6), "title": "Faculty Meeting Day", "type": EventType.SPECIAL_EVENT},
            {"date": date(2025, 8, 11), "title": "Student Orientation", "type": EventType.SPECIAL_EVENT},
            {"date": date(2025, 8, 15), "title": "Independence Day", "type": EventType.HOLIDAY},
            {"date": date(2025, 8, 18), "title": "Sports Week Begins", "type": EventType.SPECIAL_EVENT},
            {"date": date(2025, 8, 22), "title": "Alumni Meet", "type": EventType.SPECIAL_EVENT},
            {"date": date(2025, 8, 25), "title": "Cultural Festival", "type": EventType.SPECIAL_EVENT},
            {"date": date(2025, 8, 29), "title": "End of Month Assembly", "type": EventType.SPECIAL_EVENT},
        ]
        
        # Keep existing Saturday holidays and add new events
        for i in range(1, 32):
            event_date = date(2025, 8, i)
            if event_date.weekday() == 5:  # Saturday
                events_to_create.append(AcademicEvent(
                    title="Saturday Holiday",
                    description="Weekly Saturday holiday",
                    event_type=EventType.HOLIDAY,
                    start_date=event_date,
                    is_all_day=True,
                    holiday_type=HolidayType.FULL_DAY,
                    color_code="#EF4444",  # Red for holidays
                    created_by=admin_user.id
                ))
        
        for holiday in holidays:
            color = "#EF4444" if holiday["type"] == EventType.HOLIDAY else "#3B82F6"  # Red for holidays, Blue for special events
            events_to_create.append(AcademicEvent(
                title=holiday["title"],
                description=f"Special event: {holiday['title']}",
                event_type=holiday["type"],
                start_date=holiday["date"],
                is_all_day=True,
                color_code=color,
                created_by=admin_user.id
            ))
        
        # 4. Lab Sessions (specific days)
        lab_sessions = [
            {"date": date(2025, 8, 2), "subject": "Chemistry", "lab": "Organic Chemistry Lab"},
            {"date": date(2025, 8, 4), "subject": "Physics", "lab": "Electronics Lab"},
            {"date": date(2025, 8, 9), "subject": "Computer Science", "lab": "Programming Lab"},
            {"date": date(2025, 8, 13), "subject": "Chemistry", "lab": "Analytical Chemistry Lab"},
            {"date": date(2025, 8, 16), "subject": "Physics", "lab": "Optics Lab"},
            {"date": date(2025, 8, 20), "subject": "Computer Science", "lab": "Database Lab"},
            {"date": date(2025, 8, 23), "subject": "Chemistry", "lab": "Inorganic Chemistry Lab"},
            {"date": date(2025, 8, 27), "subject": "Physics", "lab": "Mechanics Lab"},
            {"date": date(2025, 8, 30), "subject": "Computer Science", "lab": "Web Development Lab"},
        ]
        
        for lab in lab_sessions:
            subject = next((s for s in subjects if lab["subject"].lower() in s.name.lower()), None)
            if subject:
                events_to_create.append(AcademicEvent(
                    title=lab["lab"],
                    description=f"Hands-on {lab['lab']} session",
                    event_type=EventType.CLASS,
                    start_date=lab["date"],
                    start_time=time(14, 0),
                    end_time=time(17, 0),
                    subject_id=subject.id,
                    faculty_id=subject.faculty_id,
                    class_room=f"Lab {lab['date'].day % 5 + 1}",
                    color_code="#8B5CF6",  # Purple for labs
                    attendance_required=True,
                    created_by=admin_user.id
                ))
        
        # 5. Seminars and Workshops
        seminars = [
            {"date": date(2025, 8, 8), "title": "AI in Education Seminar", "faculty": "Computer Science"},
            {"date": date(2025, 8, 17), "title": "Research Methodology Workshop", "faculty": "Mathematics"},
            {"date": date(2025, 8, 24), "title": "Industry Connect Session", "faculty": "Engineering"},
            {"date": date(2025, 8, 31), "title": "Career Guidance Workshop", "faculty": "General"},
        ]
        
        for seminar in seminars:
            faculty = next((f for f in faculties if seminar["faculty"].lower() in f.name.lower()), faculties[0])
            events_to_create.append(AcademicEvent(
                title=seminar["title"],
                description=f"Educational seminar: {seminar['title']}",
                event_type=EventType.SPECIAL_EVENT,
                start_date=seminar["date"],
                start_time=time(15, 0),
                end_time=time(17, 0),
                faculty_id=faculty.id,
                class_room="Auditorium",
                color_code="#06B6D4",  # Cyan for seminars
                created_by=admin_user.id
            ))
        
        # Add all events to database
        for event in events_to_create:
            db.add(event)
        
        await db.commit()
        
        print(f"✅ Successfully created {len(events_to_create)} calendar events for August 2025!")
        print("\nEvent breakdown:")
        print(f"   📚 Classes: {len([e for e in events_to_create if e.event_type == EventType.CLASS])}")
        print(f"   📝 Exams: {len([e for e in events_to_create if e.event_type == EventType.EXAM])}")
        print(f"   🏖️ Holidays: {len([e for e in events_to_create if e.event_type == EventType.HOLIDAY])}")
        print(f"   🎉 Special Events: {len([e for e in events_to_create if e.event_type == EventType.SPECIAL_EVENT])}")

if __name__ == "__main__":
    asyncio.run(populate_calendar_events())
