#!/usr/bin/env python3
"""
Populate academic_events table with realistic dummy class data
- From August 2025 to January 2026
- Exclude Saturdays (holidays)
- Skip existing event dates
- Create only CLASS type events, no sessions
"""

import asyncio
import sys
import os
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.database import get_db, engine
from app.models.calendar import AcademicEvent, EventType
from app.models import Subject, Faculty, User

class AcademicEventPopulator:
    def __init__(self):
        self.start_date = date(2025, 8, 1)    # August 1, 2025
        self.end_date = date(2026, 1, 31)     # January 31, 2026
        
        # Realistic class titles for different subjects
        self.class_titles = {
            "Computer Science": [
                "Programming Fundamentals",
                "Data Structures & Algorithms", 
                "Database Systems",
                "Object Oriented Programming",
                "Software Engineering",
                "Computer Networks",
                "Operating Systems",
                "Web Development"
            ],
            "Mathematics": [
                "Calculus I",
                "Linear Algebra", 
                "Statistics",
                "Discrete Mathematics",
                "Mathematical Analysis",
                "Probability Theory"
            ],
            "Physics": [
                "Classical Mechanics",
                "Electromagnetism",
                "Quantum Physics",
                "Thermodynamics",
                "Modern Physics"
            ],
            "Business": [
                "Business Management",
                "Marketing Principles",
                "Financial Accounting",
                "Economics",
                "Business Analytics",
                "Strategic Management"
            ]
        }
        
        # Holidays and breaks to exclude
        self.holidays = [
            # Eid holidays
            date(2025, 8, 15),  # Independence Day
            date(2025, 10, 2),   # Gandhi Jayanti
            date(2025, 10, 24),  # Diwali
            date(2025, 11, 14),  # Children's Day
            date(2025, 12, 25),  # Christmas
            date(2026, 1, 1),    # New Year
            date(2026, 1, 26),   # Republic Day
        ]
        
        # Winter break period
        self.winter_break_start = date(2025, 12, 20)
        self.winter_break_end = date(2026, 1, 5)
        
    async def get_existing_event_dates(self, db: AsyncSession) -> set:
        """Get all existing event dates to avoid duplicates"""
        query = select(AcademicEvent.start_date).where(
            and_(
                AcademicEvent.start_date >= self.start_date,
                AcademicEvent.start_date <= self.end_date,
                AcademicEvent.is_active == True
            )
        )
        result = await db.execute(query)
        return set(row[0] for row in result.fetchall())
    
    async def get_faculties_and_subjects(self, db: AsyncSession):
        """Get available faculties and subjects"""
        # Get faculties
        faculty_query = select(Faculty)
        faculty_result = await db.execute(faculty_query)
        faculties = faculty_result.scalars().all()
        
        # Get subjects
        subject_query = select(Subject)
        subject_result = await db.execute(subject_query)
        subjects = subject_result.scalars().all()
        
        # Get a default admin user for created_by
        user_query = select(User).limit(1)
        user_result = await db.execute(user_query)
        default_user = user_result.scalar_one_or_none()
        
        return faculties, subjects, default_user
    
    def is_valid_class_date(self, check_date: date) -> bool:
        """Check if date is valid for classes (no Saturdays, holidays, or breaks)"""
        # Skip Saturdays (5 = Saturday in Python's weekday)
        if check_date.weekday() == 5:
            return False
            
        # Skip holidays
        if check_date in self.holidays:
            return False
            
        # Skip winter break
        if self.winter_break_start <= check_date <= self.winter_break_end:
            return False
            
        return True
    
    async def create_academic_events(self, db: AsyncSession):
        """Create academic events for valid class dates"""
        print("🚀 Starting Academic Events Population...")
        
        # Get existing data
        existing_dates = await self.get_existing_event_dates(db)
        faculties, subjects, default_user = await self.get_faculties_and_subjects(db)
        
        if not default_user:
            print("❌ No user found! Please ensure you have at least one user in the database.")
            return
            
        print(f"📅 Date range: {self.start_date} to {self.end_date}")
        print(f"🏫 Found {len(faculties)} faculties, {len(subjects)} subjects")
        print(f"⏭️  Skipping {len(existing_dates)} existing event dates")
        
        events_created = 0
        current_date = self.start_date
        
        # Create subject-faculty mapping for realistic classes
        subject_faculty_map = {}
        for i, subject in enumerate(subjects):
            faculty = faculties[i % len(faculties)] if faculties else None
            subject_faculty_map[subject.id] = faculty
        
        while current_date <= self.end_date:
            # Skip invalid dates
            if not self.is_valid_class_date(current_date):
                current_date += timedelta(days=1)
                continue
                
            # Skip existing event dates
            if current_date in existing_dates:
                print(f"⏭️  Skipping existing event on {current_date}")
                current_date += timedelta(days=1)
                continue
            
            # Create 2-4 classes per valid day
            classes_per_day = 3 if current_date.weekday() < 3 else 2  # More classes Mon-Wed
            
            for class_num in range(classes_per_day):
                if subjects:
                    # Select subject cyclically
                    subject = subjects[(events_created + class_num) % len(subjects)]
                    faculty = subject_faculty_map.get(subject.id)
                    
                    # Get appropriate class title based on subject/faculty
                    faculty_name = faculty.name if faculty else "General"
                    subject_key = self.get_subject_category(subject.name)
                    class_titles = self.class_titles.get(subject_key, ["Regular Class"])
                    class_title = class_titles[(events_created + class_num) % len(class_titles)]
                    
                    # Create the event
                    event = AcademicEvent(
                        title=f"{class_title}",
                        description=f"{subject.name} - {subject.code}\nFaculty: {faculty_name}\nDate: {current_date.strftime('%A, %B %d, %Y')}",
                        event_type=EventType.CLASS,
                        start_date=current_date,
                        end_date=current_date,  # Same day event
                        start_time=self.get_class_time(class_num),
                        end_time=self.get_class_end_time(class_num),
                        is_all_day=False,
                        subject_id=subject.id,
                        faculty_id=faculty.id if faculty else None,
                        class_room=f"Room {100 + (class_num * 10) + (current_date.day % 5)}",
                        color_code="#10B981",  # Green for classes
                        is_recurring=False,
                        created_by=default_user.id,
                        attendance_required=True,
                        is_active=True
                    )
                    
                    db.add(event)
                    events_created += 1
            
            # Commit every 20 days to avoid large transactions
            if events_created % 60 == 0:  # ~20 days * 3 classes
                await db.commit()
                print(f"💾 Committed {events_created} events... (Date: {current_date})")
            
            current_date += timedelta(days=1)
        
        # Final commit
        await db.commit()
        print(f"✅ Successfully created {events_created} academic events!")
        print(f"📊 Coverage: {self.start_date} to {self.end_date}")
        print(f"🚫 Excluded Saturdays, holidays, and winter break")
        
    def get_subject_category(self, subject_name: str) -> str:
        """Map subject name to category for appropriate class titles"""
        subject_lower = subject_name.lower()
        if any(word in subject_lower for word in ['computer', 'programming', 'software', 'web', 'database']):
            return "Computer Science"
        elif any(word in subject_lower for word in ['math', 'calculus', 'algebra', 'statistics']):
            return "Mathematics" 
        elif any(word in subject_lower for word in ['physics', 'mechanics', 'quantum']):
            return "Physics"
        elif any(word in subject_lower for word in ['business', 'management', 'marketing', 'finance']):
            return "Business"
        else:
            return "Computer Science"  # Default
    
    def get_class_time(self, class_num: int):
        """Get realistic class start times"""
        times = [
            datetime.strptime("09:00", "%H:%M").time(),  # 9:00 AM
            datetime.strptime("11:00", "%H:%M").time(),  # 11:00 AM  
            datetime.strptime("14:00", "%H:%M").time(),  # 2:00 PM
            datetime.strptime("16:00", "%H:%M").time(),  # 4:00 PM
        ]
        return times[class_num % len(times)]
    
    def get_class_end_time(self, class_num: int):
        """Get realistic class end times (1.5 hour classes)"""
        times = [
            datetime.strptime("10:30", "%H:%M").time(),  # 10:30 AM
            datetime.strptime("12:30", "%H:%M").time(),  # 12:30 PM
            datetime.strptime("15:30", "%H:%M").time(),  # 3:30 PM
            datetime.strptime("17:30", "%H:%M").time(),  # 5:30 PM
        ]
        return times[class_num % len(times)]

async def main():
    """Main function to populate academic events"""
    try:
        # Get database session
        async with AsyncSession(engine) as db:
            populator = AcademicEventPopulator()
            await populator.create_academic_events(db)
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("📚 Academic Events Populator")
    print("=" * 50)
    asyncio.run(main())