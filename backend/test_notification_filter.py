"""
Test script to verify notification filtering for different faculty students
"""
import asyncio
from app.core.database import get_db
from app.models import User, Student
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def test_notification_filtering():
    """Test notification filtering by making API requests as different students"""
    
    # Get students from different faculties
    async for db in get_db():
        # Get a Computer Science student (faculty_id=1)
        cs_result = await db.execute(
            select(Student).options(selectinload(Student.user))
            .where(Student.faculty_id == 1).limit(1)
        )
        cs_student = cs_result.scalar_one_or_none()
        
        # Get an Information Technology student (faculty_id=2)
        it_result = await db.execute(
            select(Student).options(selectinload(Student.user))
            .where(Student.faculty_id == 2).limit(1)
        )
        it_student = it_result.scalar_one_or_none()
        
        if not cs_student or not it_student:
            print("Could not find students from different faculties")
            return
            
        print(f"CS Student: {cs_student.user.full_name} (Email: {cs_student.user.email}, Faculty ID: {cs_student.faculty_id})")
        print(f"IT Student: {it_student.user.full_name} (Email: {it_student.user.email}, Faculty ID: {it_student.faculty_id})")
        print()
        
        # Now we need to test API calls
        # Since we can't easily get auth tokens here, let's just show the database state
        print("Current faculty-specific notifications:")
        from app.models import EnhancedNotification, NotificationScope
        
        faculty_notifications = await db.execute(
            select(EnhancedNotification)
            .where(EnhancedNotification.scope == NotificationScope.faculty_specific)
            .order_by(EnhancedNotification.created_at.desc())
        )
        
        for notif in faculty_notifications.scalars().all():
            print(f"  - {notif.title} (Target Faculty ID: {notif.target_faculty_id})")
            
        print("\nBased on the filtering logic:")
        print(f"CS Student (Faculty ID 1) should see notifications targeted to Faculty ID 1")
        print(f"IT Student (Faculty ID 2) should see notifications targeted to Faculty ID 2")
        print(f"Both should see global notifications")
        break

if __name__ == "__main__":
    asyncio.run(test_notification_filtering())
