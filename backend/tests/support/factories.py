"""Async data factories writing explicit SQL against the *live* schema (tests/schema/baseline.sql).

The ORM models drift from the DB (audit-integrity.md A7), so factories use Core ``text()``
inserts with the real column names and native enum casts. Every factory accepts ``**extra``
columns, so columns added by new migrations (``students.enrolled_on``,
``attendance_records.session_id``/``source``, …) can be set without touching the factory.

All rows are written through the per-test ``AsyncSession`` and vanish when the test's outer
transaction is rolled back. Factories return :class:`Record` objects (attribute access to
every column from ``RETURNING *``); composite factories attach related records, e.g.
``student.user``, ``teacher.user``, ``admin.user``.
"""
from __future__ import annotations

import itertools
import math
from datetime import date, datetime, time, timedelta, timezone
from types import SimpleNamespace
from typing import Any, Iterable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

DEFAULT_PASSWORD = "Test-Passw0rd!"

#: ``day_of_week`` enum labels indexed by Python ``date.weekday()`` (Mon=0 … Sun=6).
WEEKDAY_ENUM = ("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY")

_UNSET: Any = object()
_SEQ = itertools.count(1)  # process-wide, so unique values never collide even across committing tests


class Record(SimpleNamespace):
    """A row returned by a factory. ``record.as_dict()`` gives the column values."""

    def as_dict(self) -> dict[str, Any]:
        return {k: v for k, v in vars(self).items() if not isinstance(v, (Record, list))}


def day_of_week_label(value: Any) -> str:
    """Accept a ``date``, a weekday int (Mon=0), an enum member or a name; return the DB label."""
    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, date):
        return WEEKDAY_ENUM[value.weekday()]
    if isinstance(value, int):
        return WEEKDAY_ENUM[value]
    raw = getattr(value, "value", value)
    label = str(raw).strip().upper()
    if label not in WEEKDAY_ENUM:
        raise ValueError(f"invalid day_of_week {value!r}")
    return label


def _as_time(value: Any) -> time | None:
    if value is None or isinstance(value, time):
        return value
    return time.fromisoformat(str(value))


def _as_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def _naive_utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _id(value: Any) -> Any:
    """Accept a Record/ORM object or a raw id."""
    return getattr(value, "id", value)


class Factory:
    """Create consistent test data. Obtain via the ``factory`` fixture."""

    def __init__(self, session: AsyncSession, password_hash: str):
        self.session = session
        self.password_hash = password_hash
        self._event_creator: Record | None = None

    # ------------------------------------------------------------------ core
    @staticmethod
    def seq() -> int:
        return next(_SEQ)

    async def insert(self, table: str, values: dict[str, Any], casts: dict[str, str] | None = None) -> Record:
        """``INSERT INTO table (...) VALUES (...) RETURNING *`` with optional ``CAST(:col AS type)``."""
        casts = casts or {}
        cols = list(values)
        col_sql = ", ".join(f'"{c}"' for c in cols)
        val_sql = ", ".join(f"CAST(:{c} AS {casts[c]})" if c in casts else f":{c}" for c in cols)
        result = await self.session.execute(
            text(f"INSERT INTO {table} ({col_sql}) VALUES ({val_sql}) RETURNING *"), values
        )
        return Record(**dict(result.mappings().one()))

    # ------------------------------------------------------------- catalog
    async def faculty(self, *, name: str | None = None, code: str | None = None,
                      description: str | None = None, **extra: Any) -> Record:
        n = self.seq()
        return await self.insert("faculties", {
            "name": name or f"Faculty {n}",
            "code": code or f"FAC{n}",
            "description": description,
            **extra,
        })

    async def subject(self, *, faculty: Any = _UNSET, name: str | None = None, code: str | None = None,
                      credits: int | None = 3, description: str | None = None, **extra: Any) -> Record:
        if faculty is _UNSET:
            faculty = await self.faculty()
        n = self.seq()
        return await self.insert("subjects", {
            "name": name or f"Subject {n}",
            "code": code or f"SUB{n}",
            "credits": credits,
            "description": description,
            "faculty_id": _id(faculty),
            **extra,
        })

    # --------------------------------------------------------------- people
    async def user(self, *, role: str = "student", email: str | None = None, full_name: str | None = None,
                   is_active: bool = True, hashed_password: str | None = None, **extra: Any) -> Record:
        role = getattr(role, "value", role)
        n = self.seq()
        return await self.insert("users", {
            "email": email or f"{role}{n}@tests.attendai.example.com",
            "full_name": full_name or f"Test {role.title()} {n}",
            "hashed_password": hashed_password or self.password_hash,
            "role": role,
            "is_active": is_active,
            **extra,
        }, casts={"role": "user_role"})

    async def admin(self, *, full_name: str | None = None, email: str | None = None, admin_id: str | None = None,
                    department: str | None = "Administration", permissions: list[str] | None = None,
                    is_active: bool = True, **extra: Any) -> Record:
        user = await self.user(role="admin", email=email, full_name=full_name, is_active=is_active)
        row = await self.insert("admins", {
            "user_id": user.id,
            "admin_id": admin_id or f"ADM{user.id:05d}",
            "name": user.full_name,
            "department": department,
            "permissions": permissions,
            **extra,
        })
        row.user = user
        return row

    async def teacher(self, *, faculty: Any = None, full_name: str | None = None, email: str | None = None,
                      teacher_id: str | None = None, department: str | None = None,
                      is_active: bool = True, **extra: Any) -> Record:
        user = await self.user(role="faculty", email=email, full_name=full_name, is_active=is_active)
        row = await self.insert("teachers", {
            "user_id": user.id,
            "teacher_id": teacher_id or f"TCH{user.id:05d}",
            "name": user.full_name,
            "faculty_id": _id(faculty) if faculty is not None else None,
            "department": department,
            **extra,
        })
        row.user = user
        return row

    async def student(self, *, faculty: Any = _UNSET, semester: int = 1, year: int | None = None,
                      batch: int = 2025, student_id: str | None = None, full_name: str | None = None,
                      email: str | None = None, is_active: bool = True, face_encoding: Any = None,
                      **extra: Any) -> Record:
        """User (role=student) + students row. ``faculty`` may be a Record, an id, or None."""
        if faculty is _UNSET:
            faculty = await self.faculty()
        faculty_id = _id(faculty) if faculty is not None else None
        faculty_name = getattr(faculty, "name", None)
        if faculty_name is None and faculty_id is not None:
            faculty_name = (await self.session.execute(
                text("SELECT name FROM faculties WHERE id = :id"), {"id": faculty_id})).scalar_one()
        user = await self.user(role="student", email=email, full_name=full_name, is_active=is_active)
        row = await self.insert("students", {
            "user_id": user.id,
            "student_id": student_id or f"STU{user.id:06d}",
            "name": user.full_name,
            "faculty": faculty_name or "Unassigned",  # legacy NOT NULL text column
            "faculty_id": faculty_id,
            "semester": semester,
            "year": year if year is not None else max(1, math.ceil(semester / 2)),
            "batch": batch,
            "face_encoding": face_encoding,
            **extra,
        })
        row.user = user
        return row

    # ------------------------------------------------------------ timetable
    async def class_schedule(self, *, subject: Any, faculty: Any = _UNSET, day_of_week: Any = "MONDAY",
                             start_time: Any = "09:00", end_time: Any = "10:00", semester: int = 1,
                             academic_year: int = 2025, teacher: Any = None, classroom: str | None = None,
                             instructor_name: str | None = None, is_active: bool = True,
                             notes: str | None = None, **extra: Any) -> Record:
        """``day_of_week`` accepts 'MONDAY', a weekday int (Mon=0) or a date."""
        if faculty is _UNSET:
            faculty_id = getattr(subject, "faculty_id", None)
            if faculty_id is None:
                faculty_id = (await self.session.execute(
                    text("SELECT faculty_id FROM subjects WHERE id = :id"), {"id": _id(subject)})).scalar_one()
        else:
            faculty_id = _id(faculty)
        return await self.insert("class_schedules", {
            "subject_id": _id(subject),
            "faculty_id": faculty_id,
            "day_of_week": day_of_week_label(day_of_week),
            "start_time": _as_time(start_time),
            "end_time": _as_time(end_time),
            "semester": semester,
            "academic_year": academic_year,
            "teacher_id": _id(teacher) if teacher is not None else None,
            "instructor_name": instructor_name or getattr(teacher, "name", None),
            "classroom": classroom,
            "is_active": is_active,
            "notes": notes,
            **extra,
        }, casts={"day_of_week": "day_of_week"})

    async def term(self, *, start_date: Any, end_date: Any, semester_number: int = 1,
                   academic_year: int | None = None, semester_name: str | None = None,
                   exam_week_start: Any = None, exam_week_end: Any = None, total_weeks: int | None = None,
                   is_active: bool = True, is_current: bool = False, created_by: Any = None,
                   **extra: Any) -> Record:
        """A ``semester_configurations`` row (DOMAIN_RULES §3: the source of truth for terms)."""
        start, end = _as_date(start_date), _as_date(end_date)
        now = _naive_utc_now()
        return await self.insert("semester_configurations", {
            "semester_number": semester_number,
            "academic_year": academic_year if academic_year is not None else start.year,
            "semester_name": semester_name or f"Semester {semester_number} ({start.isoformat()})",
            "start_date": start,
            "end_date": end,
            "total_weeks": total_weeks if total_weeks is not None else max(1, (end - start).days // 7),
            "exam_week_start": _as_date(exam_week_start),
            "exam_week_end": _as_date(exam_week_end),
            "is_current": is_current,
            "is_active": is_active,
            "created_by": _id(created_by) if created_by is not None else None,
            "created_at": now,
            "updated_at": now,
            **extra,
        })

    # --------------------------------------------------------------- events
    async def _default_event_creator(self) -> Record:
        if self._event_creator is None:
            self._event_creator = (await self.admin()).user
        return self._event_creator

    async def academic_event(self, *, event_type: str, start_date: Any, end_date: Any = None,
                             title: str | None = None, faculty: Any = None, subject: Any = None,
                             start_time: Any = None, end_time: Any = None, is_all_day: bool | None = None,
                             holiday_type: str | None = None, attendance_required: bool = False,
                             is_active: bool = True, created_by: Any = None, color_code: str | None = None,
                             description: str | None = None, class_room: str | None = None,
                             **extra: Any) -> Record:
        """``academic_events`` row. ``event_type`` ∈ CLASS, HOLIDAY, EXAM, SPECIAL_EVENT, CANCELLED_CLASS.

        Scope: ``faculty``/``subject`` None means university-wide. ``end_date`` None = single day.
        """
        event_type = str(getattr(event_type, "name", event_type)).upper()
        creator = created_by if created_by is not None else await self._default_event_creator()
        now = _naive_utc_now()
        st, et = _as_time(start_time), _as_time(end_time)
        return await self.insert("academic_events", {
            "title": title or f"{event_type.title()} {self.seq()}",
            "description": description,
            "event_type": event_type,
            "start_date": _as_date(start_date),
            "end_date": _as_date(end_date),
            "start_time": st,
            "end_time": et,
            "is_all_day": is_all_day if is_all_day is not None else (st is None and et is None),
            "holiday_type": holiday_type,
            "subject_id": _id(subject) if subject is not None else None,
            "faculty_id": _id(faculty) if faculty is not None else None,
            "class_room": class_room,
            "color_code": color_code or {"HOLIDAY": "#ef4444", "EXAM": "#f59e0b",
                                         "CANCELLED_CLASS": "#6b7280"}.get(event_type, "#3b82f6"),
            "is_recurring": False,
            "created_by": _id(creator),
            "created_at": now,
            "updated_at": now,
            "is_active": is_active,
            "attendance_required": attendance_required,
            **extra,
        }, casts={"event_type": "eventtype", "holiday_type": "holidaytype"})

    async def holiday(self, *, start_date: Any, end_date: Any = None, holiday_type: str = "FULL_DAY",
                      **kw: Any) -> Record:
        return await self.academic_event(event_type="HOLIDAY", start_date=start_date, end_date=end_date,
                                         holiday_type=holiday_type, **kw)

    async def exam(self, *, start_date: Any, end_date: Any = None, **kw: Any) -> Record:
        return await self.academic_event(event_type="EXAM", start_date=start_date, end_date=end_date, **kw)

    async def cancelled_class(self, *, start_date: Any, end_date: Any = None, **kw: Any) -> Record:
        return await self.academic_event(event_type="CANCELLED_CLASS", start_date=start_date,
                                         end_date=end_date, **kw)

    # ----------------------------------------------------------- attendance
    async def attendance_record(self, *, student: Any, subject: Any, date: Any, status: str = "present",
                                method: str = "manual", marked_by: Any = None, time_in: datetime | None = None,
                                time_out: datetime | None = None, confidence_score: float | None = None,
                                location: str | None = None, notes: str | None = None, period: int | None = None,
                                time_slot: str | None = None, **extra: Any) -> Record:
        """Raw legacy-style ``attendance_records`` insert (no business rules applied).

        ``marked_by`` takes a users.id or a Record with ``.user`` (teacher/admin/student).
        Pass new columns (``session_id=…``, ``source=…``) through ``**extra``.
        """
        marker = getattr(marked_by, "user", marked_by)
        return await self.insert("attendance_records", {
            "student_id": _id(student),
            "subject_id": _id(subject),
            "date": _as_date(date),
            "status": getattr(status, "value", status),
            "method": getattr(method, "value", method),
            "marked_by": _id(marker) if marker is not None else None,
            "time_in": time_in,
            "time_out": time_out,
            "confidence_score": confidence_score,
            "location": location,
            "notes": notes,
            "period": period,
            "time_slot": time_slot,
            **extra,
        }, casts={"status": "attendance_status", "method": "attendance_method"})

    # ---------------------------------------------------------- composites
    async def cohort(self, *, n_students: int = 3, semester: int = 1, faculty: Any = None,
                     term_start: Any = None, term_end: Any = None,
                     days: Iterable[Any] = ("MONDAY", "WEDNESDAY"),
                     start_time: Any = "09:00", end_time: Any = "10:00", academic_year: int = 2025) -> Record:
        """Faculty + subject + teacher + students (same faculty/semester) + weekly schedule + active term.

        Defaults: a term covering 2025-01-06 … 2025-05-30 and one schedule row per entry of ``days``.
        """
        faculty = faculty or await self.faculty()
        subject = await self.subject(faculty=faculty)
        teacher = await self.teacher(faculty=faculty)
        students = [await self.student(faculty=faculty, semester=semester) for _ in range(n_students)]
        schedules = [
            await self.class_schedule(subject=subject, faculty=faculty, day_of_week=d, start_time=start_time,
                                      end_time=end_time, semester=semester, academic_year=academic_year,
                                      teacher=teacher)
            for d in days
        ]
        start = _as_date(term_start) or date(2025, 1, 6)
        end = _as_date(term_end) or (start + timedelta(weeks=20))
        term = await self.term(start_date=start, end_date=end, semester_number=semester,
                               academic_year=academic_year)
        return Record(faculty=faculty, subject=subject, teacher=teacher, students=students,
                      schedules=schedules, schedule=schedules[0] if schedules else None, term=term,
                      semester=semester)
