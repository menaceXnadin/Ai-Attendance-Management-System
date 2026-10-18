"""Calendar generator — DISABLED (DOMAIN_RULES §9, §13.1).

The generator used to create one CLASS event per scheduled class per day. CLASS "marker" events
are no longer needed: class sessions are materialized from the timetable inside active terms
(``app.services.class_sessions``), and holidays/exams/cancellations are ordinary calendar events.
The old implementation was also broken (un-awaited coroutine, Sat+Sun skipped, Fall/Spring flag
used as the student semester, day-wide cancellation wipes) and destructive (it created an active
admin "system" user and hard-deleted past events).

This module stays importable; every mutating entry point raises
``DomainError("calendar_generator_disabled", http_status=410)`` and nothing writes to the DB.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app.services import term_service
from app.services.domain_errors import DomainError

logger = logging.getLogger(__name__)

DISABLED_CODE = "calendar_generator_disabled"
DISABLED_MESSAGE = (
    "The calendar generator has been retired: CLASS events are no longer needed. Class sessions are "
    "created automatically from the timetable for dates inside an active term (Semester Setup); use "
    "calendar events only for holidays, exams, cancellations and special events."
)


def disabled_error() -> DomainError:
    return DomainError(DISABLED_CODE, DISABLED_MESSAGE, http_status=410)


class CalendarGeneratorService:
    """Inert replacement: reads are harmless, writes raise :func:`disabled_error`."""

    def __init__(self, db: Any):
        self.db = db

    async def get_current_semester(self) -> Optional[Dict[str, Any]]:
        """The current term (``term_service``) in the old dict shape, or ``None`` between terms."""
        term = await term_service.get_current_term(self.db)
        if term is None:
            return None
        return {
            "semester_name": term.name,
            "start_date": term.start_date,
            "end_date": term.end_date,
            "semester_number": term.semester_number,
            "academic_year": term.academic_year,
            "term_id": term.id,
        }

    async def get_or_create_system_user(self, *args: Any, **kwargs: Any):
        raise disabled_error()

    async def generate_events_for_date_range(self, *args: Any, **kwargs: Any) -> Dict[str, int]:
        raise disabled_error()

    async def auto_generate_upcoming_events(self, *args: Any, **kwargs: Any) -> Dict[str, int]:
        raise disabled_error()

    async def generate_full_semester(self, *args: Any, **kwargs: Any) -> Dict[str, int]:
        raise disabled_error()

    async def cleanup_old_events(self, *args: Any, **kwargs: Any) -> int:
        raise disabled_error()


async def auto_generate_calendar(db: Any, days_ahead: int = 30) -> Dict[str, Any]:
    raise disabled_error()


async def generate_full_semester_calendar(db: Any) -> Dict[str, Any]:
    raise disabled_error()


__all__ = [
    "DISABLED_CODE",
    "DISABLED_MESSAGE",
    "disabled_error",
    "CalendarGeneratorService",
    "auto_generate_calendar",
    "generate_full_semester_calendar",
]
