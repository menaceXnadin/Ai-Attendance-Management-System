"""Shared builders for the domain-service tests (DOMAIN_RULES §3-§8, §13).

Reference timeline used throughout (Asia/Kathmandu wall clock, Nepal calendar => Saturday off):

* active term ``2026-01-05 .. 2026-05-29`` labelled ``academic_year=2026``; every timetable row is
  labelled ``academic_year=2025`` on purpose (§3.2: labels are never compared to calendar years);
* ``MON = 2026-03-02`` (Monday), ``TUE``, ``WED``, ``SAT = 2026-03-07`` (weekly off), ``SUN = 2026-03-01``;
* the cohort's regular class is MONDAY + WEDNESDAY 09:00-10:00 taught by ``env.teacher``;
* ``attendance_policy.tracking_start_date`` is pinned to 2025-12-01 (the migration writes the real
  migration date, which would otherwise hide every session in the reference term).
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Any, Optional

import pytest
from sqlalchemy import select, text

MON = date(2026, 3, 2)
TUE = date(2026, 3, 3)
WED = date(2026, 3, 4)
THU = date(2026, 3, 5)
FRI = date(2026, 3, 6)
SAT = date(2026, 3, 7)
SUN = date(2026, 3, 1)
NEXT_MON = date(2026, 3, 9)

TERM_START = date(2026, 1, 5)
TERM_END = date(2026, 5, 29)
TRACKING_START = date(2025, 12, 1)
ENROLLED_ON = date(2025, 12, 1)

T0900 = time(9, 0)
T1000 = time(10, 0)


def at(d: date, hh: int, mm: int = 0, ss: int = 0) -> datetime:
    """Naive local wall-clock datetime (the frozen clock treats naive values as Asia/Kathmandu)."""
    return datetime(d.year, d.month, d.day, hh, mm, ss)


def _id(value: Any) -> Any:
    return getattr(value, "id", value)


# ----------------------------------------------------------------------------- policy


async def patch_policy(db, **values: Any) -> None:
    """Merge ``values`` into the ``attendance_policy`` system setting (per-test transaction).

    ``None`` removes the key. Dates are serialized ISO."""
    patch = {}
    removals = []
    for key, value in values.items():
        if value is None:
            removals.append(key)
        else:
            patch[key] = value.isoformat() if isinstance(value, date) else value
    exists = (await db.execute(text("SELECT 1 FROM system_settings WHERE key = 'attendance_policy'"))).first()
    if exists is None:
        await db.execute(text(
            "INSERT INTO system_settings (key, value, category, data_type, is_active) "
            "VALUES ('attendance_policy', CAST(:v AS jsonb), 'attendance', 'json', true)"), {"v": json.dumps(patch)})
    else:
        await db.execute(text(
            "UPDATE system_settings SET value = (value || CAST(:v AS jsonb)) WHERE key = 'attendance_policy'"),
            {"v": json.dumps(patch)})
    for key in removals:
        await db.execute(text("UPDATE system_settings SET value = value - :k WHERE key = 'attendance_policy'"), {"k": key})


async def set_setting(db, key: str, value: Any) -> None:
    await db.execute(text("UPDATE system_settings SET value = CAST(:v AS jsonb) WHERE key = :k"),
                     {"v": json.dumps(value), "k": key})


async def load_policy(db):
    from app.services.attendance_policy import get_attendance_policy

    return await get_attendance_policy(db)


# ----------------------------------------------------------------------------- rows


async def insert_session(factory, *, subject: Any, faculty: Any, session_date: date, semester: int = 1,
                         start: time = T0900, end: time = T1000, status: str = "scheduled",
                         teacher: Any = None, schedule: Any = None, term: Any = None, kind: str = "regular",
                         **extra: Any):
    """Raw ``class_sessions`` row (no rules applied) for metrics/finalizer set-ups."""
    if status == "held":
        extra.setdefault("attendance_taken_at", datetime(session_date.year, session_date.month, session_date.day, 3, 0))
    return await factory.insert("class_sessions", {
        "schedule_id": _id(schedule) if schedule is not None else None,
        "kind": kind,
        "subject_id": _id(subject),
        "faculty_id": _id(faculty),
        "semester": semester,
        "term_id": _id(term) if term is not None else None,
        "session_date": session_date,
        "start_time": start,
        "end_time": end,
        "teacher_id": _id(teacher) if teacher is not None else None,
        "status": status,
        **extra,
    })


async def insert_record(factory, *, student: Any, session: Any, status: str = "present", source: str = "teacher",
                        **extra: Any):
    """Raw ``attendance_records`` row attached to ``session`` (no rules applied)."""
    defaults = {
        "teacher": "manual", "admin": "manual", "student_face": "face", "system_auto": "other", "legacy": "manual",
    }
    if source == "system_auto":
        extra.setdefault("location", "AUTO_ABSENT_SYSTEM")
    return await factory.attendance_record(
        student=student, subject=session.subject_id, date=session.session_date, status=status,
        method=extra.pop("method", defaults[source]), session_id=session.id, source=source, **extra)


async def get_session(db, session_id: int):
    from app.models import ClassSession

    return (await db.execute(
        select(ClassSession).where(ClassSession.id == session_id).execution_options(populate_existing=True)
    )).scalars().one()


async def sessions_on(db, d: date, **filters: Any) -> list:
    from app.models import ClassSession

    stmt = select(ClassSession).where(ClassSession.session_date == d)
    for k, v in filters.items():
        stmt = stmt.where(getattr(ClassSession, k) == v)
    return list((await db.execute(stmt.order_by(ClassSession.start_time, ClassSession.id)
                                  .execution_options(populate_existing=True))).scalars().all())


async def records_for(db, session_id: int) -> list:
    rows = await db.execute(text(
        "SELECT id, student_id, status::text AS status, source, method::text AS method, location, marked_by, "
        "excluded_from_metrics, exclusion_reason, notes FROM attendance_records WHERE session_id = :s ORDER BY student_id, id"),
        {"s": session_id})
    return list(rows.mappings().all())


async def audit_rows(db, **filters: Any) -> list:
    where = " AND ".join(f"{k} = :{k}" for k in filters) or "true"
    rows = await db.execute(text(f"SELECT * FROM attendance_audit_log WHERE {where} ORDER BY id"), filters)
    return list(rows.mappings().all())


async def count(db, sql: str, **params: Any) -> int:
    return int((await db.execute(text(sql), params)).scalar() or 0)


# ----------------------------------------------------------------------------- world


@dataclass
class Env:
    faculty: Any
    other_faculty: Any
    subject: Any
    subject2: Any
    teacher: Any
    other_teacher: Any
    admin: Any
    students: list
    outsider: Any  # same faculty, other semester
    term: Any
    mon_schedule: Any
    wed_schedule: Any
    semester: int = 1
    extra: dict = field(default_factory=dict)

    @property
    def s1(self):
        return self.students[0]

    @property
    def s2(self):
        return self.students[1]

    @property
    def s3(self):
        return self.students[2]


@pytest.fixture
async def env(db, factory) -> Env:
    """Reference cohort (see module docstring)."""
    await patch_policy(db, tracking_start_date=TRACKING_START)
    faculty = await factory.faculty()
    other_faculty = await factory.faculty()
    subject = await factory.subject(faculty=faculty)
    subject2 = await factory.subject(faculty=faculty)
    teacher = await factory.teacher(faculty=faculty)
    other_teacher = await factory.teacher(faculty=faculty)
    admin = await factory.admin()
    students = [await factory.student(faculty=faculty, semester=1, enrolled_on=ENROLLED_ON) for _ in range(3)]
    outsider = await factory.student(faculty=faculty, semester=2, enrolled_on=ENROLLED_ON)
    term = await factory.term(start_date=TERM_START, end_date=TERM_END, academic_year=2026, semester_number=1)
    mon = await factory.class_schedule(subject=subject, faculty=faculty, day_of_week="MONDAY", start_time="09:00",
                                       end_time="10:00", semester=1, academic_year=2025, teacher=teacher)
    wed = await factory.class_schedule(subject=subject, faculty=faculty, day_of_week="WEDNESDAY", start_time="09:00",
                                       end_time="10:00", semester=1, academic_year=2025, teacher=teacher)
    return Env(faculty=faculty, other_faculty=other_faculty, subject=subject, subject2=subject2, teacher=teacher,
               other_teacher=other_teacher, admin=admin, students=students, outsider=outsider, term=term,
               mon_schedule=mon, wed_schedule=wed)


@pytest.fixture
async def mon_session(db, env, frozen_now):
    """The materialized Monday 09:00-10:00 session (clock frozen at MON 09:30)."""
    from app.services.class_sessions import ensure_sessions_for

    frozen_now(at(MON, 9, 30))
    sessions = await ensure_sessions_for(db, session_date=MON, faculty_id=env.faculty.id, semester=1,
                                         subject_id=env.subject.id)
    assert len(sessions) == 1, sessions
    return sessions[0]
