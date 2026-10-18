"""Legacy academic-period facade over ``term_service`` (DOMAIN_RULES §3, §3.1).

The month-based heuristics (Aug 1-Dec 15 / Jan 15-May 30) and the ``academic_calendar_config``
override no longer decide anything. Terms come only from ``semester_configurations`` via
``app.services.term_service``:

* ``get_current_period()`` / ``get_period_by_date(d)`` return the active term containing the
  date as a :class:`SemesterPeriod`, or ``None`` when the date is between terms (no guessing).
* New code should call ``term_service`` directly (async). The synchronous methods here read a
  per-worker cache of active terms that is filled by ``load_override_from_db(session)`` (kept
  under its old name; called at startup and by legacy callers) or ``refresh_terms(session)``,
  and dropped by ``clear_override_cache()`` / ``invalidate_terms()`` / ``reset_to_defaults()``.
* ``get_current_period_async(db)`` / ``get_period_for_date_async(db, d)`` always read the DB.

The override boundaries are still loaded for display by the read-only
``/api/admin/academic-calendar/*`` endpoints (``get_active_configuration``); they are
informational only.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.core.clock import app_now, app_today
from app.services import term_service
from app.services.term_service import Term

logger = logging.getLogger(__name__)

DEPRECATION_MESSAGE = "Academic periods are managed in Semester Setup"


@dataclass
class SemesterPeriod:
    """A term in the legacy shape (``period_type``/``semester_number`` kept for old callers)."""

    period_type: str
    academic_year: Optional[int]
    semester_name: str
    start_date: date
    end_date: date
    semester_number: Optional[int]
    term_id: Optional[int] = None
    exam_week_start: Optional[date] = None
    exam_week_end: Optional[date] = None

    @classmethod
    def from_term(cls, term: Term) -> "SemesterPeriod":
        name = term.name or ""
        lowered = name.lower()
        period_type = "Fall" if "fall" in lowered else "Spring" if "spring" in lowered else name
        return cls(
            period_type=period_type,
            academic_year=term.academic_year,
            semester_name=name,
            start_date=term.start_date,
            end_date=term.end_date,
            semester_number=term.semester_number,
            term_id=term.id,
            exam_week_start=term.exam_week_start,
            exam_week_end=term.exam_week_end,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "period_type": self.period_type,
            "academic_year": self.academic_year,
            "semester_name": self.semester_name,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "term_id": self.term_id,
        }


class AutomaticSemesterService:
    """Thin facade over ``term_service`` (see module docstring)."""

    # Informational month/day boundaries (display only; never used to resolve terms).
    DEFAULT_FALL_START = (8, 1)
    DEFAULT_FALL_END = (12, 15)
    DEFAULT_SPRING_START = (1, 15)
    DEFAULT_SPRING_END = (5, 30)
    FALL_START = DEFAULT_FALL_START
    FALL_END = DEFAULT_FALL_END
    SPRING_START = DEFAULT_SPRING_START
    SPRING_END = DEFAULT_SPRING_END

    _override_loaded = False
    _last_override_check: Optional[datetime] = None
    _override_cache_ttl = timedelta(minutes=5)

    _terms: Optional[List[Term]] = None

    # ------------------------------------------------------------------ cache management
    @classmethod
    async def refresh_terms(cls, session) -> List[Term]:
        """Reload the active-term cache from ``semester_configurations``."""
        cls._terms = await term_service.load_terms(session)
        return cls._terms

    @classmethod
    def invalidate_terms(cls) -> None:
        cls._terms = None

    @classmethod
    async def load_override_from_db(cls, session) -> bool:
        """Legacy entry point: refresh the term cache (and the informational override
        boundaries) at most every 5 minutes. Returns whether an override row is active."""
        now = app_now()
        if cls._last_override_check and cls._terms is not None and now - cls._last_override_check < cls._override_cache_ttl:
            return cls._override_loaded
        try:
            await cls.refresh_terms(session)
        except Exception as exc:  # pragma: no cover - DB unavailable
            logger.warning("Failed to load terms: %s", exc)
        try:
            from sqlalchemy import or_, select

            from app.models.calendar import AcademicCalendarConfig

            override = (await session.execute(
                select(AcademicCalendarConfig)
                .where(AcademicCalendarConfig.is_override_active.is_(True))
                .where(or_(AcademicCalendarConfig.effective_until.is_(None),
                           AcademicCalendarConfig.effective_until >= app_today()))
                .order_by(AcademicCalendarConfig.id.desc())
            )).scalars().first()
            if override is not None:
                cls.FALL_START = (override.fall_start_month, override.fall_start_day)
                cls.FALL_END = (override.fall_end_month, override.fall_end_day)
                cls.SPRING_START = (override.spring_start_month, override.spring_start_day)
                cls.SPRING_END = (override.spring_end_month, override.spring_end_day)
                cls._override_loaded = True
            else:
                cls._reset_boundaries()
        except Exception as exc:
            logger.warning("Failed to load calendar override (informational only): %s", exc)
            cls._reset_boundaries()
        cls._last_override_check = now
        return cls._override_loaded

    @classmethod
    def _reset_boundaries(cls) -> None:
        cls.FALL_START = cls.DEFAULT_FALL_START
        cls.FALL_END = cls.DEFAULT_FALL_END
        cls.SPRING_START = cls.DEFAULT_SPRING_START
        cls.SPRING_END = cls.DEFAULT_SPRING_END
        cls._override_loaded = False

    @classmethod
    def reset_to_defaults(cls) -> None:
        cls._reset_boundaries()
        cls._terms = None

    @classmethod
    def clear_override_cache(cls) -> None:
        cls._last_override_check = None

    @classmethod
    def get_active_configuration(cls) -> Dict[str, Any]:
        """Informational boundaries for the deprecated calendar-override settings page."""
        return {
            "fall_start": cls.FALL_START,
            "fall_end": cls.FALL_END,
            "spring_start": cls.SPRING_START,
            "spring_end": cls.SPRING_END,
            "is_override_active": cls._override_loaded,
            "defaults": {
                "fall_start": cls.DEFAULT_FALL_START,
                "fall_end": cls.DEFAULT_FALL_END,
                "spring_start": cls.DEFAULT_SPRING_START,
                "spring_end": cls.DEFAULT_SPRING_END,
            },
            "deprecated": True,
            "message": DEPRECATION_MESSAGE,
        }

    # ------------------------------------------------------------------ term resolution
    @classmethod
    def _cached_terms(cls) -> List[Term]:
        if cls._terms is None:
            logger.warning("AutomaticSemesterService used before terms were loaded; treating as no terms")
            return []
        return cls._terms

    @classmethod
    def get_current_period(cls, target_date: Optional[date] = None) -> Optional[SemesterPeriod]:
        """The active term containing ``target_date`` (default today), or ``None`` (between terms)."""
        term = term_service.term_for_date(cls._cached_terms(), target_date or app_today())
        return SemesterPeriod.from_term(term) if term is not None else None

    @classmethod
    def get_period_by_date(cls, target_date: date) -> Optional[SemesterPeriod]:
        return cls.get_current_period(target_date)

    @classmethod
    def get_term_state(cls, target_date: Optional[date] = None) -> str:
        return term_service.compute_term_state(cls._cached_terms(), target_date or app_today())

    @classmethod
    async def get_current_period_async(cls, db, target_date: Optional[date] = None) -> Optional[SemesterPeriod]:
        term = await term_service.get_term_for_date(db, target_date or app_today())
        return SemesterPeriod.from_term(term) if term is not None else None

    @classmethod
    async def get_period_for_date_async(cls, db, target_date: date) -> Optional[SemesterPeriod]:
        return await cls.get_current_period_async(db, target_date)

    @classmethod
    def get_date_range(cls, target_date: Optional[date] = None) -> Optional[Tuple[date, date]]:
        period = cls.get_current_period(target_date)
        return (period.start_date, period.end_date) if period else None

    @classmethod
    def is_fall_semester(cls, target_date: Optional[date] = None) -> bool:
        period = cls.get_current_period(target_date)
        return bool(period and period.period_type == "Fall")

    @classmethod
    def is_spring_semester(cls, target_date: Optional[date] = None) -> bool:
        period = cls.get_current_period(target_date)
        return bool(period and period.period_type == "Spring")

    @classmethod
    def get_semester_name(cls, target_date: Optional[date] = None) -> Optional[str]:
        period = cls.get_current_period(target_date)
        return period.semester_name if period else None

    @classmethod
    def configure_dates(cls, *args: Any, **kwargs: Any) -> None:
        """No-op: term dates are edited in Semester Setup (``/api/admin/semester-config``)."""
        logger.warning("AutomaticSemesterService.configure_dates is deprecated: %s", DEPRECATION_MESSAGE)


def get_current_semester_dates() -> Optional[Tuple[date, date, str]]:
    """Legacy helper: ``(start, end, name)`` of the current term, or ``None`` between terms."""
    period = AutomaticSemesterService.get_current_period()
    return (period.start_date, period.end_date, period.semester_name) if period else None


def get_semester_info(target_date: Optional[date] = None) -> Optional[Dict[str, Any]]:
    period = AutomaticSemesterService.get_current_period(target_date)
    return period.to_dict() if period else None
