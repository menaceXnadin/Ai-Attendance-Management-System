"""
Advanced Streak and Badges System
Comprehensive, robust logic for calculating attendance streaks and awarding badges
"""

from sqlalchemy import select, and_, func, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AttendanceRecord, Student, AcademicEvent, EventType, ClassSchedule
from datetime import date, timedelta, datetime
from typing import Dict, List, Tuple, Optional
from collections import defaultdict
import traceback


class StreakCalculator:
    """
    Advanced streak calculation engine with multiple strategies
    """
    
    @staticmethod
    async def calculate_comprehensive_streaks(
        db: AsyncSession, 
        student_id: int,
        calculation_period_days: int = 180  # 6 months default
    ) -> Dict:
        """
        Calculate ALL streak metrics with advanced logic
        
        Returns:
            Dict containing:
            - current_streak: Current consecutive present days
            - longest_streak: Longest consecutive present days ever
            - current_week_streak: Days present this week
            - monthly_streaks: Streak data per month
            - streak_history: Daily streak progression
            - is_streak_active: Whether streak is currently active
        """
        try:
            # Get student info
            student_query = select(Student).where(Student.id == student_id)
            result = await db.execute(student_query)
            student = result.scalar_one_or_none()
            
            if not student:
                return _empty_streak_data()
            
            # Calculate date range
            end_date = date.today()
            start_date = end_date - timedelta(days=calculation_period_days)
            
            # Fetch all attendance records in period
            records_query = select(AttendanceRecord).where(
                and_(
                    AttendanceRecord.student_id == student_id,
                    func.date(AttendanceRecord.date) >= start_date,
                    func.date(AttendanceRecord.date) <= end_date
                )
            ).order_by(AttendanceRecord.date)
            
            result = await db.execute(records_query)
            all_records = result.scalars().all()
            
            # Fetch academic events (CLASS days) in period
            events_query = select(AcademicEvent).where(
                and_(
                    AcademicEvent.start_date >= start_date,
                    AcademicEvent.start_date <= end_date,
                    AcademicEvent.event_type == EventType.CLASS,
                    or_(
                        AcademicEvent.faculty_id == student.faculty_id,
                        AcademicEvent.faculty_id == None
                    )
                )
            ).order_by(AcademicEvent.start_date)
            
            result = await db.execute(events_query)
            class_events = result.scalars().all()
            
            # Build day-by-day status map
            day_status_map = await _build_day_status_map(
                db, student, all_records, class_events, start_date, end_date
            )
            
            # Calculate streaks
            current_streak = _calculate_current_streak(day_status_map, end_date)
            longest_streak = _calculate_longest_streak(day_status_map)
            current_week_streak = _calculate_current_week_streak(day_status_map, end_date)
            monthly_streaks = _calculate_monthly_streaks(day_status_map)
            streak_history = _build_streak_history(day_status_map)
            
            # Determine if streak is active (attended today or last class day)
            is_streak_active = _is_streak_currently_active(day_status_map, end_date)
            
            # Compute class-day totals excluding neutral days
            effective_days = len([d for d, s in day_status_map.items() if s not in ['no_class', 'cancelled']])
            present_days = len([d for d, s in day_status_map.items() if s in ['present', 'partial']])

            return {
                'current_streak': current_streak,
                'longest_streak': longest_streak,
                'current_week_streak': current_week_streak,
                'monthly_streaks': monthly_streaks,
                'streak_history': streak_history,
                'is_streak_active': is_streak_active,
                'total_class_days': effective_days,  # exclude neutral days like fully-cancelled
                'total_present_days': present_days,
                'calculation_period_days': calculation_period_days,
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            }
            
        except Exception as e:
            print(f"[ERROR] Streak calculation failed: {str(e)}")
            print(traceback.format_exc())
            return _empty_streak_data()


class BadgeSystem:
    """
    Advanced badge awarding system with tiered achievements
    """
    
    @staticmethod
    async def calculate_earned_badges(
        db: AsyncSession,
        student_id: int,
        streak_data: Dict
    ) -> List[Dict]:
        """
        Calculate ALL earned badges based on attendance performance
        
        Badge Categories:
        1. Attendance Rate Badges
        2. Streak Badges
        3. Consistency Badges
        4. Improvement Badges
        5. Special Achievement Badges
        """
        badges = []
        
        # Calculate attendance rate from streak data (uses day-based calculation, not record-based)
        # This is the CORRECT method: count unique days, not individual subject records
        total_class_days = streak_data.get('total_class_days', 0)
        total_present_days = streak_data.get('total_present_days', 0)
        attendance_rate = round((total_present_days / total_class_days * 100), 2) if total_class_days > 0 else 0
        
        # Create stats dict with corrected attendance_rate for consistency badges
        stats = {
            'total_classes': total_class_days,
            'present_count': total_present_days,
            'attendance_rate': attendance_rate
        }
        
        # 1. ATTENDANCE RATE BADGES (using corrected day-based rate)
        badges.extend(_award_attendance_rate_badges(attendance_rate))
        
        # 2. STREAK BADGES
        badges.extend(_award_streak_badges(streak_data))
        
        # 3. CONSISTENCY BADGES
        badges.extend(_award_consistency_badges(streak_data, stats))
        
        # 4. IMPROVEMENT BADGES
        badges.extend(await _award_improvement_badges(db, student_id, stats))
        
        # 5. SPECIAL ACHIEVEMENT BADGES
        badges.extend(await _award_special_badges(db, student_id, stats, streak_data))
        
        return badges


# Helper Functions

async def _build_day_status_map(
    db: AsyncSession,
    student: Student,
    all_records: List[AttendanceRecord],
    class_events: List[AcademicEvent],
    start_date: date,
    end_date: date
) -> Dict[date, str]:
    """
    Build comprehensive day-by-day status map
    
    Status Values:
    - 'present': Fully attended (all/most classes)
    - 'partial': Partially attended (some classes)
    - 'absent': Missed classes
    - 'no_class': No classes scheduled
    - 'holiday': Holiday/weekend
    - 'late': late absence
    """
    day_status_map = {}
    
    # Group records by date
    records_by_date = defaultdict(list)
    for record in all_records:
        record_date = record.date.date() if hasattr(record.date, 'date') else record.date
        records_by_date[record_date].append(record)
    
    # Map of class days
    class_days = set()
    for event in class_events:
        if event.event_type == EventType.CLASS:
            class_days.add(event.start_date)
    
    # Get expected subjects per day (from class schedule)
    weekday_subjects_count = await _get_weekday_subject_counts(db, student)
    
    # Identify dates where classes were ACTUALLY HELD (not just scheduled)
    # CRITICAL: Only count days where attendance was RECORDED as proof classes happened
    # Do NOT use CLASS events - they mark all weekdays as potential class days
    dates_with_actual_classes = set()
    
    # ONLY add dates where attendance was recorded (concrete evidence classes happened)
    for record_date in records_by_date.keys():
        dates_with_actual_classes.add(record_date)
    
    # Process each day in period - BUT ONLY INCLUDE DAYS WHERE CLASSES ACTUALLY HAPPENED 
    current = start_date
    while current <= end_date:
        # Check if classes were actually held on this day
        is_actual_class_day = current in dates_with_actual_classes
        
        if not is_actual_class_day:
            # Don't include this day in the map at all if no classes were held
            # This prevents counting scheduled but non-existent class days
            current += timedelta(days=1)
            continue
        
        # If we're here, classes were actually held on this day
        weekday_name = current.strftime('%A').upper()
        expected_subjects = weekday_subjects_count.get(weekday_name, 0)
        
        # Analyze attendance records for this day
        day_records = records_by_date.get(current, [])
        
        if len(day_records) == 0:
            # No records but classes were held (CLASS event exists) = absent
            if current < date.today():
                day_status_map[current] = 'absent'
            else:
                day_status_map[current] = 'no_data'
        else:
            # Calculate day status based on records
            present_count = sum(1 for r in day_records if r.status.value == 'present')
            cancelled_count = sum(1 for r in day_records if r.status.value == 'cancelled')
            late_count = sum(1 for r in day_records if r.status.value == 'late')
            total_records = len(day_records)
            # NEW: If all records are cancelled -> treat as neutral day (doesn't break streak or count in totals)
            if cancelled_count == total_records and total_records > 0:
                day_status_map[current] = 'cancelled'
                current += timedelta(days=1)
                continue
            
            if late_count > 0 and late_count == total_records:
                day_status_map[current] = 'late'
            elif expected_subjects > 0 and present_count >= expected_subjects * 0.8:  # 80% threshold
                day_status_map[current] = 'present'
            elif present_count > 0:
                day_status_map[current] = 'partial'
            else:
                day_status_map[current] = 'absent'
        
        current += timedelta(days=1)
    
    return day_status_map


async def _get_weekday_subject_counts(
    db: AsyncSession,
    student: Student
) -> Dict[str, int]:
    """Get number of subjects scheduled for each weekday"""
    schedule_query = select(
        ClassSchedule.day_of_week,
        func.count(func.distinct(ClassSchedule.subject_id))
    ).where(
        and_(
            ClassSchedule.faculty_id == student.faculty_id,
            ClassSchedule.semester == student.semester,
            ClassSchedule.is_active == True
        )
    ).group_by(ClassSchedule.day_of_week)
    
    result = await db.execute(schedule_query)
    rows = result.all()
    
    return {
        row[0].name if hasattr(row[0], 'name') else str(row[0]).upper(): row[1]
        for row in rows
    }


def _calculate_current_streak(day_status_map: Dict[date, str], end_date: date) -> int:
    """Calculate current active streak counting backwards from today"""
    streak = 0
    current = end_date
    
    while current >= min(day_status_map.keys()) if day_status_map else end_date:
        # Skip days not in our map (no classes held)
        if current not in day_status_map:
            current -= timedelta(days=1)
            continue
        
        status = day_status_map[current]
        
        # Only 'present' continues streak; neutral days ('no_class', 'cancelled') do not break streak
        if status == 'present':
            streak += 1
        elif status in ['no_class', 'cancelled']:
            current -= timedelta(days=1)
            continue
        else:
            # Partial, late, absent, or no_data breaks the streak
            break
        
        current -= timedelta(days=1)
    
    return streak


def _calculate_longest_streak(day_status_map: Dict[date, str]) -> int:
    """Calculate longest streak considering only class days; neutral days don't reset."""
    if not day_status_map:
        return 0
    longest = 0
    current_streak = 0
    for day in sorted(day_status_map.keys()):
        status = day_status_map[day]
        if status == 'present':
            current_streak += 1
            longest = max(longest, current_streak)
        elif status in ['no_class', 'cancelled']:
            # Neutral day: do not change the streak
            continue
        else:
            current_streak = 0
    return longest


def _calculate_current_week_streak(day_status_map: Dict[date, str], end_date: date) -> int:
    """Calculate streak within current week only"""
    week_start = end_date - timedelta(days=end_date.weekday())
    
    streak = 0
    for i in range(7):
        day = week_start + timedelta(days=i)
        if day in day_status_map:
            status = day_status_map[day]
            if status == 'present':
                streak += 1
    
    return streak


def _calculate_monthly_streaks(day_status_map: Dict[date, str]) -> List[Dict]:
    """Calculate streak data for each month"""
    monthly_data = defaultdict(lambda: {'streak': 0, 'max_streak': 0, 'present_days': 0})
    
    for day, status in sorted(day_status_map.items()):
        month_key = day.strftime('%Y-%m')
        
        if status == 'no_class':
            continue
        
        if status in ['present', 'late']:
            monthly_data[month_key]['present_days'] += 1
    
    return [
        {'month': month, **data}
        for month, data in sorted(monthly_data.items())
    ]


def _build_streak_history(day_status_map: Dict[date, str]) -> List[Dict]:
    """Build day-by-day streak progression"""
    history = []
    current_streak = 0
    last_date = None
    
    for day in sorted(day_status_map.keys()):
        status = day_status_map[day]
        
        if status == 'no_class':
            continue
        
        # Check for date gaps
        if last_date is not None and day > last_date + timedelta(days=1):
            current_streak = 0
        
        if status == 'present':
            current_streak += 1
        else:
            current_streak = 0
        
        history.append({
            'date': day.isoformat(),
            'status': status,
            'streak_at_day': current_streak
        })
        
        last_date = day
    
    return history


def _is_streak_currently_active(day_status_map: Dict[date, str], end_date: date) -> bool:
    """Determine if streak is active (attended most recent class day)"""
    current = end_date
    
    # Look back up to 7 days for last class day
    for _ in range(7):
        if current in day_status_map:
            status = day_status_map[current]
            if status != 'no_class':
                return status == 'present'
        current -= timedelta(days=1)
    
    return False


async def _get_student_comprehensive_stats(db: AsyncSession, student_id: int) -> Dict:
    """Get comprehensive statistics for badge calculations"""
    # Total records
    total_query = select(func.count(AttendanceRecord.id)).where(
        AttendanceRecord.student_id == student_id
    )
    result = await db.execute(total_query)
    total = result.scalar() or 0
    
    # Present count
    present_query = select(func.count(AttendanceRecord.id)).where(
        and_(
            AttendanceRecord.student_id == student_id,
            or_(
                AttendanceRecord.status == 'present',
                AttendanceRecord.status == 'late'
            )
        )
    )
    result = await db.execute(present_query)
    present = result.scalar() or 0
    
    attendance_rate = round((present / total * 100), 2) if total > 0 else 0
    
    return {
        'total_classes': total,
        'present_count': present,
        'attendance_rate': attendance_rate
    }


def _award_attendance_rate_badges(attendance_rate: float) -> List[Dict]:
    """Award badges based on attendance percentage"""
    badges = []
    
    if attendance_rate >= 100:
        badges.append({
            'id': 'perfect_attendance',
            'name': 'Perfect Attendance',
            'description': '100% attendance rate',
            'tier': 'legendary',
            'icon': '🏆',
            'color': 'gold'
        })
    elif attendance_rate >= 95:
        badges.append({
            'id': 'excellent_attendance',
            'name': 'Excellent Attendance',
            'description': '95%+ attendance rate',
            'tier': 'epic',
            'icon': '🥇',
            'color': 'purple'
        })
    elif attendance_rate >= 90:
        badges.append({
            'id': 'great_attendance',
            'name': 'Great Attendance',
            'description': '90%+ attendance rate',
            'tier': 'rare',
            'icon': '🥈',
            'color': 'blue'
        })
    elif attendance_rate >= 80:
        badges.append({
            'id': 'good_attendance',
            'name': 'Good Attendance',
            'description': '80%+ attendance rate',
            'tier': 'uncommon',
            'icon': '⭐',
            'color': 'green'
        })
    elif attendance_rate >= 75:
        badges.append({
            'id': 'passing_attendance',
            'name': 'Meeting Requirements',
            'description': '75%+ attendance rate',
            'tier': 'common',
            'icon': '✓',
            'color': 'gray'
        })
    
    return badges


def _award_streak_badges(streak_data: Dict) -> List[Dict]:
    """Award badges based on streak achievements"""
    badges = []
    current_streak = streak_data['current_streak']
    longest_streak = streak_data['longest_streak']
    
    # Current streak badges
    if current_streak >= 60:
        badges.append({
            'id': 'legendary_streak',
            'name': 'Legendary Streak',
            'description': '60+ consecutive days',
            'tier': 'legendary',
            'icon': '👑',
            'color': 'gold'
        })
    elif current_streak >= 30:
        badges.append({
            'id': 'super_streak',
            'name': 'Super Streak',
            'description': '30+ consecutive days',
            'tier': 'epic',
            'icon': '🔥',
            'color': 'red'
        })
    elif current_streak >= 14:
        badges.append({
            'id': 'hot_streak',
            'name': 'Hot Streak',
            'description': '14+ consecutive days',
            'tier': 'rare',
            'icon': '🔥',
            'color': 'orange'
        })
    elif current_streak >= 7:
        badges.append({
            'id': 'weekly_streak',
            'name': 'Weekly Streak',
            'description': '7+ consecutive days',
            'tier': 'uncommon',
            'icon': '📅',
            'color': 'yellow'
        })
    
    # Longest streak badge (historical)
    if longest_streak >= 90:
        badges.append({
            'id': 'marathon_runner',
            'name': 'Marathon Runner',
            'description': 'Achieved 90+ day streak',
            'tier': 'legendary',
            'icon': '🏃',
            'color': 'gold'
        })
    
    return badges


def _award_consistency_badges(streak_data: Dict, stats: Dict) -> List[Dict]:
    """Award badges for consistent attendance patterns"""
    badges = []
    
    # Check if attended most days
    attendance_rate = stats['attendance_rate']
    current_streak = streak_data['current_streak']
    
    if attendance_rate >= 90 and current_streak >= 14:
        badges.append({
            'id': 'consistent_performer',
            'name': 'Consistent Performer',
            'description': 'High attendance with active streak',
            'tier': 'rare',
            'icon': '📈',
            'color': 'blue'
        })
    
    return badges


async def _award_improvement_badges(db: AsyncSession, student_id: int, stats: Dict) -> List[Dict]:
    """Award badges for improving attendance over time"""
    badges = []
    
    # Calculate recent vs historical performance
    # (Implementation would compare last 30 days vs previous 30 days)
    
    return badges


async def _award_special_badges(
    db: AsyncSession, 
    student_id: int, 
    stats: Dict, 
    streak_data: Dict
) -> List[Dict]:
    """Award special achievement badges"""
    badges = []
    
    # Early bird badge (attended morning classes consistently)
    # Weekend warrior (attended weekend classes)
    # Comeback king (improved after low attendance)
    
    return badges


def _empty_streak_data() -> Dict:
    """Return empty streak data structure"""
    return {
        'current_streak': 0,
        'longest_streak': 0,
        'current_week_streak': 0,
        'monthly_streaks': [],
        'streak_history': [],
        'is_streak_active': False,
        'total_class_days': 0,
        'total_present_days': 0,
        'calculation_period_days': 0,
        'start_date': None,
        'end_date': None
    }

