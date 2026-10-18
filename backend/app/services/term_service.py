"""Academic terms (DOMAIN_RULES §3, §3.2, §3.3; §13.12 ``term_state``).

Source of truth: ``semester_configurations`` (university-wide periods). A term is *active* iff
``is_active`` is true. The current term is the active term whose ``[start_date, end_date]``
contains ``app_today()``; no month heuristics, no fallback guessing, never compare
``academic_year`` labels to calendar years (§3.2). ``is_current`` is computed from dates.

Pure helpers operate on :class:`Term` value objects; the async wrappers load rows.

Transactions: read helpers never flush/commit. ``assert_term_valid`` takes
``pg_advisory_xact_lock(TERM_WRITE_LOCK_KEY)`` in the caller's transaction (released at the
caller's commit/rollback) so concurrent create/update calls cannot both pass the overlap check.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from typing import Any, Iterable, Optional

from app.core.clock import app_today
from app.services.domain_errors import DomainError

logger = logging.getLogger(__name__)

#: Advisory lock key serializing term writes (Rule §3.3).
TERM_WRITE_LOCK_KEY = 815_200_002

ACADEMIC_YEAR_MIN = 2000
ACADEMIC_YEAR_MAX = 2100

TERM_STATE_ACTIVE = "active"
TERM_STATE_BETWEEN = "between_terms"
TERM_STATE_NONE = "no_terms"


@dataclass(frozen=True)
class Term:
    """Immutable view of a ``semester_configurations`` row."""

    id: Optional[int]
    name: str
    start_date: date
    end_date: date
    academic_year: Optional[int] = None
    exam_week_start: Optional[date] = None
    exam_week_end: Optional[date] = None
    is_active: bool = True
    semester_number: Optional[int] = None

    @classmethod
    def from_model(cls, row: Any) -> "Term":
        return cls(
            id=row.id,
            name=row.semester_name,
            start_date=row.start_date,
            end_date=row.end_date,
            academic_year=row.academic_year,
            exam_week_start=row.exam_week_start,
            exam_week_end=row.exam_week_end,
            is_active=row.is_active is not False,
            semester_number=getattr(row, "semester_number", None),
        )

    def contains(self, d: date) -> bool:
        return self.start_date <= d <= self.end_date

    def in_exam_window(self, d: date) -> bool:
        """True iff both exam dates are set and ``d`` lies in ``[exam_week_start, exam_week_end]``."""
        return (
            self.exam_week_start is not None
            and self.exam_week_end is not None
            and self.exam_week_start <= d <= self.exam_week_end
        )

    def is_instruction_day(self, d: date, exam_days_suspend_classes: bool = True) -> bool:
        """Instruction window (Rule §3): inside the term and, when exams suspend classes,
        outside the exam window."""
        if not self.contains(d):
            return False
        return not (exam_days_suspend_classes and self.in_exam_window(d))

    def is_current(self, today: Optional[date] = None) -> bool:
        """Computed ``is_current`` (Rule §3: the stored column is not authoritative)."""
        return self.is_active and self.contains(today or app_today())

    def summary(self) -> dict[str, Any]:
        """``{id, name, start_date, end_date}`` as used in metric responses (Rule §13.12)."""
        return {
            "id": self.id,
            "name": self.name,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
        }

    def to_dict(self, today: Optional[date] = None) -> dict[str, Any]:
        data = self.summary()
        data.update(
            academic_year=self.academic_year,
            exam_week_start=self.exam_week_start.isoformat() if self.exam_week_start else None,
            exam_week_end=self.exam_week_end.isoformat() if self.exam_week_end else None,
            is_active=self.is_active,
            is_current=self.is_current(today),
            semester_number=self.semester_number,
        )
        return data


@dataclass(frozen=True)
class TermContext:
    """Result of resolving which term a report covers (Rule §3, §13.12)."""

    term: Optional[Term]
    state: str  # "active" | "between_terms" | "no_terms"
    current_term: Optional[Term]

    def to_dict(self) -> dict[str, Any]:
        return {"term": self.term.summary() if self.term else None, "term_state": self.state}


# ----------------------------------------------------------------------------- pure helpers


def term_for_date(terms: Iterable[Term], d: date) -> Optional[Term]:
    """The active term containing ``d`` (Rule §3). Active terms must not overlap; if bad data
    makes several match, the one with the latest start wins (deterministic) and a warning is logged."""
    matches = [t for t in terms if t.is_active and t.contains(d)]
    if not matches:
        return None
    if len(matches) > 1:
        logger.warning("Overlapping active terms for %s: %s", d, [t.id for t in matches])
    return max(matches, key=lambda t: (t.start_date, t.id or 0))


def reporting_term(terms: Iterable[Term], d: date) -> Optional[Term]:
    """Current term for ``d`` if any, else the most recent active term that ended before ``d``."""
    terms = list(terms)
    current = term_for_date(terms, d)
    if current is not None:
        return current
    past = [t for t in terms if t.is_active and t.end_date < d]
    if not past:
        return None
    return max(past, key=lambda t: (t.end_date, t.id or 0))


def compute_term_state(terms: Iterable[Term], d: date) -> str:
    """``active`` if a term contains ``d``, ``between_terms`` if any active term exists,
    else ``no_terms`` (Rule §13.12)."""
    terms = [t for t in terms if t.is_active]
    if term_for_date(terms, d) is not None:
        return TERM_STATE_ACTIVE
    return TERM_STATE_BETWEEN if terms else TERM_STATE_NONE


def ranges_overlap(a_start: date, a_end: date, b_start: date, b_end: date) -> bool:
    """Inclusive date ranges overlap."""
    return a_start <= b_end and b_start <= a_end


def validate_term_fields(
    *,
    start_date: Optional[date],
    end_date: Optional[date],
    exam_week_start: Optional[date] = None,
    exam_week_end: Optional[date] = None,
    academic_year: Optional[int] = None,
) -> list[dict[str, Any]]:
    """Field-level term validation (Rule §3.3). Returns a list of ``{field, code, message}``."""
    errors: list[dict[str, Any]] = []
    if start_date is None:
        errors.append({"field": "start_date", "code": "required", "message": "start_date is required"})
    if end_date is None:
        errors.append({"field": "end_date", "code": "required", "message": "end_date is required"})
    if start_date is not None and end_date is not None and not end_date > start_date:
        errors.append({"field": "end_date", "code": "end_not_after_start", "message": "end_date must be after start_date"})
    if (exam_week_start is None) != (exam_week_end is None):
        errors.append({
            "field": "exam_week_end" if exam_week_end is None else "exam_week_start",
            "code": "exam_window_incomplete",
            "message": "Set both exam_week_start and exam_week_end, or neither",
        })
    elif exam_week_start is not None and exam_week_end is not None:
        if exam_week_start > exam_week_end:
            errors.append({"field": "exam_week_end", "code": "exam_end_before_start",
                           "message": "exam_week_end must be on or after exam_week_start"})
        if start_date is not None and end_date is not None and not (
            start_date <= exam_week_start and exam_week_end <= end_date
        ):
            errors.append({"field": "exam_week_start", "code": "exam_window_outside_term",
                           "message": "The exam window must lie inside the term dates"})
    if academic_year is not None and not (ACADEMIC_YEAR_MIN <= int(academic_year) <= ACADEMIC_YEAR_MAX):
        errors.append({"field": "academic_year", "code": "academic_year_out_of_range",
                       "message": f"academic_year must be between {ACADEMIC_YEAR_MIN} and {ACADEMIC_YEAR_MAX}"})
    return errors


def find_overlapping_terms(
    terms: Iterable[Term], start_date: date, end_date: date, *, exclude_id: Optional[int] = None
) -> list[Term]:
    """Active terms (other than ``exclude_id``) overlapping ``[start_date, end_date]``."""
    return [
        t for t in terms
        if t.is_active and t.id != exclude_id and ranges_overlap(start_date, end_date, t.start_date, t.end_date)
    ]


# ----------------------------------------------------------------------------- async wrappers


async def load_terms(db, *, active_only: bool = True) -> list[Term]:
    """All terms (active only by default), ordered by start date."""
    from sqlalchemy import select

    from app.models import SemesterConfiguration

    stmt = select(SemesterConfiguration).order_by(SemesterConfiguration.start_date, SemesterConfiguration.id)
    if active_only:
        stmt = stmt.where(SemesterConfiguration.is_active.is_(True))
    rows = (await db.execute(stmt)).scalars().all()
    return [Term.from_model(r) for r in rows]


async def get_term_by_id(db, term_id: int) -> Optional[Term]:
    from app.models import SemesterConfiguration

    row = await db.get(SemesterConfiguration, term_id)
    return Term.from_model(row) if row is not None else None


async def get_term_for_date(db, d: date) -> Optional[Term]:
    """Rule §3: the active term with ``start_date <= d <= end_date`` (or ``None``)."""
    return term_for_date(await load_terms(db), d)


async def get_current_term(db) -> Optional[Term]:
    """Rule §3: ``get_term_for_date(app_today())``. ``None`` means *between terms*."""
    return await get_term_for_date(db, app_today())


async def get_reporting_term(db, d: Optional[date] = None) -> Optional[Term]:
    """Rule §3: current term if any, else the most recent active term ended before ``d``."""
    return reporting_term(await load_terms(db), d or app_today())


async def get_term_context(db, *, as_of: Optional[date] = None, term_id: Optional[int] = None) -> TermContext:
    """Resolve the term a report covers plus ``term_state`` (Rule §3, §13.12).

    ``term_id`` selects an explicit term (active or not; 404 ``term_not_found`` if missing);
    otherwise the reporting term for ``as_of`` (default today) is used. ``state`` always
    describes ``as_of`` itself.
    """
    as_of = as_of or app_today()
    terms = await load_terms(db)
    current = term_for_date(terms, as_of)
    state = compute_term_state(terms, as_of)
    if term_id is not None:
        term = next((t for t in terms if t.id == term_id), None) or await get_term_by_id(db, term_id)
        if term is None:
            raise DomainError("term_not_found", f"Term {term_id} not found", http_status=404, details={"term_id": term_id})
    else:
        term = reporting_term(terms, as_of)
    return TermContext(term=term, state=state, current_term=current)


async def assert_term_valid(
    db,
    *,
    start_date: Optional[date],
    end_date: Optional[date],
    exam_week_start: Optional[date] = None,
    exam_week_end: Optional[date] = None,
    academic_year: Optional[int] = None,
    is_active: bool = True,
    exclude_id: Optional[int] = None,
) -> None:
    """Validate a term create/update inside the caller's transaction (Rule §3.3).

    Takes ``pg_advisory_xact_lock(TERM_WRITE_LOCK_KEY)`` first, so the overlap check and the
    subsequent write are serialized against other term writers until the caller commits.
    Raises ``DomainError("term_invalid", 422, details={"errors": [...]})``; overlap errors carry
    ``code="overlaps_active_term"`` and the conflicting ``term_ids``.
    """
    from sqlalchemy import text

    errors = validate_term_fields(
        start_date=start_date,
        end_date=end_date,
        exam_week_start=exam_week_start,
        exam_week_end=exam_week_end,
        academic_year=academic_year,
    )
    await db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": TERM_WRITE_LOCK_KEY})
    if is_active and start_date is not None and end_date is not None and end_date > start_date:
        overlapping = find_overlapping_terms(await load_terms(db), start_date, end_date, exclude_id=exclude_id)
        if overlapping:
            errors.append({
                "field": "start_date",
                "code": "overlaps_active_term",
                "message": "Overlaps active term(s): " + ", ".join(f"{t.name} ({t.start_date}..{t.end_date})" for t in overlapping),
                "term_ids": [t.id for t in overlapping],
            })
    if errors:
        raise DomainError("term_invalid", errors[0]["message"], http_status=422, details={"errors": errors})


async def term_usage_counts(db, term: Term) -> dict[str, int]:
    """Attendance records and class sessions dated inside ``term`` (Rule §3.3 hard-delete guard)."""
    from sqlalchemy import func, or_, select

    from app.models import AttendanceRecord

    counts = {"attendance_records": 0, "class_sessions": 0}
    counts["attendance_records"] = int((await db.execute(
        select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.date >= term.start_date, AttendanceRecord.date <= term.end_date
        )
    )).scalar() or 0)
    try:
        from app.models.attendance_sessions import ClassSession
    except ImportError:  # pragma: no cover - before the class_sessions model exists
        return counts
    conditions = [ClassSession.session_date.between(term.start_date, term.end_date)]
    if term.id is not None:
        conditions.append(ClassSession.term_id == term.id)
    counts["class_sessions"] = int((await db.execute(
        select(func.count(ClassSession.id)).where(or_(*conditions))
    )).scalar() or 0)
    return counts


async def assert_term_deletable(db, term: Term) -> None:
    """Rule §3.3: hard delete is forbidden when attendance/sessions fall in the term's range.
    Raises ``DomainError("term_in_use", 409)``; callers should soft-deactivate instead."""
    counts = await term_usage_counts(db, term)
    if counts["attendance_records"] or counts["class_sessions"]:
        raise DomainError(
            "term_in_use",
            "This term has attendance or class sessions; deactivate it instead of deleting it",
            http_status=409,
            details=counts,
        )


__all__ = [
    "TERM_WRITE_LOCK_KEY",
    "TERM_STATE_ACTIVE",
    "TERM_STATE_BETWEEN",
    "TERM_STATE_NONE",
    "Term",
    "TermContext",
    "term_for_date",
    "reporting_term",
    "compute_term_state",
    "ranges_overlap",
    "validate_term_fields",
    "find_overlapping_terms",
    "load_terms",
    "get_term_by_id",
    "get_term_for_date",
    "get_current_term",
    "get_reporting_term",
    "get_term_context",
    "assert_term_valid",
    "term_usage_counts",
    "assert_term_deletable",
]
