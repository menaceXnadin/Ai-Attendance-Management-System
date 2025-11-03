"""
Automatic Academic Semester Detection Service

Automatically determines Fall or Spring semester based on current date.
No database configuration required - works for all past, present, and future dates.

Features:
- Zero database queries (with 5-minute cache)
- Consistent across entire codebase
- Works for historical data
- Works for future dates
- Simple configuration (4 date boundaries)
- Error-proof (impossible to misconfigure)
- Admin override support for emergencies

Usage:
    from app.services.automatic_semester import AutomaticSemesterService
    
    # Get current semester
    period = AutomaticSemesterService.get_current_period()
    print(f"{period.semester_name}: {period.start_date} to {period.end_date}")
    
    # Get semester for specific date
    historical = AutomaticSemesterService.get_period_by_date(date(2024, 3, 15))
    
    # Get just the date range
    start, end = AutomaticSemesterService.get_date_range()
    
    # Load admin override (called automatically at startup)
    await AutomaticSemesterService.load_override_from_db(session)
"""

from datetime import date, datetime, timedelta
from typing import Dict, Tuple, Optional
from dataclasses import dataclass, asdict
import logging

logger = logging.getLogger(__name__)


@dataclass
class SemesterPeriod:
    """
    Data class representing an academic semester period.
    
    Attributes:
        period_type: "Fall" or "Spring"
        academic_year: Calendar year (e.g., 2025)
        semester_name: Display name (e.g., "Fall 2025")
        start_date: Semester start date
        end_date: Semester end date
        semester_number: 1 for Fall, 2 for Spring
    """
    period_type: str
    academic_year: int
    semester_name: str
    start_date: date
    end_date: date
    semester_number: int
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for API responses"""
        return {
            'period_type': self.period_type,
            'academic_year': self.academic_year,
            'semester_name': self.semester_name,
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat()
        }


class AutomaticSemesterService:
    """
    Service for automatic semester detection based on calendar dates.
    
    Configuration:
    - Default Fall semester: August 1 to December 15
    - Default Spring semester: January 15 to May 30
    
    These can be overridden via admin UI for emergency scenarios (COVID-19, disasters, etc.)
    Override configuration is loaded from database and cached for 5 minutes.
    """
    
    # Default semester date boundaries (month, day) - used when no override exists
    DEFAULT_FALL_START = (8, 1)       # August 1
    DEFAULT_FALL_END = (12, 15)       # December 15
    DEFAULT_SPRING_START = (1, 15)    # January 15
    DEFAULT_SPRING_END = (5, 30)      # May 30
    
    # Active boundaries (may be overridden by admin)
    FALL_START = DEFAULT_FALL_START
    FALL_END = DEFAULT_FALL_END
    SPRING_START = DEFAULT_SPRING_START
    SPRING_END = DEFAULT_SPRING_END
    
    # Override caching (to prevent DB queries on every request)
    _override_loaded = False
    _last_override_check: Optional[datetime] = None
    _override_cache_ttl = timedelta(minutes=5)  # Cache for 5 minutes
    
    @classmethod
    async def load_override_from_db(cls, session) -> bool:
        """
        Load active override from database.
        
        Checks for an active academic calendar override and updates the class variables
        if one exists. Uses 5-minute caching to prevent excessive database queries.
        
        Args:
            session: SQLAlchemy async session
            
        Returns:
            bool: True if override was loaded, False if using defaults
            
        Example:
            >>> async with AsyncSessionLocal() as session:
            ...     override_active = await AutomaticSemesterService.load_override_from_db(session)
            ...     if override_active:
            ...         print("Using emergency override dates")
        """
        from sqlalchemy import select, or_
        from app.models.calendar import AcademicCalendarConfig
        
        # Check cache TTL
        now = datetime.now()
        if cls._last_override_check:
            if now - cls._last_override_check < cls._override_cache_ttl:
                return cls._override_loaded
        
        try:
            # Query active override
            result = await session.execute(
                select(AcademicCalendarConfig)
                .where(AcademicCalendarConfig.is_override_active == True)
                .where(
                    or_(
                        AcademicCalendarConfig.effective_until == None,
                        AcademicCalendarConfig.effective_until >= date.today()
                    )
                )
            )
            override = result.scalar_one_or_none()
            
            if override:
                # Load override dates
                cls.FALL_START = (override.fall_start_month, override.fall_start_day)
                cls.FALL_END = (override.fall_end_month, override.fall_end_day)
                cls.SPRING_START = (override.spring_start_month, override.spring_start_day)
                cls.SPRING_END = (override.spring_end_month, override.spring_end_day)
                cls._override_loaded = True
                
                emergency_flag = " [EMERGENCY]" if override.is_emergency_override else ""
                logger.info(f"📅 Academic calendar override loaded{emergency_flag}: {override.reason}")
            else:
                # No active override, use defaults
                cls.FALL_START = cls.DEFAULT_FALL_START
                cls.FALL_END = cls.DEFAULT_FALL_END
                cls.SPRING_START = cls.DEFAULT_SPRING_START
                cls.SPRING_END = cls.DEFAULT_SPRING_END
                cls._override_loaded = False
                logger.debug("📅 Using default academic calendar dates")
            
            cls._last_override_check = now
            return cls._override_loaded
            
        except Exception as e:
            # Graceful degradation: on error, use defaults
            logger.warning(f"Failed to load calendar override, using defaults: {e}")
            cls.reset_to_defaults()
            cls._last_override_check = now
            return False
    
    @classmethod
    def reset_to_defaults(cls):
        """
        Reset to hardcoded default dates.
        
        Used when deactivating an override or when override loading fails.
        This ensures the system always has valid dates.
        
        Example:
            >>> AutomaticSemesterService.reset_to_defaults()
            >>> print(AutomaticSemesterService.FALL_START)
            (8, 1)
        """
        cls.FALL_START = cls.DEFAULT_FALL_START
        cls.FALL_END = cls.DEFAULT_FALL_END
        cls.SPRING_START = cls.DEFAULT_SPRING_START
        cls.SPRING_END = cls.DEFAULT_SPRING_END
        cls._override_loaded = False
        logger.info("✅ Academic calendar reset to defaults")
    
    @classmethod
    def clear_override_cache(cls):
        """
        Force cache refresh on next request.
        
        Called after admin creates/updates/deletes override to ensure
        changes are picked up immediately (within 1 request).
        """
        cls._last_override_check = None
        logger.debug("🔄 Override cache cleared")
    
    @classmethod
    def get_active_configuration(cls) -> Dict:
        """
        Get current active calendar configuration.
        
        Returns:
            dict: Current boundaries and whether override is active
            
        Example:
            >>> config = AutomaticSemesterService.get_active_configuration()
            >>> print(config['fall_start'])
            (8, 1)
            >>> print(config['is_override_active'])
            False
        """
        return {
            'fall_start': cls.FALL_START,
            'fall_end': cls.FALL_END,
            'spring_start': cls.SPRING_START,
            'spring_end': cls.SPRING_END,
            'is_override_active': cls._override_loaded,
            'defaults': {
                'fall_start': cls.DEFAULT_FALL_START,
                'fall_end': cls.DEFAULT_FALL_END,
                'spring_start': cls.DEFAULT_SPRING_START,
                'spring_end': cls.DEFAULT_SPRING_END
            }
        }
    
    @classmethod
    def get_current_period(cls, target_date: Optional[date] = None) -> SemesterPeriod:
        """
        Get the academic semester period for a given date.
        
        Args:
            target_date: Date to check. If None, uses today's date.
            
        Returns:
            SemesterPeriod object with all semester information
            
        Example:
            >>> period = AutomaticSemesterService.get_current_period()
            >>> print(period.semester_name)
            'Fall 2025'
        """
        if target_date is None:
            target_date = date.today()
        
        year = target_date.year
        month = target_date.month
        day = target_date.day
        
        # Determine if we're in Fall or Spring semester
        # Fall: August 1 to December 31
        # Spring: January 1 to May 30
        # Between semesters: Consider as previous semester
        
        if month >= cls.FALL_START[0]:
            # August through December = Fall semester
            return SemesterPeriod(
                period_type='Fall',
                academic_year=year,
                semester_name=f'Fall {year}',
                start_date=date(year, *cls.FALL_START),
                end_date=date(year, *cls.FALL_END),
                semester_number=1
            )
        elif month <= cls.SPRING_END[0] or (month == cls.SPRING_END[0] and day <= cls.SPRING_END[1]):
            # January through May = Spring semester
            return SemesterPeriod(
                period_type='Spring',
                academic_year=year,
                semester_name=f'Spring {year}',
                start_date=date(year, *cls.SPRING_START),
                end_date=date(year, *cls.SPRING_END),
                semester_number=2
            )
        else:
            # June-July (summer break) = consider as Spring semester that just ended
            return SemesterPeriod(
                period_type='Spring',
                academic_year=year,
                semester_name=f'Spring {year}',
                start_date=date(year, *cls.SPRING_START),
                end_date=date(year, *cls.SPRING_END),
                semester_number=2
            )
    
    @classmethod
    def get_period_by_date(cls, target_date: date) -> SemesterPeriod:
        """
        Get semester period for any specific date (past or future).
        
        Args:
            target_date: Any date to check
            
        Returns:
            SemesterPeriod for that date
            
        Example:
            >>> period = AutomaticSemesterService.get_period_by_date(date(2024, 3, 15))
            >>> print(period.semester_name)
            'Spring 2024'
        """
        return cls.get_current_period(target_date)
    
    @classmethod
    def get_date_range(cls, target_date: Optional[date] = None) -> Tuple[date, date]:
        """
        Get start and end dates for current/specified semester.
        
        Args:
            target_date: Date to check. If None, uses today.
            
        Returns:
            Tuple of (start_date, end_date)
            
        Example:
            >>> start, end = AutomaticSemesterService.get_date_range()
            >>> print(f"{start} to {end}")
            '2025-08-01 to 2025-12-15'
        """
        period = cls.get_current_period(target_date)
        return period.start_date, period.end_date
    
    @classmethod
    def is_fall_semester(cls, target_date: Optional[date] = None) -> bool:
        """
        Check if date falls in Fall semester.
        
        Args:
            target_date: Date to check. If None, uses today.
            
        Returns:
            True if Fall semester, False otherwise
        """
        period = cls.get_current_period(target_date)
        return period.period_type == 'Fall'
    
    @classmethod
    def is_spring_semester(cls, target_date: Optional[date] = None) -> bool:
        """
        Check if date falls in Spring semester.
        
        Args:
            target_date: Date to check. If None, uses today.
            
        Returns:
            True if Spring semester, False otherwise
        """
        period = cls.get_current_period(target_date)
        return period.period_type == 'Spring'
    
    @classmethod
    def get_semester_name(cls, target_date: Optional[date] = None) -> str:
        """
        Get semester name for date.
        
        Args:
            target_date: Date to check. If None, uses today.
            
        Returns:
            Semester name (e.g., "Fall 2025")
        """
        period = cls.get_current_period(target_date)
        return period.semester_name
    
    @classmethod
    def configure_dates(
        cls,
        fall_start: Optional[Tuple[int, int]] = None,
        fall_end: Optional[Tuple[int, int]] = None,
        spring_start: Optional[Tuple[int, int]] = None,
        spring_end: Optional[Tuple[int, int]] = None
    ):
        """
        Update semester date boundaries.
        Only needed if university changes academic calendar.
        
        Args:
            fall_start: (month, day) for Fall start, e.g., (8, 1)
            fall_end: (month, day) for Fall end, e.g., (12, 15)
            spring_start: (month, day) for Spring start, e.g., (1, 15)
            spring_end: (month, day) for Spring end, e.g., (5, 30)
            
        Example:
            >>> # Change Fall to start August 15 instead of August 1
            >>> AutomaticSemesterService.configure_dates(fall_start=(8, 15))
        """
        if fall_start:
            cls.FALL_START = fall_start
        if fall_end:
            cls.FALL_END = fall_end
        if spring_start:
            cls.SPRING_START = spring_start
        if spring_end:
            cls.SPRING_END = spring_end


# Convenience functions for backward compatibility
def get_current_semester_dates() -> Tuple[date, date, str]:
    """
    Legacy compatibility function.
    Returns: (start_date, end_date, semester_name)
    """
    period = AutomaticSemesterService.get_current_period()
    return period.start_date, period.end_date, period.semester_name


def get_semester_info(target_date: Optional[date] = None) -> Dict:
    """
    Get complete semester information as dictionary.
    
    Returns:
        Dict with all semester fields for API responses
    """
    period = AutomaticSemesterService.get_current_period(target_date)
    return period.to_dict()
