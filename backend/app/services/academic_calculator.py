"""
Academic Days and Periods Calculator Service

Provides dynamic calculation of total academic days and periods based on:
1. academic_events table (CLASS events with attendance_required=TRUE)
2. class_schedules table (subjects scheduled for each day)
3. Automatic semester detection (Fall/Spring based on calendar dates)

This replaces static counting with dynamic, schedule-aware calculations.
"""

from datetime import date, timedelta
from typing import Dict, List, Tuple, Optional
from sqlalchemy import select, func, and_, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import AcademicEvent, EventType, ClassSchedule, DayOfWeek, Subject, SemesterConfiguration
from app.services.automatic_semester import AutomaticSemesterService


class SemesterService:
    """Service for managing dynamic semester configurations"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_current_semester(self) -> Optional[SemesterConfiguration]:
        """Get the current active semester configuration"""
        query = select(SemesterConfiguration).where(
            and_(
                SemesterConfiguration.is_current == True,
                SemesterConfiguration.is_active == True
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_semester_by_id(self, semester_id: int) -> Optional[SemesterConfiguration]:
        """Get semester configuration by ID"""
        query = select(SemesterConfiguration).where(
            SemesterConfiguration.id == semester_id
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_semester_by_date(self, target_date: date) -> Optional[SemesterConfiguration]:
        """Get semester configuration that contains the given date"""
        query = select(SemesterConfiguration).where(
            and_(
                SemesterConfiguration.start_date <= target_date,
                SemesterConfiguration.end_date >= target_date,
                SemesterConfiguration.is_active == True
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_all_semesters(self, active_only: bool = True) -> List[SemesterConfiguration]:
        """Get all semester configurations"""
        conditions = []
        if active_only:
            conditions.append(SemesterConfiguration.is_active == True)
        
        query = select(SemesterConfiguration)
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.order_by(SemesterConfiguration.academic_year.desc(), 
                              SemesterConfiguration.semester_number.desc())
        
        result = await self.db.execute(query)
        return result.scalars().all()


class AcademicCalculatorService:
    """Service for calculating academic days and periods dynamically"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def calculate_academic_metrics(
        self, 
        start_date: date, 
        end_date: date,
        semester: int = None,
        academic_year: int = None
    ) -> Dict[str, int]:
        """
        Calculate total academic days and periods for a given date range.
        
        Args:
            start_date: Semester start date
            end_date: Semester end date  
            semester: Optional semester filter (1-8)
            academic_year: Optional academic year filter
            
        Returns:
            Dict with total_academic_days and total_periods
        """
        
        # Get all class days (academic events with attendance required)
        class_days = await self._get_class_days(start_date, end_date)
        
        # Get scheduled periods for each class day
        total_periods = await self._calculate_total_periods(
            class_days, semester, academic_year
        )
        
        return {
            "total_academic_days": len(class_days),
            "total_periods": total_periods,
            "class_days_breakdown": [
                {
                    "date": day.strftime("%Y-%m-%d"),
                    "day_of_week": day.strftime("%A").lower(),
                    "periods_count": await self._get_periods_for_day(
                        day, semester, academic_year
                    )
                }
                for day in class_days
            ]
        }
    
    async def _get_class_days(self, start_date: date, end_date: date) -> List[date]:
        """
        Get all dates that are designated as class days.
        
        Returns list of dates where:
        - academic_events.event_type = 'CLASS'
        - academic_events.attendance_required = TRUE
        - academic_events.is_active = TRUE
        """
        
        query = select(AcademicEvent.start_date).where(
            and_(
                AcademicEvent.start_date >= start_date,
                AcademicEvent.start_date <= end_date,
                AcademicEvent.event_type == EventType.CLASS,
                AcademicEvent.attendance_required == True,
                AcademicEvent.is_active == True
            )
        ).order_by(AcademicEvent.start_date)
        
        result = await self.db.execute(query)
        return [row[0] for row in result.fetchall()]
    
    async def _calculate_total_periods(
        self, 
        class_days: List[date], 
        semester: int = None, 
        academic_year: int = None
    ) -> int:
        """
        Calculate total periods across all class days.
        
        Optimized version: Group class days by weekday and make single queries.
        """
        
        if not class_days:
            return 0
        
        # Group class days by day of week for efficient querying
        days_by_weekday = {}
        for class_day in class_days:
            weekday = self._get_day_of_week_enum(class_day)
            if weekday not in days_by_weekday:
                days_by_weekday[weekday] = 0
            days_by_weekday[weekday] += 1
        
        # Get all weekday period counts in a single query
        weekdays = list(days_by_weekday.keys())
        
        conditions = [
            ClassSchedule.day_of_week.in_(weekdays),
            ClassSchedule.is_active == True
        ]
        
        if semester:
            conditions.append(ClassSchedule.semester == semester)
        if academic_year:
            conditions.append(ClassSchedule.academic_year == academic_year)
        
        # Single query to get period counts for all weekdays
        query = select(
            ClassSchedule.day_of_week,
            func.count(distinct(ClassSchedule.subject_id)).label('periods_count')
        ).where(and_(*conditions)).group_by(ClassSchedule.day_of_week)
        
        result = await self.db.execute(query)
        weekday_periods = {row[0]: row[1] for row in result.fetchall()}
        
        # Calculate total periods
        total_periods = 0
        for weekday, day_count in days_by_weekday.items():
            periods_per_day = weekday_periods.get(weekday, 0)
            total_periods += periods_per_day * day_count
        
        return total_periods
    
    async def _get_periods_for_weekday(
        self, 
        weekday: DayOfWeek, 
        semester: int = None, 
        academic_year: int = None
    ) -> int:
        """
        Get number of scheduled periods for a specific weekday.
        
        Counts distinct subjects scheduled on this day of week.
        """
        
        conditions = [
            ClassSchedule.day_of_week == weekday,
            ClassSchedule.is_active == True
        ]
        
        if semester:
            conditions.append(ClassSchedule.semester == semester)
        if academic_year:
            conditions.append(ClassSchedule.academic_year == academic_year)
        
        query = select(func.count(distinct(ClassSchedule.subject_id))).where(
            and_(*conditions)
        )
        
        result = await self.db.execute(query)
        return result.scalar() or 0
    
    async def _get_periods_for_day(
        self, 
        class_date: date, 
        semester: int = None, 
        academic_year: int = None
    ) -> int:
        """Get number of periods scheduled for a specific date."""
        
        weekday = self._get_day_of_week_enum(class_date)
        return await self._get_periods_for_weekday(weekday, semester, academic_year)
    
    def _get_day_of_week_enum(self, date_obj: date) -> DayOfWeek:
        """Convert Python weekday to DayOfWeek enum."""
        
        weekday_mapping = {
            0: DayOfWeek.MONDAY,
            1: DayOfWeek.TUESDAY, 
            2: DayOfWeek.WEDNESDAY,
            3: DayOfWeek.THURSDAY,
            4: DayOfWeek.FRIDAY,
            5: DayOfWeek.SATURDAY,
            6: DayOfWeek.SUNDAY
        }
        
        return weekday_mapping[date_obj.weekday()]
    
    async def get_detailed_schedule_breakdown(
        self, 
        start_date: date, 
        end_date: date,
        semester: int = None,
        academic_year: int = None
    ) -> Dict:
        """
        Get detailed breakdown of academic days with schedule information.
        
        Returns comprehensive data including:
        - Class days with their scheduled subjects
        - Holiday/cancelled days
        - Weekly patterns
        """
        
        # Get class days
        class_days = await self._get_class_days(start_date, end_date)
        
        # Get detailed schedule for each day
        detailed_breakdown = []
        
        for class_day in class_days:
            weekday = self._get_day_of_week_enum(class_day)
            
            # Get scheduled subjects for this day
            conditions = [
                ClassSchedule.day_of_week == weekday,
                ClassSchedule.is_active == True
            ]
            
            if semester:
                conditions.append(ClassSchedule.semester == semester)
            if academic_year:
                conditions.append(ClassSchedule.academic_year == academic_year)
            
            query = select(ClassSchedule).options(
                selectinload(ClassSchedule.subject),
                selectinload(ClassSchedule.faculty)
            ).where(and_(*conditions)).order_by(ClassSchedule.start_time)
            
            result = await self.db.execute(query)
            schedules = result.scalars().all()
            
            detailed_breakdown.append({
                "date": class_day.strftime("%Y-%m-%d"),
                "day_of_week": class_day.strftime("%A"),
                "periods_count": len(schedules),
                "subjects": [
                    {
                        "subject_name": schedule.subject.name if schedule.subject else "Unknown",
                        "start_time": schedule.start_time.strftime("%H:%M"),
                        "end_time": schedule.end_time.strftime("%H:%M"),
                        "classroom": schedule.classroom,
                        "faculty": schedule.faculty.name if schedule.faculty else "Unknown"
                    }
                    for schedule in schedules
                ]
            })
        
        return {
            "total_academic_days": len(class_days),
            "total_periods": sum(day["periods_count"] for day in detailed_breakdown),
            "date_range": {
                "start": start_date.strftime("%Y-%m-%d"),
                "end": end_date.strftime("%Y-%m-%d")
            },
            "daily_breakdown": detailed_breakdown
        }


# Utility functions for common calculations
async def get_semester_academic_metrics(
    db: AsyncSession,
    semester_start: date,
    semester_end: date,
    semester: int = None,
    academic_year: int = None
) -> Dict[str, int]:
    """
    Convenience function to get academic metrics for a semester.
    
    Usage:
        metrics = await get_semester_academic_metrics(
            db, 
            date(2025, 8, 1), 
            date(2025, 12, 15),
            semester=5,
            academic_year=2025
        )
    """
    calculator = AcademicCalculatorService(db)
    return await calculator.calculate_academic_metrics(
        semester_start, semester_end, semester, academic_year
    )


async def get_current_semester_metrics(db: AsyncSession) -> Dict:
    """
    Get metrics for current semester using automatic semester detection.
    
    Returns:
        Dict with academic metrics, semester info, and dates
    """
    # Load override configuration from database (respects 5-min cache)
    await AutomaticSemesterService.load_override_from_db(db)
    
    # Use automatic semester detection (now respects any active override)
    period = AutomaticSemesterService.get_current_period()
    
    calculator = AcademicCalculatorService(db)
    academic_metrics = await calculator.calculate_academic_metrics(
        period.start_date, 
        period.end_date,
        semester=None,  # Not semester-specific, applies to all students
        academic_year=period.academic_year
    )
    
    return {
        **academic_metrics,
        "semester_info": {
            "id": None,  # No database ID (automatic detection)
            "name": period.semester_name,
            "semester_number": None,  # Not specific to one semester
            "academic_year": period.academic_year,
            "is_current": True
        },
        "semester_start_date": period.start_date.strftime("%Y-%m-%d"),
        "semester_end_date": period.end_date.strftime("%Y-%m-%d")
    }


async def get_student_specific_semester_metrics(db: AsyncSession, student_semester: int) -> Dict:
    """
    Get metrics for a specific student using their individual semester number.
    Uses automatic time period dates but filters by the student's actual semester.
    
    This fixes the issue where all students were seeing the same semester data
    regardless of their individual academic progress.
    
    Args:
        db: Database session
        student_semester: The student's individual semester (1-8)
    
    Returns:
        Dict with academic metrics for the student's specific semester
    """
    # Load override configuration from database (respects 5-min cache)
    await AutomaticSemesterService.load_override_from_db(db)
    
    # Use automatic semester detection for time period (now respects any active override)
    period = AutomaticSemesterService.get_current_period()
    
    # Use current time period dates but student's individual semester for filtering
    calculator = AcademicCalculatorService(db)
    academic_metrics = await calculator.calculate_academic_metrics(
        period.start_date, 
        period.end_date,
        semester=student_semester,  # Use student's individual semester, not global config
        academic_year=period.academic_year
    )
    
    return {
        **academic_metrics,
        "semester_info": {
            "id": None,  # No database ID (automatic detection)
            "name": f"Semester {student_semester} - {period.semester_name}",
            "semester_number": student_semester,
            "academic_year": period.academic_year,
            "is_current": True
        },
        "semester_start_date": period.start_date.strftime("%Y-%m-%d"),
        "semester_end_date": period.end_date.strftime("%Y-%m-%d")
    }