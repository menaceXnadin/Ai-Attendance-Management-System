from datetime import datetime, date, timedelta
import calendar

def calculate_semester_academic_days(start_date: date, end_date: date) -> int:
    """
    Calculate total academic days in a semester (excluding weekends and major holidays)
    """
    academic_days = 0
    current_date = start_date
    
    # Define major holidays (you can customize this based on your academic calendar)
    holidays = [
        # Add your institution's holidays here
        # Example: date(2025, 10, 10),  # Dashain holiday
        # date(2025, 11, 12),  # Tihar holiday
    ]
    
    while current_date <= end_date:
        # Skip weekends (Saturday = 5, Sunday = 6 in Python's weekday())
        if current_date.weekday() < 5:  # Monday=0, Friday=4
            # Skip holidays
            if current_date not in holidays:
                academic_days += 1
        current_date += timedelta(days=1)
    
    return academic_days

def get_student_scheduled_days(student_id: int, start_date: date, end_date: date, db_session):
    """
    Get the number of days student was actually scheduled for classes
    (based on their enrolled subjects and class schedules)
    """
    # This would query the student's enrolled subjects and their schedules
    # For now, we'll estimate based on a typical academic schedule
    
    # Typical academic week: 5 days (Mon-Fri)
    total_academic_days = calculate_semester_academic_days(start_date, end_date)
    
    # If student is enrolled in classes, they're expected all academic days
    # You can make this more sophisticated by checking actual class schedules
    return total_academic_days

# Example calculation for current semester (Fall 2025)
if __name__ == "__main__":
    fall_start = date(2025, 8, 1)
    fall_end = date(2025, 12, 15)
    
    total_days = calculate_semester_academic_days(fall_start, fall_end)
    print(f"Total academic days in Fall 2025 semester: {total_days}")
    
    # Calculate weeks
    total_weeks = (fall_end - fall_start).days / 7
    print(f"Total semester weeks: {total_weeks:.1f}")
    print(f"Expected academic days per week: {total_days / total_weeks:.1f}")