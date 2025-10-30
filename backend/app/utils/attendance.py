from datetime import date, datetime
from typing import Any, Optional, Union

from app.models import AttendanceStatus


def normalize_attendance_status(status: Union[str, AttendanceStatus, None]) -> Optional[str]:
    """Return the canonical lowercase status string for the given attendance status value."""
    if status is None:
        return None

    if isinstance(status, AttendanceStatus):
        return status.value

    status_str = str(status).strip().lower()
    if not status_str:
        return None

    # Handle common enum string formats, e.g. "AttendanceStatus.present"
    if "attendancestatus." in status_str:
        status_str = status_str.split("attendancestatus.", 1)[1]
    if "attendance_status." in status_str:
        status_str = status_str.split("attendance_status.", 1)[1]

    # Direct matches
    if status_str in {"present", "absent", "late", "excused", "half_day", "halfday"}:
        return "half_day" if status_str in {"half_day", "halfday"} else status_str

    if "present" in status_str:
        return "present"
    if "absent" in status_str:
        return "absent"
    if "late" in status_str:
        return "late"
    if "excused" in status_str:
        return "excused"

    return None


def coerce_record_date(value: Any) -> Optional[date]:
    """Convert assorted date representations to a ``date`` object."""
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return None

        # Try ISO format with optional time component
        try:
            return datetime.fromisoformat(cleaned).date()
        except ValueError:
            pass

        # Fallback to simple YYYY-MM-DD
        try:
            return datetime.strptime(cleaned, "%Y-%m-%d").date()
        except ValueError:
            return None

    return None


__all__ = ["normalize_attendance_status", "coerce_record_date"]
