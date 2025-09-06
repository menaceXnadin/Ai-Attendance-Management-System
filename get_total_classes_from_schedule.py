"""
Example: Calculate total classes from ClassSchedule table
This is the MOST ACCURATE way to get total classes held
"""

from datetime import date, timedelta
from sqlalchemy import select, and_
from app.models.schedule import ClassSchedule, DayOfWeek

async def get_total_classes_from_schedule(
    db_session,
    semester: int,
    academic_year: int,
    start_date: date,
    end_date: date,
    faculty_id: int = None
) -> int:
    """
    Calculate total classes that SHOULD happen based on class schedule
    
    Args:
        semester: Student semester (1-8)
        academic_year: e.g., 2025
        start_date: Semester start date
        end_date: Semester end date
        faculty_id: Optional filter by faculty
    
    Returns:
        Total number of classes scheduled to happen
    """
    
    # Get all class schedules for this semester/year
    query = select(ClassSchedule).where(
        and_(
            ClassSchedule.semester == semester,
            ClassSchedule.academic_year == academic_year,
            ClassSchedule.is_active == True
        )
    )
    
    if faculty_id:
        query = query.where(ClassSchedule.faculty_id == faculty_id)
    
    result = await db_session.execute(query)
    schedules = result.scalars().all()
    
    total_classes = 0
    
    for schedule in schedules:
        # Count how many times this day occurs between start and end dates
        day_count = count_weekday_occurrences(
            schedule.day_of_week, 
            start_date, 
            end_date
        )
        total_classes += day_count
    
    return total_classes

def count_weekday_occurrences(day_of_week: DayOfWeek, start_date: date, end_date: date) -> int:
    """
    Count how many times a specific weekday occurs between two dates
    
    Example: How many Mondays between Aug 1 and Dec 15?
    """
    # Convert DayOfWeek enum to Python weekday (0=Monday, 6=Sunday)
    weekday_map = {
        DayOfWeek.MONDAY: 0,
        DayOfWeek.TUESDAY: 1,
        DayOfWeek.WEDNESDAY: 2,
        DayOfWeek.THURSDAY: 3,
        DayOfWeek.FRIDAY: 4,
        DayOfWeek.SATURDAY: 5,
        DayOfWeek.SUNDAY: 6
    }
    
    target_weekday = weekday_map[day_of_week]
    
    # Find first occurrence of target weekday
    current_date = start_date
    while current_date <= end_date:
        if current_date.weekday() == target_weekday:
            break
        current_date += timedelta(days=1)
    
    # Count occurrences (every 7 days)
    count = 0
    while current_date <= end_date:
        count += 1
        current_date += timedelta(days=7)
    
    return count

# Example usage:
"""
# For a student in semester 5, academic year 2025
# Between Aug 1, 2025 and Dec 15, 2025

total_scheduled = await get_total_classes_from_schedule(
    db_session=db,
    semester=5,
    academic_year=2025,
    start_date=date(2025, 8, 1),
    end_date=date(2025, 12, 15),
    faculty_id=1  # Computer Science faculty
)

print(f"Total classes scheduled: {total_scheduled}")
# Output: Total classes scheduled: 67
# (This is the REAL total classes for attendance rate calculation)
"""