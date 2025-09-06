#!/usr/bin/env python3
"""
Script to automatically create Saturday holidays in the academic calendar
This will populate Saturdays as holidays for the entire academic year
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, timedelta
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.calendar import AcademicEvent, EventType
from app.models import User, UserRole

def create_saturday_holidays(start_date: date, end_date: date, admin_user_id: int, db: Session):
    """
    Create holiday events for all Saturdays between start_date and end_date
    """
    created_count = 0
    current_date = start_date
    
    # Find the first Saturday
    while current_date.weekday() != 5:  # 5 = Saturday
        current_date += timedelta(days=1)
        if current_date > end_date:
            break
    
    # Create Saturday holidays
    while current_date <= end_date:
        # Check if holiday already exists for this Saturday
        existing_holiday = db.query(AcademicEvent).filter(
            AcademicEvent.start_date == current_date,
            AcademicEvent.event_type == EventType.HOLIDAY,
            AcademicEvent.title.ilike("%saturday%")
        ).first()
        
        if not existing_holiday:
            saturday_holiday = AcademicEvent(
                title="Saturday Holiday",
                description="Weekly Saturday holiday - No classes scheduled",
                event_type=EventType.HOLIDAY,
                start_date=current_date,
                is_all_day=True,
                color_code="#EF4444",  # Red color for holidays
                created_by=admin_user_id,
                attendance_required=False
            )
            
            db.add(saturday_holiday)
            created_count += 1
            print(f"Created Saturday holiday for {current_date}")
        else:
            print(f"Saturday holiday already exists for {current_date}")
        
        # Move to next Saturday
        current_date += timedelta(days=7)
    
    return created_count

def main():
    """
    Main function to create Saturday holidays for the academic year
    """
    # Import the SessionLocal directly
    from app.core.database import SessionLocal
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Find an admin user to create holidays
        admin_user = db.query(User).filter(User.role == UserRole.admin).first()
        if not admin_user:
            print("No admin user found. Please create an admin user first.")
            return
        
        # Define academic year period (adjust dates as needed)
        current_year = date.today().year
        start_date = date(current_year, 1, 1)  # January 1st
        end_date = date(current_year, 12, 31)  # December 31st
        
        print(f"Creating Saturday holidays from {start_date} to {end_date}")
        print(f"Using admin user: {admin_user.full_name} (ID: {admin_user.id})")
        
        created_count = create_saturday_holidays(start_date, end_date, admin_user.id, db)
        
        # Commit the changes
        db.commit()
        print(f"\nSuccessfully created {created_count} Saturday holidays!")
        
        # Also create for next year if we're in the last quarter
        if date.today().month >= 10:
            next_year = current_year + 1
            next_start = date(next_year, 1, 1)
            next_end = date(next_year, 12, 31)
            
            print(f"\nAlso creating Saturday holidays for next year: {next_year}")
            next_year_count = create_saturday_holidays(next_start, next_end, admin_user.id, db)
            db.commit()
            print(f"Created {next_year_count} Saturday holidays for {next_year}")
        
    except Exception as e:
        print(f"Error creating Saturday holidays: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
