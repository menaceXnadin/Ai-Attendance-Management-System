"""Timetable (class_schedules) CRUD and "today's classes".

* Writes (admin): end > start; conflicts are checked on create, update, toggle (activation) and
  teacher assignment against ACTIVE rows on the same weekday with overlapping time ranges
  (``a.start < b.end and b.start < a.end``) for the same cohort (faculty_id + semester), the
  same classroom and the same teacher (DOMAIN_RULES §9). ``academic_year`` is an informational
  label and is never compared (§3.2).
* Delete: soft-deactivates a row that already produced class sessions or attendance (§9).
* Today's classes are built from today's materialized class sessions (§13.1) with the
  check-in window (§13.9) computed server-side; between terms / on holidays the list is empty.
"""
from datetime import time, datetime, date
from typing import Any, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_admin, get_current_student, get_current_user
from app.core.clock import app_now
from app.core.database import get_db
from app.models import (
    AttendanceRecord,
    ClassSchedule,
    ClassSession,
    DayOfWeek,
    Faculty,
    SessionStatus,
    Student,
    Subject,
    Teacher,
)
from app.services.attendance_policy import AttendancePolicy, get_attendance_policy
from app.services.attendance_recording import checkin_window, compute_checkin_status, normalize_status
from app.services.class_sessions import ensure_sessions_for, session_end_at, session_start_at
from app.services.instructional_calendar import (
    REASON_BETWEEN_TERMS,
    REASON_HOLIDAY,
    day_status,
    weekday_to_day_of_week,
)
from app.services.term_service import get_term_context, load_terms, term_for_date

router = APIRouter(prefix="/schedules", tags=["schedules"])

TIME_PATTERN = r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$"


# Pydantic models for request/response
class ScheduleCreate(BaseModel):
    subject_id: int
    faculty_id: int
    day_of_week: DayOfWeek
    start_time: str = Field(..., pattern=TIME_PATTERN, example="08:00")
    end_time: str = Field(..., pattern=TIME_PATTERN, example="09:30")
    semester: int = Field(..., ge=1, le=8)
    academic_year: int = Field(..., ge=2020, le=2030)
    classroom: Optional[str] = None
    instructor_name: Optional[str] = None
    teacher_id: Optional[int] = None
    notes: Optional[str] = None


class ScheduleUpdate(BaseModel):
    subject_id: Optional[int] = None
    faculty_id: Optional[int] = None
    day_of_week: Optional[DayOfWeek] = None
    start_time: Optional[str] = Field(None, pattern=TIME_PATTERN)
    end_time: Optional[str] = Field(None, pattern=TIME_PATTERN)
    semester: Optional[int] = Field(None, ge=1, le=8)
    academic_year: Optional[int] = Field(None, ge=2020, le=2030)
    classroom: Optional[str] = None
    instructor_name: Optional[str] = None
    teacher_id: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class ScheduleResponse(BaseModel):
    id: int
    subject_id: int
    subject_name: str
    subject_code: str
    faculty_id: int
    faculty_name: str
    day_of_week: str
    start_time: str
    end_time: str
    semester: int
    academic_year: int
    classroom: Optional[str]
    instructor_name: Optional[str]
    is_active: bool
    notes: Optional[str]
    duration_minutes: int
    time_slot_display: str
    is_cancelled: bool = False
    cancellation_reason: Optional[str] = None
    teacher_id: Optional[int] = None

    class Config:
        from_attributes = True


class CheckinWindow(BaseModel):
    opens_at: str
    late_after: str
    closes_at: str
    state: str  # not_open | open | closed


class TodayScheduleItem(BaseModel):
    """One of today's class sessions, in the legacy ScheduleResponse shape plus session fields."""
    id: int  # schedule id (session id for make-up sessions without a timetable row)
    schedule_id: Optional[int] = None
    session_id: int
    session_date: str
    session_status: str  # scheduled | held | cancelled
    session_kind: str = "regular"  # regular | makeup
    subject_id: int
    subject_name: str
    subject_code: str
    faculty_id: int
    faculty_name: str
    day_of_week: str
    start_time: str
    end_time: str
    semester: int
    academic_year: Optional[int] = None
    classroom: Optional[str] = None
    instructor_name: Optional[str] = None
    teacher_id: Optional[int] = None
    is_active: bool = True
    notes: Optional[str] = None
    duration_minutes: int
    time_slot_display: str
    is_cancelled: bool = False
    cancellation_reason: Optional[str] = None
    my_status: Optional[str] = None  # present | late | absent | excused | None (students only)
    checkin_window: CheckinWindow
    checkin_allowed: bool = False
    term_state: str
    day_status: str


class TodayScheduleEnvelope(BaseModel):
    date: str
    term_state: str
    day_status: str  # instructional | holiday | weekly_off | exam | between_terms
    day_status_detail: dict
    items: List[TodayScheduleItem]


# ---------------------------------------------------------------------------- helpers


def parse_time_string(time_str: str) -> time:
    """Convert time string (HH:MM) to time object"""
    try:
        return datetime.strptime(time_str, "%H:%M").time()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid time format: {time_str}. Use HH:MM format."
        )


def _hhmm(t: time) -> str:
    return t.strftime("%H:%M")


def _duration_minutes(start: time, end: time) -> int:
    return (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute)


def _day_name(value: Any) -> str:
    return getattr(value, "value", value)


def _schedule_response(schedule: ClassSchedule, subject: Optional[Subject] = None,
                       faculty: Optional[Faculty] = None) -> ScheduleResponse:
    subject = subject or schedule.subject
    faculty = faculty or schedule.faculty
    return ScheduleResponse(
        id=schedule.id,
        subject_id=schedule.subject_id,
        subject_name=subject.name if subject else "Unknown",
        subject_code=subject.code if subject else "N/A",
        faculty_id=schedule.faculty_id,
        faculty_name=faculty.name if faculty else "Unknown",
        day_of_week=_day_name(schedule.day_of_week),
        start_time=_hhmm(schedule.start_time),
        end_time=_hhmm(schedule.end_time),
        semester=schedule.semester,
        academic_year=schedule.academic_year,
        classroom=schedule.classroom,
        instructor_name=schedule.instructor_name,
        is_active=schedule.is_active is not False,
        notes=schedule.notes,
        duration_minutes=schedule.duration_minutes,
        time_slot_display=schedule.time_slot_display,
        teacher_id=schedule.teacher_id,
    )


def _is_active_row():
    # NULL counts as active, matching instructional_calendar.load_schedules.
    return ClassSchedule.is_active.isnot(False)


async def find_schedule_conflicts(
    db: AsyncSession,
    *,
    day_of_week: DayOfWeek,
    start_time: time,
    end_time: time,
    faculty_id: Optional[int],
    semester: Optional[int],
    classroom: Optional[str] = None,
    teacher_id: Optional[int] = None,
    exclude_id: Optional[int] = None,
) -> list[dict[str, Any]]:
    """Active timetable rows on the same weekday whose time range overlaps
    ``[start_time, end_time)`` and that share the cohort (faculty_id + semester), the classroom
    or the teacher (DOMAIN_RULES §9). Uses ``.first()`` per check (several overlapping rows may
    already exist). Reusable by the teacher-assignment route."""
    base = [
        _is_active_row(),
        ClassSchedule.day_of_week == day_of_week,
        ClassSchedule.start_time < end_time,
        ClassSchedule.end_time > start_time,
    ]
    if exclude_id is not None:
        base.append(ClassSchedule.id != exclude_id)
    checks: list[tuple[str, list]] = []
    if faculty_id is not None and semester is not None:
        checks.append(("cohort", [ClassSchedule.faculty_id == faculty_id, ClassSchedule.semester == semester]))
    room = (classroom or "").strip()
    if room:
        checks.append(("classroom", [func.lower(func.trim(ClassSchedule.classroom)) == room.lower()]))
    if teacher_id is not None:
        checks.append(("teacher", [ClassSchedule.teacher_id == teacher_id]))
    conflicts: list[dict[str, Any]] = []
    for kind, conds in checks:
        row = (await db.execute(
            select(ClassSchedule.id, ClassSchedule.subject_id, ClassSchedule.start_time, ClassSchedule.end_time,
                   ClassSchedule.faculty_id, ClassSchedule.semester, ClassSchedule.classroom, ClassSchedule.teacher_id)
            .where(and_(*base, *conds))
            .order_by(ClassSchedule.start_time, ClassSchedule.id)
            .limit(1)
        )).first()
        if row is not None:
            conflicts.append({
                "type": kind,
                "schedule_id": row.id,
                "subject_id": row.subject_id,
                "start_time": _hhmm(row.start_time),
                "end_time": _hhmm(row.end_time),
                "faculty_id": row.faculty_id,
                "semester": row.semester,
                "classroom": row.classroom,
                "teacher_id": row.teacher_id,
            })
    return conflicts


_CONFLICT_TEXT = {
    "cohort": "Time conflict: this faculty/semester already has a class on {day} from {start} to {end}",
    "classroom": "Classroom conflict: {room} is already booked on {day} from {start} to {end}",
    "teacher": "Teacher conflict: the teacher already teaches on {day} from {start} to {end}",
}


async def assert_no_schedule_conflicts(db: AsyncSession, **kwargs: Any) -> None:
    """Raise HTTP 409 (``detail`` = message string, as before) for the first conflict found."""
    conflicts = await find_schedule_conflicts(db, **kwargs)
    if conflicts:
        c = conflicts[0]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=_CONFLICT_TEXT[c["type"]].format(day=_day_name(kwargs["day_of_week"]), start=c["start_time"],
                                                    end=c["end_time"], room=c["classroom"]),
        )


def _validate_times(start_time: time, end_time: time) -> None:
    if start_time >= end_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Start time must be before end time")


async def _require(db: AsyncSession, model: Any, obj_id: int, label: str) -> Any:
    obj = await db.get(model, obj_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} with ID {obj_id} not found")
    return obj


async def _commit_or_conflict(db: AsyncSession) -> None:
    """Commit; DB unique slot constraints also count inactive rows -> 409 instead of a 500."""
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another timetable row (possibly inactive) already uses this start time for the same "
                   "faculty/semester or classroom; edit or reactivate that row instead",
        )


async def _load_schedule(db: AsyncSession, schedule_id: int) -> ClassSchedule:
    schedule = (await db.execute(
        select(ClassSchedule)
        .options(selectinload(ClassSchedule.subject), selectinload(ClassSchedule.faculty))
        .where(ClassSchedule.id == schedule_id)
        .execution_options(populate_existing=True)
    )).scalars().first()
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Schedule with ID {schedule_id} not found")
    return schedule


# ---------------------------------------------------------------------------- CRUD


@router.post("", response_model=ScheduleResponse)
async def create_schedule(
    schedule_data: ScheduleCreate,
    current_user = Depends(get_current_admin),  # Only admins can create schedules
    db: AsyncSession = Depends(get_db)
):
    """Create a new class schedule (Admin only)"""
    subject = await _require(db, Subject, schedule_data.subject_id, "Subject")
    faculty = await _require(db, Faculty, schedule_data.faculty_id, "Faculty")
    if schedule_data.teacher_id is not None:
        await _require(db, Teacher, schedule_data.teacher_id, "Teacher")

    start_time = parse_time_string(schedule_data.start_time)
    end_time = parse_time_string(schedule_data.end_time)
    _validate_times(start_time, end_time)

    await assert_no_schedule_conflicts(
        db,
        day_of_week=schedule_data.day_of_week,
        start_time=start_time,
        end_time=end_time,
        faculty_id=schedule_data.faculty_id,
        semester=schedule_data.semester,
        classroom=schedule_data.classroom,
        teacher_id=schedule_data.teacher_id,
    )

    new_schedule = ClassSchedule(
        subject_id=schedule_data.subject_id,
        faculty_id=schedule_data.faculty_id,
        teacher_id=schedule_data.teacher_id,
        day_of_week=schedule_data.day_of_week,
        start_time=start_time,
        end_time=end_time,
        semester=schedule_data.semester,
        academic_year=schedule_data.academic_year,
        classroom=schedule_data.classroom,
        instructor_name=schedule_data.instructor_name,
        notes=schedule_data.notes,
        is_active=True,
    )
    db.add(new_schedule)
    await _commit_or_conflict(db)
    await db.refresh(new_schedule)
    return _schedule_response(new_schedule, subject, faculty)


@router.get("", response_model=List[ScheduleResponse])
async def get_schedules(
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    academic_year: Optional[int] = None,
    day_of_week: Optional[DayOfWeek] = None,
    is_active: Optional[bool] = None,  # None shows all by default
    skip: int = 0,
    limit: Optional[int] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get class schedules with optional filters (``academic_year`` is an explicit label filter)."""
    query = select(ClassSchedule).options(
        selectinload(ClassSchedule.subject),
        selectinload(ClassSchedule.faculty)
    )
    conditions = []
    if faculty_id:
        conditions.append(ClassSchedule.faculty_id == faculty_id)
    if semester:
        conditions.append(ClassSchedule.semester == semester)
    if academic_year:
        conditions.append(ClassSchedule.academic_year == academic_year)
    if day_of_week:
        conditions.append(ClassSchedule.day_of_week == day_of_week)
    if is_active is not None:
        conditions.append(_is_active_row() if is_active else ClassSchedule.is_active.is_(False))
    if conditions:
        query = query.where(and_(*conditions))
    query = query.order_by(ClassSchedule.day_of_week, ClassSchedule.start_time, ClassSchedule.id)

    # Apply pagination only when limit is provided to preserve existing behavior elsewhere
    if limit is not None:
        if skip < 0:
            skip = 0
        if limit <= 0:
            limit = 10
        query = query.offset(skip).limit(limit)

    schedules = (await db.execute(query)).scalars().all()
    return [_schedule_response(s) for s in schedules]


# ---------------------------------------------------------------------------- today's sessions


def _window_for(session: ClassSession, now: datetime, policy: AttendancePolicy) -> CheckinWindow:
    start_at = session_start_at(session.session_date, session.start_time)
    end_at = session_end_at(session.session_date, session.end_time)
    opens_at, closes_at, late_after_at = checkin_window(start_at, end_at, policy)
    if str(session.status) == SessionStatus.cancelled:
        state = "closed"
    else:
        result, code = compute_checkin_status(now, start_at, end_at, policy)
        state = "open" if result is not None else ("not_open" if code == "window_not_open" else "closed")
    return CheckinWindow(opens_at=opens_at.isoformat(), late_after=late_after_at.isoformat(),
                         closes_at=closes_at.isoformat(), state=state)


async def _today_items(
    db: AsyncSession,
    sessions: list[ClassSession],
    *,
    now: datetime,
    policy: AttendancePolicy,
    term_state: str,
    day_status_value: str,
    student_id: Optional[int] = None,
) -> list[TodayScheduleItem]:
    if not sessions:
        return []
    schedule_ids = {s.schedule_id for s in sessions if s.schedule_id is not None}
    schedules = {}
    if schedule_ids:
        schedules = {r.id: r for r in (await db.execute(
            select(ClassSchedule).where(ClassSchedule.id.in_(schedule_ids)))).scalars().all()}
    subjects = {r.id: r for r in (await db.execute(
        select(Subject.id, Subject.name, Subject.code).where(Subject.id.in_({s.subject_id for s in sessions})))).all()}
    faculties = {r.id: r.name for r in (await db.execute(
        select(Faculty.id, Faculty.name).where(Faculty.id.in_({s.faculty_id for s in sessions})))).all()}
    teacher_ids = {s.teacher_id for s in sessions if s.teacher_id is not None}
    teachers = {}
    if teacher_ids:
        teachers = {r.id: r.name for r in (await db.execute(
            select(Teacher.id, Teacher.name).where(Teacher.id.in_(teacher_ids)))).all()}
    my_status: dict[int, Optional[str]] = {}
    if student_id is not None:
        for sid, rstatus in (await db.execute(
            select(AttendanceRecord.session_id, AttendanceRecord.status).where(
                AttendanceRecord.student_id == student_id,
                AttendanceRecord.session_id.in_([s.id for s in sessions]),
            )
        )).all():
            my_status[sid] = normalize_status(rstatus)
    terms = await load_terms(db)

    items: list[TodayScheduleItem] = []
    for s in sessions:
        sched = schedules.get(s.schedule_id) if s.schedule_id is not None else None
        subj = subjects.get(s.subject_id)
        term = term_for_date(terms, s.session_date)
        window = _window_for(s, now, policy)
        cancelled = str(s.status) == SessionStatus.cancelled
        mine = my_status.get(s.id)
        items.append(TodayScheduleItem(
            id=s.schedule_id if s.schedule_id is not None else s.id,
            schedule_id=s.schedule_id,
            session_id=s.id,
            session_date=s.session_date.isoformat(),
            session_status=str(s.status),
            session_kind=str(s.kind or "regular"),
            subject_id=s.subject_id,
            subject_name=subj.name if subj else "Unknown",
            subject_code=subj.code if subj else "N/A",
            faculty_id=s.faculty_id,
            faculty_name=faculties.get(s.faculty_id, "Unknown"),
            day_of_week=_day_name(weekday_to_day_of_week(s.session_date)),
            start_time=_hhmm(s.start_time),
            end_time=_hhmm(s.end_time),
            semester=s.semester,
            academic_year=(sched.academic_year if sched is not None else (term.academic_year if term else None)),
            classroom=sched.classroom if sched is not None else None,
            instructor_name=(sched.instructor_name if sched is not None and sched.instructor_name
                             else teachers.get(s.teacher_id)),
            teacher_id=s.teacher_id,
            is_active=True,
            notes=sched.notes if sched is not None else None,
            duration_minutes=_duration_minutes(s.start_time, s.end_time),
            time_slot_display=f"{_hhmm(s.start_time)} - {_hhmm(s.end_time)}",
            is_cancelled=cancelled,
            cancellation_reason=s.cancellation_reason if cancelled else None,
            my_status=mine,
            checkin_window=window,
            checkin_allowed=(student_id is not None and window.state == "open" and mine is None and not cancelled),
            term_state=term_state,
            day_status=day_status_value,
        ))
    return items


async def _today_payload(
    db: AsyncSession,
    response: Response,
    *,
    faculty_id: Optional[int],
    semester: Optional[int],
    student_id: Optional[int],
    envelope: bool,
):
    """Shared builder for ``/today`` and ``/student/today`` (materializes today's sessions)."""
    now = app_now()
    today = now.date()
    policy = await get_attendance_policy(db)
    term_state = (await get_term_context(db, as_of=today)).state
    info = await day_status(db, today, faculty_id, policy=policy)
    day_status_value = "instructional" if info["instructional"] else (info["reason"] or "instructional")

    sessions: list[ClassSession] = []
    if info["reason"] not in (REASON_BETWEEN_TERMS, REASON_HOLIDAY):
        sessions = await ensure_sessions_for(db, session_date=today, faculty_id=faculty_id, semester=semester,
                                             policy=policy)
        await db.commit()  # persist on-demand materialization (idempotent)
    items = await _today_items(db, sessions, now=now, policy=policy, term_state=term_state,
                               day_status_value=day_status_value, student_id=student_id)
    response.headers["X-Term-State"] = term_state
    response.headers["X-Day-Status"] = day_status_value
    if envelope:
        return TodayScheduleEnvelope(date=today.isoformat(), term_state=term_state, day_status=day_status_value,
                                     day_status_detail=info, items=items)
    return items


@router.get("/today", response_model=Union[TodayScheduleEnvelope, List[TodayScheduleItem]])
async def get_today_schedule(
    response: Response,
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    envelope: bool = Query(False, description="Return {date, term_state, day_status, items} instead of a list"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Today's class sessions (any authenticated user), optionally for one cohort."""
    return await _today_payload(db, response, faculty_id=faculty_id, semester=semester, student_id=None,
                                envelope=envelope)


@router.get("/student/today", response_model=Union[TodayScheduleEnvelope, List[TodayScheduleItem]])
async def get_student_today_schedule(
    response: Response,
    envelope: bool = Query(False, description="Return {date, term_state, day_status, items} instead of a list"),
    current_student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """Today's class sessions of the logged-in student's cohort with ``my_status`` and the
    server-computed check-in window. Empty between terms and on holidays. ``term_state`` and
    ``day_status`` are on every item, in the ``X-Term-State``/``X-Day-Status`` headers and at the
    top level with ``?envelope=true``. The legacy ``?day=`` parameter is ignored (server clock)."""
    if current_student.faculty_id is None:
        # No cohort assigned: nothing is scheduled for this student.
        if envelope:
            term_state = (await get_term_context(db)).state
            return TodayScheduleEnvelope(date=app_now().date().isoformat(), term_state=term_state,
                                         day_status="no_cohort", day_status_detail={}, items=[])
        return []
    return await _today_payload(db, response, faculty_id=current_student.faculty_id,
                                semester=current_student.semester, student_id=current_student.id,
                                envelope=envelope)


# ---------------------------------------------------------------------------- update/delete/toggle


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    schedule_data: ScheduleUpdate,
    current_user = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update a class schedule (Admin only). The resulting row is re-validated (end > start, no
    cohort/classroom/teacher overlap with other active rows). Existing class sessions keep their
    snapshot; time edits apply from the next materialized day (§13.1)."""
    schedule = await _load_schedule(db, schedule_id)
    update_data = schedule_data.model_dump(exclude_unset=True)

    if 'start_time' in update_data and update_data['start_time'] is not None:
        update_data['start_time'] = parse_time_string(update_data['start_time'])
    if 'end_time' in update_data and update_data['end_time'] is not None:
        update_data['end_time'] = parse_time_string(update_data['end_time'])
    for required in ("subject_id", "faculty_id", "day_of_week", "start_time", "end_time", "semester", "academic_year"):
        if required in update_data and update_data[required] is None:
            update_data.pop(required)

    if update_data.get("subject_id") is not None:
        await _require(db, Subject, update_data["subject_id"], "Subject")
    if update_data.get("faculty_id") is not None:
        await _require(db, Faculty, update_data["faculty_id"], "Faculty")
    if update_data.get("teacher_id") is not None:
        await _require(db, Teacher, update_data["teacher_id"], "Teacher")

    merged = {
        f: update_data.get(f, getattr(schedule, f))
        for f in ("day_of_week", "start_time", "end_time", "faculty_id", "semester", "classroom", "teacher_id", "is_active")
    }
    _validate_times(merged["start_time"], merged["end_time"])
    if merged["is_active"] is not False:
        await assert_no_schedule_conflicts(
            db,
            day_of_week=merged["day_of_week"],
            start_time=merged["start_time"],
            end_time=merged["end_time"],
            faculty_id=merged["faculty_id"],
            semester=merged["semester"],
            classroom=merged["classroom"],
            teacher_id=merged["teacher_id"],
            exclude_id=schedule.id,
        )

    for field, value in update_data.items():
        setattr(schedule, field, value)
    await _commit_or_conflict(db)
    schedule = await _load_schedule(db, schedule_id)
    return _schedule_response(schedule)


async def _schedule_has_history(db: AsyncSession, schedule: ClassSchedule) -> bool:
    """True if the row produced class sessions, or attendance exists for its subject (legacy
    records are keyed by subject/date, not by timetable row)."""
    has_sessions = (await db.execute(
        select(ClassSession.id).where(ClassSession.schedule_id == schedule.id).limit(1))).first() is not None
    if has_sessions:
        return True
    return (await db.execute(
        select(AttendanceRecord.id).where(AttendanceRecord.subject_id == schedule.subject_id).limit(1)
    )).first() is not None


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    current_user = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete a class schedule (Admin only). A row with class sessions/attendance history is
    deactivated instead (DOMAIN_RULES §9); only a row without history is hard-deleted."""
    schedule = await db.get(ClassSchedule, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Schedule with ID {schedule_id} not found")

    if await _schedule_has_history(db, schedule):
        schedule.is_active = False
        await db.commit()
        return {
            "message": f"Schedule {schedule_id} has class sessions or attendance history and was deactivated instead of deleted",
            "deleted": False,
            "deactivated": True,
            "is_active": False,
        }

    await db.delete(schedule)
    await db.commit()
    return {"message": f"Schedule {schedule_id} deleted successfully", "deleted": True, "deactivated": False}


@router.post("/{schedule_id}/toggle")
async def toggle_schedule_status(
    schedule_id: int,
    current_user = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Toggle schedule active status (Admin only). Activation is rejected (409) when the row
    would overlap an active row of the same cohort, classroom or teacher."""
    schedule = await db.get(ClassSchedule, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Schedule with ID {schedule_id} not found")

    activating = schedule.is_active is False
    if activating:
        await assert_no_schedule_conflicts(
            db,
            day_of_week=schedule.day_of_week,
            start_time=schedule.start_time,
            end_time=schedule.end_time,
            faculty_id=schedule.faculty_id,
            semester=schedule.semester,
            classroom=schedule.classroom,
            teacher_id=schedule.teacher_id,
            exclude_id=schedule.id,
        )
    schedule.is_active = activating
    await _commit_or_conflict(db)

    status_text = "activated" if schedule.is_active else "deactivated"
    return {"message": f"Schedule {schedule_id} {status_text} successfully", "is_active": schedule.is_active}
