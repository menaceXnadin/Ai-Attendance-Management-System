"""
Teacher Dashboard API Routes
Provides teacher-specific endpoints for viewing their courses, schedules, attendance, and analytics.

Attendance is a fact about a class session (DOMAIN_RULES §0, §5, §13). Every read/write here goes
through the domain services:

* today's classes / registers come from ``class_sessions`` (materialized on demand with
  ``ensure_sessions_for``), never from schedules x weekday;
* writes go through ``attendance_recording.record_attendance`` (all-or-nothing validation,
  audit rows, held/submitted transitions);
* cancellation is session-level (``class_sessions.cancel_session`` / ``uncancel_session``);
* percentages come from ``attendance_metrics`` only.

Ownership of a session = the session's snapshot ``teacher_id`` or its schedule's ``teacher_id``.
All "today/now" values come from ``app.core.clock``.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, distinct, update, text
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Dict, Any, Optional, Iterable
from datetime import datetime, date, time, timedelta
from app.core.clock import app_now, app_today, local_naive
from app.core.database import get_db
from app.models import (
    Teacher, ClassSchedule, Subject, AttendanceRecord, Student, Faculty,
    AttendanceStatus, AttendanceMethod, User, UserRole, AcademicEvent,
    ClassSession, SessionStatus, DayOfWeek,
)
from app.models.calendar import EventType
from app.api.dependencies import get_current_teacher, require_teacher_role, get_current_user
from app.services.attendance_metrics import Counts, compute_cohort_subject_metrics, summarize_counts
from app.services.attendance_policy import get_attendance_policy
from app.services.attendance_recording import (
    PROVENANCE_EXCLUSIONS,
    Entry,
    normalize_status,
    record_attendance,
)
from app.services.class_sessions import (
    cancel_session,
    count_unrecorded_sessions,
    ensure_sessions_for,
    get_or_create_session,
    lock_session,
    resolve_session_for,
    roster_conditions,
    session_end_at,
    session_is_not_future,
    session_start_at,
    teacher_owns_session,
    uncancel_session,
    within_teacher_window,
)
from app.services.domain_errors import DomainError
from app.services.term_service import get_term_context
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/teacher", tags=["Teacher Dashboard"])


# Pydantic models for request/response
class AttendanceMarkRequest(BaseModel):
    student_id: int
    subject_id: int
    date: str  # YYYY-MM-DD (ISO datetimes are accepted; the date part is used)
    status: str  # present, absent, late
    period: Optional[int] = None
    time_slot: Optional[str] = None  # 'HH:MM-HH:MM' picks the slot when a subject meets twice a day
    notes: Optional[str] = None  # used as the reason when no explicit reason is given
    session_id: Optional[int] = None
    start_time: Optional[str] = None
    reason: Optional[str] = None
    confirm_held: bool = False


class BulkAttendanceMarkRequest(BaseModel):
    subject_id: int
    semester: int
    faculty_id: int
    date: str  # YYYY-MM-DD
    period: Optional[int] = None
    time_slot: Optional[str] = None
    attendance_records: List[Any]  # [{"student_id": 1, "status": "present", "reason"?: "..."}, ...]
    session_id: Optional[int] = None
    start_time: Optional[str] = None
    reason: Optional[str] = None
    confirm_held: bool = False
    mark_remaining_absent: bool = False


class TeacherNotificationRequest(BaseModel):
    title: str
    message: str
    subject_id: int
    semester: int
    priority: str = "medium"  # low, medium, high
    type: str = "info"  # info, warning, success, danger


class CancelClassRequest(BaseModel):
    schedule_id: Optional[int] = None
    date: Optional[str] = None  # YYYY-MM-DD format
    reason: Optional[str] = "Teacher unavailable"
    notify_students: bool = True
    session_id: Optional[int] = None


class UncancelClassRequest(BaseModel):
    session_id: Optional[int] = None
    subject_id: Optional[int] = None
    date: Optional[str] = None
    schedule_id: Optional[int] = None
    faculty_id: Optional[int] = None
    semester: Optional[int] = None
    start_time: Optional[str] = None
    reason: Optional[str] = None
    notify_students: bool = True


# ============================================================================
# Helpers
# ============================================================================

def _parse_date(value: Any, *, default_today: bool = True) -> Optional[date]:
    """``YYYY-MM-DD`` (or an ISO datetime whose date part is used). Empty -> app_today()."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return app_today() if default_today else None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value).strip()[:10])
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format. Use YYYY-MM-DD")


def _parse_time(value: Any, *, strict: bool = True) -> Optional[time]:
    """``HH:MM`` / ``HH:MM:SS``; for a ``time_slot`` ('HH:MM-HH:MM') the start is used."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    head = str(value).strip().split("-")[0].strip()
    try:
        return time.fromisoformat(head)
    except ValueError:
        if strict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid time format. Use HH:MM")
        return None


def _http_error(err: DomainError) -> HTTPException:
    """API contract v1 error shapes: per-entry validation -> 400 ``invalid_entries``; everything
    else -> ``err.http_status`` with ``{code, message, ...details, details}``."""
    details = dict(err.details or {})
    if err.code == "validation_failed":
        errors = list(details.get("errors") or [])
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "invalid_entries",
                "message": err.message,
                "errors": errors,
                "session_id": details.get("session_id"),
                # pre-v1 shape kept for older clients
                "invalid_students": [{"student_id": e.get("student_id"), "reason": e.get("message")} for e in errors],
            },
        )
    body = {k: v for k, v in details.items() if k not in ("code", "message", "details")}
    body.update(code=err.code, message=err.message, details=details)
    return HTTPException(status_code=err.http_status, detail=body)


async def _fail(db: AsyncSession, err: DomainError):
    """Roll back everything the request did (incl. on-demand materialization) and raise."""
    await db.rollback()
    raise _http_error(err)


def _hhmm(t: Optional[time]) -> Optional[str]:
    return t.strftime("%H:%M") if t is not None else None


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt is not None else None


def _session_dict(s: ClassSession) -> Dict[str, Any]:
    return {
        "id": s.id,
        "session_id": s.id,
        "schedule_id": s.schedule_id,
        "subject_id": s.subject_id,
        "faculty_id": s.faculty_id,
        "semester": s.semester,
        "session_date": s.session_date.isoformat(),
        "status": s.status,
        "kind": s.kind,
        "start_time": _hhmm(s.start_time),
        "end_time": _hhmm(s.end_time),
        "teacher_id": s.teacher_id,
        "cancelled": s.status == SessionStatus.cancelled,
        "cancellation_reason": s.cancellation_reason,
        "attendance_taken_at": _iso(s.attendance_taken_at),
        "submitted_at": _iso(s.submitted_at),
        "finalized_at": _iso(s.finalized_at),
        "review_required": bool(s.review_required),
        "review_reason": s.review_reason,
    }


async def _schedule_teachers(db: AsyncSession, sessions: Iterable[ClassSession]) -> Dict[int, Optional[int]]:
    ids = {s.schedule_id for s in sessions if s.schedule_id is not None}
    if not ids:
        return {}
    rows = await db.execute(select(ClassSchedule.id, ClassSchedule.teacher_id).where(ClassSchedule.id.in_(ids)))
    return {sid: tid for sid, tid in rows.all()}


def _owned(teacher_id: int, s: ClassSession, sched_teachers: Dict[int, Optional[int]]) -> bool:
    return teacher_owns_session(teacher_id, s.teacher_id, sched_teachers.get(s.schedule_id))


async def _owned_sessions(db: AsyncSession, teacher_id: int, sessions: Iterable[ClassSession]) -> List[ClassSession]:
    sessions = list(sessions)
    sched_teachers = await _schedule_teachers(db, sessions)
    return [s for s in sessions if _owned(teacher_id, s, sched_teachers)]


async def _teacher_cohorts(
    db: AsyncSession, teacher_id: int, subject_id: int, semester: Optional[int] = None
) -> List[tuple]:
    """(faculty_id, semester) cohorts in which the teacher teaches ``subject_id``: from their
    timetable rows plus sessions whose snapshot teacher is them (e.g. after a reassignment)."""
    q1 = select(ClassSchedule.faculty_id, ClassSchedule.semester).where(
        ClassSchedule.teacher_id == teacher_id, ClassSchedule.subject_id == subject_id
    )
    q2 = select(ClassSession.faculty_id, ClassSession.semester).where(
        ClassSession.teacher_id == teacher_id, ClassSession.subject_id == subject_id
    )
    if semester is not None:
        q1 = q1.where(ClassSchedule.semester == semester)
        q2 = q2.where(ClassSession.semester == semester)
    rows = (await db.execute(q1.union(q2))).all()
    return sorted({(f, s) for f, s in rows if f is not None})


async def _roster_students(db: AsyncSession, faculty_id: int, semester: int, on_date: date) -> List[Student]:
    """Students enrolled in the cohort on ``on_date`` (Rule §13.7, via the service's SQL helper)."""
    rows = await db.execute(
        select(Student)
        .options(selectinload(Student.user))
        .join(User, User.id == Student.user_id)
        .where(*roster_conditions(faculty_id, semester, on_date))
        .order_by(User.full_name, Student.id)
    )
    return list(rows.scalars().all())


async def _roster_size(db: AsyncSession, faculty_id: int, semester: int, on_date: date) -> int:
    return int((await db.execute(
        select(func.count(Student.id))
        .join(User, User.id == Student.user_id)
        .where(*roster_conditions(faculty_id, semester, on_date))
    )).scalar() or 0)


async def _record_counts(db: AsyncSession, session_ids: Iterable[int]) -> Dict[int, int]:
    ids = list({int(i) for i in session_ids})
    if not ids:
        return {}
    rows = await db.execute(
        select(AttendanceRecord.session_id, func.count(AttendanceRecord.id))
        .where(AttendanceRecord.session_id.in_(ids))
        .group_by(AttendanceRecord.session_id)
    )
    return {sid: int(n) for sid, n in rows.all()}


async def _load_session(db: AsyncSession, session_id: int) -> ClassSession:
    s = (await db.execute(select(ClassSession).where(ClassSession.id == session_id))).scalars().first()
    if s is None:
        raise DomainError("session_not_found", f"Class session {session_id} not found", http_status=404,
                          details={"session_id": session_id})
    return s


async def _resolve_teacher_session(
    db: AsyncSession,
    *,
    teacher_id: int,
    subject_id: int,
    faculty_id: Optional[int],
    semester: Optional[int],
    session_date: date,
    session_id: Optional[int] = None,
    start_time: Optional[time] = None,
    policy=None,
) -> ClassSession:
    """The session a write targets. ``session_id`` wins (must match subject/cohort/date);
    otherwise ``resolve_session_for`` (materializes on demand, never guesses). When several
    slots exist but exactly one belongs to this teacher, that one is used."""
    if session_id is not None:
        s = await _load_session(db, session_id)
        mismatch = (
            s.subject_id != subject_id
            or (faculty_id is not None and s.faculty_id != faculty_id)
            or (semester is not None and s.semester != semester)
            or (session_date is not None and s.session_date != session_date)
        )
        if mismatch:
            raise DomainError("session_mismatch", "The class session does not match the subject, class or date",
                              http_status=400, details={"session_id": session_id})
        return s
    try:
        return await resolve_session_for(db, subject_id=subject_id, faculty_id=faculty_id, semester=semester,
                                         session_date=session_date, start_time=start_time, policy=policy)
    except DomainError as err:
        if err.code != "ambiguous_session":
            raise
        slot_ids = [slot.get("session_id") for slot in err.details.get("slots", []) if slot.get("session_id")]
        candidates = list((await db.execute(select(ClassSession).where(ClassSession.id.in_(slot_ids)))).scalars().all())
        mine = await _owned_sessions(db, teacher_id, candidates)
        if len(mine) == 1:
            return mine[0]
        raise


def _edit_state(s: Optional[ClassSession], now: datetime, policy) -> tuple:
    """(can_edit, block_code) for the teacher register (display only; the service decides)."""
    if s is None:
        return False, "no_session"
    if s.status == SessionStatus.cancelled:
        return False, "session_cancelled"
    if not session_is_not_future(s.session_date, s.start_time, now, policy.checkin_opens_minutes_before):
        return False, "session_not_started"
    if not within_teacher_window(s.session_date, now.date(), policy.teacher_edit_window_days):
        return False, "edit_window_closed"
    return True, None


def _pick_default_session(sessions: List[ClassSession], now: datetime, policy) -> Optional[ClassSession]:
    """Default slot when the client did not pass ``session_id``: a non-cancelled one; for today the
    one in progress (else the most recently started, else the next)."""
    if not sessions:
        return None
    live = [s for s in sessions if s.status != SessionStatus.cancelled] or list(sessions)
    if live[0].session_date != now.date():
        return live[0]
    opens = timedelta(minutes=policy.checkin_opens_minutes_before)
    current = [s for s in live
               if session_start_at(s.session_date, s.start_time) - opens <= now < session_end_at(s.session_date, s.end_time)]
    if current:
        return current[0]
    started = [s for s in live if session_start_at(s.session_date, s.start_time) <= now]
    return started[-1] if started else live[0]


async def _records_before(db: AsyncSession, session_id: int) -> Dict[int, tuple]:
    rows = (await db.execute(select(AttendanceRecord).where(AttendanceRecord.session_id == session_id))).scalars().all()
    return {r.student_id: (normalize_status(r.status), bool(r.excluded_from_metrics), r.exclusion_reason) for r in rows}


def _outcome(student_id: int, final_status: Optional[str], before: Dict[int, tuple]) -> str:
    prev = before.get(student_id)
    if prev is None:
        return "created"
    if prev[0] != final_status or (prev[1] and prev[2] in PROVENANCE_EXCLUSIONS):
        return "updated"
    return "unchanged"


def _results(result, before: Dict[int, tuple]) -> List[Dict[str, Any]]:
    return [
        {
            "student_id": sid,
            "status": st,
            "outcome": _outcome(sid, st, before),
            "record_id": result.record_ids.get(sid),
        }
        for sid, st in sorted(result.statuses.items())
    ]


# ============================================================================
# Dashboard / schedule / roster
# ============================================================================

@router.get("/dashboard")
async def get_teacher_dashboard(
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get teacher dashboard overview with key statistics and information.
    ``today_schedule`` is built from today's class sessions (materialized on demand); it is
    empty between terms (``term_state``).
    """
    me = current_teacher.id
    today = app_today()
    policy = await get_attendance_policy(db)

    schedules = (await db.execute(
        select(ClassSchedule)
        .where(ClassSchedule.teacher_id == me)
        .where(ClassSchedule.is_active == True)
    )).scalars().all()
    cohorts = sorted({(s.faculty_id, s.semester) for s in schedules})

    # Unique students across the teacher's cohorts (cohorts are disjoint)
    total_students = 0
    for faculty_id, semester in cohorts:
        total_students += await _roster_size(db, faculty_id, semester, today)

    # Today's sessions (Rule §13.1: read class_sessions, materialized on demand)
    ctx = await get_term_context(db, as_of=today)
    today_sessions: List[ClassSession] = []
    if ctx.current_term is not None:
        found: Dict[int, ClassSession] = {}
        for faculty_id, semester in cohorts:
            for s in await ensure_sessions_for(db, session_date=today, faculty_id=faculty_id,
                                               semester=semester, policy=policy):
                found[s.id] = s
        for s in (await db.execute(
            select(ClassSession).where(ClassSession.session_date == today, ClassSession.teacher_id == me)
        )).scalars().all():
            found[s.id] = s
        today_sessions = sorted(await _owned_sessions(db, me, found.values()), key=lambda s: (s.start_time, s.id))

    subject_ids = sorted({s.subject_id for s in schedules} | {s.subject_id for s in today_sessions})
    subjects_by_id = {}
    if subject_ids:
        subjects_by_id = {s.id: s for s in (await db.execute(select(Subject).where(Subject.id.in_(subject_ids)))).scalars().all()}
    taught_subjects = [subjects_by_id[i] for i in sorted({s.subject_id for s in schedules}) if i in subjects_by_id]

    schedule_rows = {s.id: s for s in schedules}
    missing_sched = {s.schedule_id for s in today_sessions if s.schedule_id and s.schedule_id not in schedule_rows}
    if missing_sched:
        for row in (await db.execute(select(ClassSchedule).where(ClassSchedule.id.in_(missing_sched)))).scalars().all():
            schedule_rows[row.id] = row
    recorded = await _record_counts(db, [s.id for s in today_sessions])
    roster_sizes: Dict[tuple, int] = {}
    for s in today_sessions:
        key = (s.faculty_id, s.semester)
        if key not in roster_sizes:
            roster_sizes[key] = await _roster_size(db, s.faculty_id, s.semester, today)

    # Attendance in the teacher's held sessions over the last 7 days
    week_start = today - timedelta(days=7)
    stats_rows = (await db.execute(
        select(AttendanceRecord.status, func.count(AttendanceRecord.id))
        .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
        .outerjoin(ClassSchedule, ClassSchedule.id == ClassSession.schedule_id)
        .where(
            or_(ClassSession.teacher_id == me, ClassSchedule.teacher_id == me),
            ClassSession.status == SessionStatus.held.value,
            ClassSession.session_date >= week_start,
            ClassSession.session_date <= today,
            AttendanceRecord.excluded_from_metrics.is_(False),
        )
        .group_by(AttendanceRecord.status)
    )).all()
    attendance_stats = {normalize_status(st): int(n) for st, n in stats_rows}
    unrecorded_count = await count_unrecorded_sessions(db, policy=policy, teacher_id=me)

    # Get teacher's faculty info
    faculty_name = None
    if current_teacher.faculty_id:
        faculty = (await db.execute(select(Faculty).where(Faculty.id == current_teacher.faculty_id))).scalars().first()
        if faculty:
            faculty_name = faculty.name

    # Get teacher's email from user
    email = None
    phone = current_teacher.phone_number
    if current_teacher.user_id:
        user = (await db.execute(select(User).where(User.id == current_teacher.user_id))).scalars().first()
        if user:
            email = user.email

    teacher_info = {
        "id": current_teacher.id,
        "teacher_id": current_teacher.teacher_id,
        "name": current_teacher.name,
        "email": email,
        "phone": phone,
        "department": current_teacher.department,
        "office_location": current_teacher.office_location,
        "faculty_id": current_teacher.faculty_id,
        "faculty_name": faculty_name
    }

    today_schedule = []
    for s in today_sessions:
        sched = schedule_rows.get(s.schedule_id) if s.schedule_id else None
        subject = subjects_by_id.get(s.subject_id)
        today_schedule.append({
            "id": s.schedule_id if s.schedule_id is not None else s.id,
            "schedule_id": s.schedule_id,
            "session_id": s.id,
            "session_status": s.status,
            "kind": s.kind,
            "subject_id": s.subject_id,
            "subject_name": subject.name if subject else "Unknown",
            "subject_code": subject.code if subject else None,
            "faculty_id": s.faculty_id,
            "start_time": _hhmm(s.start_time),
            "end_time": _hhmm(s.end_time),
            "classroom": sched.classroom if sched else None,
            "semester": s.semester,
            # Cancellation status for THIS session only
            "is_cancelled": s.status == SessionStatus.cancelled,
            "cancellation_reason": s.cancellation_reason if s.status == SessionStatus.cancelled else None,
            "recorded_count": recorded.get(s.id, 0),
            "roster_size": roster_sizes.get((s.faculty_id, s.semester), 0),
            "submitted_at": _iso(s.submitted_at),
        })

    await db.commit()  # persist on-demand materialization

    return {
        "teacher": teacher_info,
        "date": today.isoformat(),
        "term_state": ctx.state,
        "term": ctx.current_term.summary() if ctx.current_term else None,
        "stats": {
            "total_subjects": len(taught_subjects),
            "total_classes": len(schedules),
            "total_students": total_students,
            "classes_today": len(today_schedule),
            "unrecorded_sessions": unrecorded_count,
        },
        "attendance_last_7_days": {
            "present": attendance_stats.get("present", 0),
            "absent": attendance_stats.get("absent", 0),
            "late": attendance_stats.get("late", 0),
            "excused": attendance_stats.get("excused", 0),
        },
        "subjects": [
            {
                "id": s.id,
                "name": s.name,
                "code": s.code,
                "credits": s.credits,
                "semesters": sorted(list(set([
                    sch.semester for sch in schedules if sch.subject_id == s.id
                ])))  # List of semesters this subject is taught in
            } for s in taught_subjects
        ],
        "today_schedule": today_schedule,
    }


@router.get("/schedule")
async def get_teacher_schedule(
    day_of_week: str = Query(None, description="Filter by day (monday, tuesday, etc.)"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get teacher's class schedule, optionally filtered by day.
    """
    query = select(ClassSchedule).where(
        and_(
            ClassSchedule.teacher_id == current_teacher.id,
            ClassSchedule.is_active == True
        )
    )

    if day_of_week:
        try:
            day = DayOfWeek(day_of_week.strip().lower())
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid day_of_week")
        query = query.where(ClassSchedule.day_of_week == day)

    result = await db.execute(query)
    schedules = result.scalars().all()

    # Get subjects for these schedules
    subject_ids = list(set([s.subject_id for s in schedules]))
    subjects = {}
    if subject_ids:
        subjects_result = await db.execute(
            select(Subject).where(Subject.id.in_(subject_ids))
        )
        subjects = {s.id: s for s in subjects_result.scalars().all()}

    return [
        {
            "id": schedule.id,
            "day_of_week": schedule.day_of_week.value,
            "start_time": schedule.start_time.strftime("%H:%M"),
            "end_time": schedule.end_time.strftime("%H:%M"),
            "classroom": schedule.classroom,
            "semester": schedule.semester,
            "academic_year": schedule.academic_year,
            "faculty_id": schedule.faculty_id,
            "subject": {
                "id": subjects[schedule.subject_id].id,
                "name": subjects[schedule.subject_id].name,
                "code": subjects[schedule.subject_id].code
            } if schedule.subject_id in subjects else None
        }
        for schedule in schedules
    ]


@router.get("/subjects/{subject_id}/students")
async def get_subject_students(
    subject_id: int,
    semester: int = Query(..., description="Semester number"),
    faculty_id: int = Query(None, description="Faculty ID filter"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of students enrolled in a specific subject (today's roster of each cohort the
    teacher teaches it to). Teacher must be teaching this subject.
    """
    cohorts = await _teacher_cohorts(db, current_teacher.id, subject_id, semester)
    if faculty_id is not None:
        cohorts = [c for c in cohorts if c[0] == faculty_id]
    if not cohorts:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not teaching this subject"
        )

    today = app_today()
    students: List[Student] = []
    for fid, sem in cohorts:
        students.extend(await _roster_students(db, fid, sem, today))

    return [
        {
            "id": s.id,
            "student_id": s.student_id,
            "name": s.user.full_name if s.user else "Unknown",
            "email": s.user.email if s.user else "Unknown",
            "semester": s.semester,
            "year": s.year,
            "faculty_id": s.faculty_id,
        }
        for s in students
    ]


@router.get("/subjects/{subject_id}/students-with-attendance")
async def get_subject_students_with_attendance(
    subject_id: int,
    semester: int = Query(..., description="Semester number"),
    date: Optional[str] = Query(None, description="Date for attendance (YYYY-MM-DD)"),
    session_id: Optional[int] = Query(None, description="Pick one slot when the subject meets more than once that day"),
    faculty_id: Optional[int] = Query(None, description="Cohort faculty (when the subject is taught to several)"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    The register of one class session: the session's roster (Rule §13.7) with each student's
    record. Unmarked students have ``attendance_status: null`` (never defaulted to absent).
    ``session`` is the selected slot; ``sessions`` lists all of the teacher's slots that day.
    """
    target_date = _parse_date(date)
    now = app_now()
    today = now.date()
    me = current_teacher.id

    cohorts = await _teacher_cohorts(db, me, subject_id, semester)
    if faculty_id is not None:
        cohorts = [c for c in cohorts if c[0] == faculty_id]
    if not cohorts:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not teaching this subject"
        )
    policy = await get_attendance_policy(db)
    ctx = await get_term_context(db, as_of=target_date)

    day_sessions: Dict[int, ClassSession] = {}
    for fid, sem in cohorts:
        if target_date <= today:
            found = await ensure_sessions_for(db, session_date=target_date, faculty_id=fid, semester=sem,
                                              subject_id=subject_id, policy=policy)
        else:  # never pre-materialize future dates (schedule edits apply from the next materialization)
            found = (await db.execute(
                select(ClassSession).where(ClassSession.session_date == target_date, ClassSession.faculty_id == fid,
                                           ClassSession.semester == sem, ClassSession.subject_id == subject_id)
            )).scalars().all()
        for s in found:
            day_sessions[s.id] = s
    owned = sorted(await _owned_sessions(db, me, day_sessions.values()), key=lambda s: (s.start_time, s.id))

    if session_id is not None:
        selected = next((s for s in owned if s.id == session_id), None)
        if selected is None:
            await db.rollback()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail={"code": "session_not_found",
                                        "message": "No class session of yours matches that session_id on this date"})
    else:
        selected = _pick_default_session(owned, now, policy)

    student_rows: List[Student] = []
    records: Dict[int, AttendanceRecord] = {}
    roster_ids: set = set()
    if selected is not None:
        student_rows = await _roster_students(db, selected.faculty_id, selected.semester, target_date)
        roster_ids = {s.id for s in student_rows}
        for r in (await db.execute(select(AttendanceRecord).where(AttendanceRecord.session_id == selected.id))).scalars().all():
            records[r.student_id] = r
        extra_ids = set(records) - roster_ids
        if extra_ids:  # recorded students who left the cohort since: shown, flagged not enrolled
            student_rows += list((await db.execute(
                select(Student).options(selectinload(Student.user)).where(Student.id.in_(extra_ids))
            )).scalars().all())
        is_cancelled = selected.status == SessionStatus.cancelled
        cancellation_reason = selected.cancellation_reason if is_cancelled else None
    else:
        # No session that day (non-class day, before session tracking, or between terms):
        # show the cohort roster with any unmapped legacy records, read-only.
        for fid, sem in cohorts:
            student_rows += await _roster_students(db, fid, sem, target_date)
        roster_ids = {s.id for s in student_rows}
        if roster_ids:
            for r in (await db.execute(
                select(AttendanceRecord).where(
                    AttendanceRecord.session_id.is_(None),
                    AttendanceRecord.subject_id == subject_id,
                    AttendanceRecord.date == target_date,
                    AttendanceRecord.student_id.in_(roster_ids),
                )
            )).scalars().all():
                records[r.student_id] = r
        cohort_faculties = [fid for fid, _ in cohorts]
        event = (await db.execute(
            select(AcademicEvent).where(
                AcademicEvent.event_type == EventType.CANCELLED_CLASS,
                AcademicEvent.is_active == True,
                AcademicEvent.start_date <= target_date,
                func.coalesce(AcademicEvent.end_date, AcademicEvent.start_date) >= target_date,
                or_(AcademicEvent.subject_id.is_(None), AcademicEvent.subject_id == subject_id),
                or_(AcademicEvent.faculty_id.is_(None), AcademicEvent.faculty_id.in_(cohort_faculties)),
            ).limit(1)
        )).scalars().first()
        is_cancelled = event is not None
        cancellation_reason = None
        if event is not None and isinstance(event.notification_settings, dict):
            cancellation_reason = event.notification_settings.get("cancellation_reason")

    students_with_attendance = []
    for student in student_rows:
        rec = records.get(student.id)
        students_with_attendance.append({
            "id": student.id,
            "student_id": student.student_id,
            "name": student.user.full_name if student.user else "Unknown",
            "email": student.user.email if student.user else "",
            "semester": student.semester,
            "attendance_status": normalize_status(rec.status) if rec is not None else None,
            "source": rec.source if rec is not None else None,
            "record_id": rec.id if rec is not None else None,
            "excluded_from_metrics": bool(rec.excluded_from_metrics) if rec is not None else False,
            "enrolled": student.id in roster_ids,
            "faculty_id": student.faculty_id
        })

    can_edit, edit_block_reason = _edit_state(selected, now, policy)
    counts = {k: sum(1 for s in students_with_attendance if s["attendance_status"] == k)
              for k in ("present", "absent", "late", "excused")}
    payload = {
        "students": students_with_attendance,
        "date": target_date.isoformat(),
        "semester": semester,
        "subject_id": subject_id,
        "faculty_id": selected.faculty_id if selected is not None else cohorts[0][0],
        "total_students": len(students_with_attendance),
        "present_count": counts["present"],
        "absent_count": counts["absent"],
        "late_count": counts["late"],
        "excused_count": counts["excused"],
        "unmarked_count": sum(1 for s in students_with_attendance if s["attendance_status"] is None),
        "is_cancelled": is_cancelled,
        "cancellation_reason": cancellation_reason,
        "session": _session_dict(selected) if selected is not None else None,
        "sessions": [_session_dict(s) for s in owned],
        "can_edit": can_edit,
        "edit_block_reason": edit_block_reason,
        "term_state": ctx.state,
    }
    await db.commit()  # persist on-demand materialization
    return payload


@router.get("/subjects/{subject_id}/attendance")
async def get_subject_attendance(
    subject_id: int,
    start_date: date = Query(None, description="Start date for filtering"),
    end_date: date = Query(None, description="End date for filtering"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get attendance records for a specific subject, limited to the cohorts the teacher teaches it to.
    Teacher must be teaching this subject.
    """
    cohorts = await _teacher_cohorts(db, current_teacher.id, subject_id)
    if not cohorts:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not teaching this subject"
        )

    # Build attendance query with eager-loaded student and user to avoid async lazy loads
    query = (
        select(AttendanceRecord, ClassSession.status)
        .options(selectinload(AttendanceRecord.student).selectinload(Student.user))
        .join(Student, Student.id == AttendanceRecord.student_id)
        .outerjoin(ClassSession, ClassSession.id == AttendanceRecord.session_id)
        .where(AttendanceRecord.subject_id == subject_id)
        .where(or_(*[and_(Student.faculty_id == f, Student.semester == s) for f, s in cohorts]))
    )

    if start_date:
        query = query.where(AttendanceRecord.date >= start_date)
    if end_date:
        query = query.where(AttendanceRecord.date <= end_date)

    query = query.order_by(desc(AttendanceRecord.date), AttendanceRecord.id)

    rows = (await db.execute(query)).all()

    return [
        {
            "id": r.id,
            "student_id": r.student.student_id,
            "student_name": r.student.user.full_name if r.student.user else "Unknown",
            "date": r.date.isoformat(),
            "status": normalize_status(r.status),
            "method": r.method.value if r.method is not None else None,
            "confidence_score": float(r.confidence_score) if r.confidence_score else None,
            "period": r.period,
            "time_slot": r.time_slot,
            "session_id": r.session_id,
            "session_status": session_status,
            "source": r.source,
            "excluded_from_metrics": bool(r.excluded_from_metrics),
        }
        for r, session_status in rows
    ]


@router.get("/subjects/{subject_id}/analytics")
async def get_subject_analytics(
    subject_id: int,
    semester: int = Query(..., description="Semester number"),
    faculty_id: Optional[int] = Query(None, description="Cohort faculty filter"),
    term_id: Optional[int] = Query(None, description="Report on this term instead of the current/most recent one"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get analytics for a specific subject (Rule §8 via ``attendance_metrics``): only held,
    non-cancelled sessions count; late counts per policy; no data -> ``percentage: null``.
    Teacher must be teaching this subject.
    """
    cohorts = await _teacher_cohorts(db, current_teacher.id, subject_id, semester)
    if faculty_id is not None:
        cohorts = [c for c in cohorts if c[0] == faculty_id]
    if not cohorts:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not teaching this subject"
        )

    policy = await get_attendance_policy(db)
    try:
        reports = [
            await compute_cohort_subject_metrics(db, subject_id, fid, sem, term_id=term_id, policy=policy)
            for fid, sem in cohorts
        ]
    except DomainError as err:
        raise _http_error(err)

    student_attendance = []
    total = Counts()
    sessions_summary = {"held": 0, "unrecorded": 0, "cancelled": 0, "upcoming": 0}
    for (fid, _sem), report in zip(cohorts, reports):
        agg = report["aggregate"]
        total.add(Counts(present=agg["present"], late=agg["late"], absent=agg["absent"], excused=agg["excused"],
                         cancelled_sessions=agg["cancelled_sessions"], unrecorded=agg["unrecorded"]))
        for key in sessions_summary:
            sessions_summary[key] += int(report["sessions"].get(key, 0))
        for st in report["students"]:
            row = {k: v for k, v in st.items() if k not in ("student_id", "student_number", "name")}
            row.update({
                "id": st["student_id"],
                "student_id": st["student_number"],
                "student_name": st["name"] or "Unknown",
                "faculty_id": fid,
            })
            student_attendance.append(row)

    # Sort by attendance percentage (students without data last)
    student_attendance.sort(key=lambda x: (x["percentage"] is not None, x["attendance_percentage"]), reverse=True)
    aggregate = reports[0]["aggregate"] if len(reports) == 1 else summarize_counts(total, policy)

    return {
        "subject_id": subject_id,
        "semester": semester,
        "total_students": len(student_attendance),
        "overall_stats": {
            "present": aggregate["present"],
            "absent": aggregate["absent"],
            "late": aggregate["late"],
            "excused": aggregate["excused"],
        },
        "student_attendance": student_attendance,
        # Rule §13.12 fields (session-weighted over all of the teacher's cohorts for this subject)
        "aggregate": aggregate,
        "percentage": aggregate["percentage"],
        "has_data": aggregate["has_data"],
        "considered": aggregate["considered"],
        "attended": aggregate["attended"],
        "excused": aggregate["excused"],
        "unrecorded": aggregate["unrecorded"],
        "eligible": aggregate["eligible"],
        "eligibility_provisional": aggregate["eligibility_provisional"],
        "band": aggregate["band"],
        "sessions": sessions_summary,
        "term": reports[0]["term"],
        "term_state": reports[0]["term_state"],
        "minimum_percentage": policy.minimum_percentage,
    }


# ============================================================================
# ENHANCED ATTENDANCE ENDPOINTS
# ============================================================================

@router.post("/attendance/mark")
async def mark_attendance(
    attendance_data: AttendanceMarkRequest,
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark attendance for a single student in one of the teacher's class sessions (via the
    recording service). If the session is still ``scheduled`` after it ended, the write would
    mark it held, so ``confirm_held: true`` is required (409 ``confirm_held`` otherwise).
    """
    student = (await db.execute(select(Student).where(Student.id == attendance_data.student_id))).scalars().first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    session_date = _parse_date(attendance_data.date)
    start_time = _parse_time(attendance_data.start_time) or _parse_time(attendance_data.time_slot, strict=False)
    policy = await get_attendance_policy(db)
    reason = attendance_data.reason or attendance_data.notes
    try:
        session = await _resolve_teacher_session(
            db, teacher_id=current_teacher.id, subject_id=attendance_data.subject_id,
            faculty_id=None if attendance_data.session_id else student.faculty_id,
            semester=None if attendance_data.session_id else student.semester,
            session_date=session_date, session_id=attendance_data.session_id, start_time=start_time, policy=policy,
        )
        await lock_session(db, session.id)
        before = await _records_before(db, session.id)
        result = await record_attendance(
            db, actor=current_user, session=session,
            entries=[Entry(student_id=student.id, status=attendance_data.status, reason=attendance_data.reason)],
            reason=reason, submit=False, confirm_held=attendance_data.confirm_held, policy=policy,
        )
    except DomainError as err:
        await _fail(db, err)
    results = _results(result, before)
    await db.commit()

    outcome = results[0]["outcome"] if results else "unchanged"
    messages = {
        "created": "Attendance marked successfully",
        "updated": "Attendance updated successfully",
        "unchanged": "Attendance already recorded with this status",
    }
    return {
        "success": True,
        "message": messages[outcome],
        "attendance_id": result.record_ids.get(student.id),
        "updated": outcome == "updated",
        "outcome": outcome,
        "status": result.statuses.get(student.id),
        "session_id": result.session_id,
        "session_status": result.session_status,
        "results": results,
    }


@router.post("/attendance/bulk-mark")
async def bulk_mark_attendance(
    bulk_data: BulkAttendanceMarkRequest,
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Register submission for one of the teacher's class sessions (``record_attendance`` with
    ``submit=True``): all entries are validated first and nothing is written if any is invalid
    (400 ``invalid_entries``). Send only changed rows; ``mark_remaining_absent`` writes absent
    for roster students without a record. Cancelled session -> 409 ``session_cancelled``.
    """
    session_date = _parse_date(bulk_data.date)
    start_time = _parse_time(bulk_data.start_time) or _parse_time(bulk_data.time_slot, strict=False)
    policy = await get_attendance_policy(db)

    entries = []
    for row in bulk_data.attendance_records:
        if isinstance(row, dict):
            entries.append(Entry(student_id=row.get("student_id"), status=row.get("status"), reason=row.get("reason")))
        else:
            entries.append(Entry(student_id=None, status=None))

    try:
        session = await _resolve_teacher_session(
            db, teacher_id=current_teacher.id, subject_id=bulk_data.subject_id, faculty_id=bulk_data.faculty_id,
            semester=bulk_data.semester, session_date=session_date, session_id=bulk_data.session_id,
            start_time=start_time, policy=policy,
        )
        await lock_session(db, session.id)
        before = await _records_before(db, session.id)
        result = await record_attendance(
            db, actor=current_user, session=session, entries=entries, reason=bulk_data.reason, submit=True,
            confirm_held=bulk_data.confirm_held, mark_remaining_absent=bulk_data.mark_remaining_absent, policy=policy,
        )
    except DomainError as err:
        await _fail(db, err)
    results = _results(result, before)
    await db.commit()

    return {
        "success": True,
        "message": "Bulk attendance marking completed",
        "total_processed": len(results),
        "success_count": result.created + result.updated + result.unchanged,
        "failed_count": 0,
        "errors": None,
        "session_id": result.session_id,
        "session_status": result.session_status,
        "submitted": result.submitted,
        "created": result.created,
        "updated": result.updated,
        "unchanged": result.unchanged,
        "results": results,
    }


@router.get("/attendance/my-classes")
async def get_teacher_classes_for_attendance(
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all classes (subject + semester + faculty combinations) taught by the teacher.
    This is used to populate the attendance interface.
    """
    # Get all schedules for this teacher
    schedules_result = await db.execute(
        select(ClassSchedule).options(
            selectinload(ClassSchedule.subject),
            selectinload(ClassSchedule.faculty)
        ).where(
            and_(
                ClassSchedule.teacher_id == current_teacher.id,
                ClassSchedule.is_active == True
            )
        )
    )
    schedules = schedules_result.scalars().all()
    today = app_today()

    # Group by subject + semester + faculty
    classes_dict = {}
    roster_sizes: Dict[tuple, int] = {}
    for schedule in schedules:
        key = f"{schedule.subject_id}_{schedule.semester}_{schedule.faculty_id}"
        if key not in classes_dict:
            cohort = (schedule.faculty_id, schedule.semester)
            if cohort not in roster_sizes:
                roster_sizes[cohort] = await _roster_size(db, schedule.faculty_id, schedule.semester, today)

            classes_dict[key] = {
                "subject_id": schedule.subject_id,
                "subject_name": schedule.subject.name if schedule.subject else "Unknown",
                "subject_code": schedule.subject.code if schedule.subject else "N/A",
                "semester": schedule.semester,
                "faculty_id": schedule.faculty_id,
                "faculty_name": schedule.faculty.name if schedule.faculty else "Unknown",
                "academic_year": schedule.academic_year,
                "student_count": roster_sizes[cohort],
                "schedules": []
            }

        # Add schedule time info
        classes_dict[key]["schedules"].append({
            "schedule_id": schedule.id,
            "day": schedule.day_of_week.value,
            "start_time": schedule.start_time.strftime("%H:%M"),
            "end_time": schedule.end_time.strftime("%H:%M"),
            "classroom": schedule.classroom
        })

    return list(classes_dict.values())

# ============================================================================
# CALENDAR ENDPOINTS (VIEW-ONLY for Teachers)
# ============================================================================

@router.get("/calendar")
async def get_teacher_calendar(
    start_date: date = Query(..., description="Start date for calendar view"),
    end_date: date = Query(..., description="End date for calendar view"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Get calendar events for the teacher's assigned subjects.
    Teachers can VIEW calendar but cannot edit (read-only).
    """
    # Get teacher's subject IDs
    schedules_result = await db.execute(
        select(ClassSchedule.subject_id).where(
            and_(
                ClassSchedule.teacher_id == current_teacher.id,
                ClassSchedule.is_active == True
            )
        ).distinct()
    )
    subject_ids = [row[0] for row in schedules_result.all()]
    
    if not subject_ids:
        return []
    
    # Academic events touching the teacher's subjects (or university/faculty-wide) that
    # overlap the window; inactive (soft-deleted) events are hidden.
    events_result = await db.execute(
        select(AcademicEvent).options(
            selectinload(AcademicEvent.subject),
            selectinload(AcademicEvent.faculty)
        ).where(
            and_(
                AcademicEvent.is_active.isnot(False),
                or_(AcademicEvent.subject_id.in_(subject_ids), AcademicEvent.subject_id.is_(None)),
                AcademicEvent.start_date <= end_date,
                func.coalesce(AcademicEvent.end_date, AcademicEvent.start_date) >= start_date,
            )
        ).order_by(AcademicEvent.start_date)
    )
    events = events_result.scalars().all()

    items = [
        {
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "event_type": event.event_type.value,
            "start_date": event.start_date.isoformat(),
            "end_date": (event.end_date or event.start_date).isoformat(),
            "subject_id": event.subject_id,
            "subject_name": event.subject.name if event.subject else None,
            "faculty_id": event.faculty_id,
            "faculty_name": event.faculty.name if event.faculty else None,
            "is_holiday": event.event_type == EventType.HOLIDAY,
            "read_only": True  # Indicate this is read-only for teachers
        }
        for event in events
    ]

    # Session-level cancellations (DOMAIN_RULES §5.2) no longer create calendar events,
    # so surface the teacher's cancelled sessions explicitly.
    cancelled = (await db.execute(
        select(ClassSession, Subject.name)
        .join(Subject, Subject.id == ClassSession.subject_id)
        .where(
            ClassSession.teacher_id == current_teacher.id,
            ClassSession.status == SessionStatus.cancelled.value,
            ClassSession.session_date >= start_date,
            ClassSession.session_date <= end_date,
        )
        .order_by(ClassSession.session_date, ClassSession.start_time)
    )).all()
    for sess, subject_name in cancelled:
        items.append({
            "id": None,
            "session_id": sess.id,
            "title": f"Cancelled: {subject_name}",
            "description": sess.cancellation_reason,
            "event_type": EventType.CANCELLED_CLASS.value,
            "start_date": sess.session_date.isoformat(),
            "end_date": sess.session_date.isoformat(),
            "start_time": sess.start_time.strftime("%H:%M"),
            "end_time": sess.end_time.strftime("%H:%M"),
            "subject_id": sess.subject_id,
            "subject_name": subject_name,
            "faculty_id": sess.faculty_id,
            "faculty_name": None,
            "is_holiday": False,
            "read_only": True,
        })
    items.sort(key=lambda i: (i["start_date"], i.get("start_time") or ""))
    return items


# ============================================================================
# NOTIFICATION ENDPOINTS (Teacher-specific)
# ============================================================================

@router.post("/notifications/send")
async def send_teacher_notification(
    notification_data: TeacherNotificationRequest,
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send notification to students in a specific subject/class.
    Teacher must be assigned to teach this subject.
    """
    # Verify teacher teaches this subject
    schedule_result = await db.execute(
        select(ClassSchedule)
        .where(
            and_(
                ClassSchedule.teacher_id == current_teacher.id,
                ClassSchedule.subject_id == notification_data.subject_id,
                ClassSchedule.semester == notification_data.semester,
                ClassSchedule.is_active == True,
            )
        )
        .limit(1)
    )
    # Teacher may have multiple time slots for the same subject+semester; pick any active one
    schedule = schedule_result.scalars().first()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to send notifications for this subject"
        )
    
    # Get students in this class
    students_result = await db.execute(
        select(Student).where(
            and_(
                Student.faculty_id == schedule.faculty_id,
                Student.semester == notification_data.semester
            )
        )
    )
    students = students_result.scalars().all()
    
    if not students:
        return {
            "success": True,
            "message": "No students found in this class",
            "recipients_count": 0
        }
    
    # Import notification model
    from app.models.notifications import EnhancedNotification, NotificationScope, NotificationPriority, NotificationType
    
    # Map priority and type strings to enums
    priority_map = {
        "low": NotificationPriority.low,
        "medium": NotificationPriority.medium,
        "high": NotificationPriority.high
    }
    type_map = {
        "info": NotificationType.info,
        "warning": NotificationType.warning,
        "success": NotificationType.success,
        "danger": NotificationType.danger
    }
    
    # Create notification with subject-specific scope
    # We'll use faculty_specific scope since students are grouped by faculty
    notification = EnhancedNotification(
        title=notification_data.title,
        message=notification_data.message,
        type=type_map.get(notification_data.type, NotificationType.info),
        priority=priority_map.get(notification_data.priority, NotificationPriority.medium),
        scope=NotificationScope.faculty_specific,
        target_faculty_id=schedule.faculty_id,
        sender_id=current_user.id,
        sender_name=current_teacher.name,
        is_active=True,
        payload={
            "subject_id": notification_data.subject_id,
            "semester": notification_data.semester,
            "sent_by_teacher": True,
            "teacher_id": current_teacher.id
        }
    )
    
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    
    return {
        "success": True,
        "message": f"Notification sent to {len(students)} students",
        "recipients_count": len(students),
        "notification_id": notification.id
    }


async def _notify_cohort(
    db: AsyncSession,
    *,
    title: str,
    message: str,
    faculty_id: int,
    sender_id: int,
    sender_name: str,
    payload: Dict[str, Any],
    priority: str = "high",
    ntype: str = "warning",
) -> Optional[int]:
    """Create a faculty-scoped notification in its own transaction (after the session change was
    committed). A failure is logged and never undoes the committed change."""
    from app.models.notifications import EnhancedNotification, NotificationScope, NotificationPriority, NotificationType
    try:
        notification = EnhancedNotification(
            title=title,
            message=message,
            type=getattr(NotificationType, ntype, NotificationType.info),
            priority=getattr(NotificationPriority, priority, NotificationPriority.medium),
            scope=NotificationScope.faculty_specific,
            target_faculty_id=faculty_id,
            sender_id=sender_id,
            sender_name=sender_name,
            is_active=True,
            payload=payload,
        )
        db.add(notification)
        await db.commit()
        return notification.id
    except Exception:  # pragma: no cover - notification is best-effort
        logger.exception("Failed to create class notification")
        await db.rollback()
        return None


async def _session_context(db: AsyncSession, session: ClassSession) -> Dict[str, Any]:
    """Plain values needed after commit (ORM objects may be expired by a later rollback)."""
    subject = (await db.execute(select(Subject).where(Subject.id == session.subject_id))).scalars().first()
    return {
        "session_id": session.id,
        "subject_id": session.subject_id,
        "subject_name": subject.name if subject else None,
        "faculty_id": session.faculty_id,
        "semester": session.semester,
        "session_date": session.session_date,
        "start_time": _hhmm(session.start_time),
        "end_time": _hhmm(session.end_time),
        "status": session.status,
        "roster_size": await _roster_size(db, session.faculty_id, session.semester, session.session_date),
    }


@router.post("/classes/cancel")
async def cancel_class(
    request: CancelClassRequest,
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancel one class session (Rule §5.2) and optionally notify students.

    Target: ``session_id``, or ``schedule_id`` + ``date`` (the date must be a real meeting of
    that timetable row — wrong weekday, holiday, outside the term -> 422 ``not_expected``).
    Owner teacher only; future sessions any time, past sessions within the teacher edit window.
    Existing attendance records are kept and drop out of metrics while the session is cancelled.
    The cancellation is one transaction; the student notification is created after it commits.
    """
    policy = await get_attendance_policy(db)
    sender_name = current_teacher.name
    sender_id = current_user.id
    try:
        if request.session_id is not None:
            session = await _load_session(db, request.session_id)
        else:
            if request.schedule_id is None or not request.date:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Provide session_id, or schedule_id and date")
            cancellation_date = _parse_date(request.date)
            schedule = (await db.execute(
                select(ClassSchedule).where(ClassSchedule.id == request.schedule_id)
            )).scalars().first()
            if schedule is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class schedule not found")
            tracking_start = policy.tracking_start_date
            if tracking_start is not None and cancellation_date < tracking_start:
                # Rule §13.1: never materialize sessions before tracking started; only an
                # already-existing session (e.g. from the legacy backfill) can be cancelled.
                session = (await db.execute(
                    select(ClassSession).where(
                        ClassSession.session_date == cancellation_date,
                        or_(ClassSession.schedule_id == schedule.id,
                            and_(ClassSession.subject_id == schedule.subject_id,
                                 ClassSession.faculty_id == schedule.faculty_id,
                                 ClassSession.semester == schedule.semester,
                                 ClassSession.start_time == schedule.start_time)),
                    ).order_by(ClassSession.id).limit(1)
                )).scalars().first()
                if session is None:
                    raise DomainError("before_tracking_start",
                                      f"Classes before {tracking_start.isoformat()} are not tracked as sessions",
                                      http_status=422, details={"tracking_start_date": tracking_start.isoformat()})
            else:
                session = await get_or_create_session(db, schedule=schedule, session_date=cancellation_date,
                                                      policy=policy)
        session = await cancel_session(db, session=session, actor=current_user, reason=request.reason, policy=policy)
        info = await _session_context(db, session)
    except DomainError as err:
        await _fail(db, err)
    await db.commit()

    reason = (request.reason or "").strip()
    notification_id = None
    if request.notify_students and info["roster_size"] > 0:
        subject_label = info["subject_name"] or "class"
        notification_id = await _notify_cohort(
            db,
            title=f"Class Cancelled: {info['subject_name'] or 'Your Class'}",
            message=(
                f"Your {subject_label} on {info['session_date'].strftime('%B %d, %Y')} at {info['start_time']} "
                f"has been cancelled.\n\nReason: {reason}\n\nYou will be notified if the class is rescheduled."
            ),
            faculty_id=info["faculty_id"],
            sender_id=sender_id,
            sender_name=sender_name,
            payload={
                "subject_id": info["subject_id"],
                "semester": info["semester"],
                "class_cancelled": True,
                "cancellation_date": info["session_date"].isoformat(),
                "original_time": info["start_time"],
                "reason": reason,
                "session_id": info["session_id"],
                "event_id": None,
            },
        )

    return {
        "success": True,
        "message": f"Class cancelled successfully{' and students notified' if notification_id else ''}",
        "event_id": None,  # cancellation now lives on the class session (no calendar event)
        "session_id": info["session_id"],
        "session_status": info["status"],
        "notification_id": notification_id,
        "students_notified": info["roster_size"] if notification_id else 0,
        "cancellation_date": info["session_date"].isoformat(),
        "start_time": info["start_time"],
        "end_time": info["end_time"],
        "subject_name": info["subject_name"],
    }


@router.post("/classes/uncancel")
async def uncancel_class(
    request: UncancelClassRequest,
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Restore a cancelled class session (Rule §5.2): ``held`` if it already has attendance or was
    submitted, else ``scheduled``. Target: ``session_id``, or ``subject_id`` + ``date`` (with
    ``schedule_id`` / ``faculty_id`` / ``semester`` / ``start_time`` to pick a slot). Reason
    required; owner teacher within the edit window for past sessions. Audited.
    """
    policy = await get_attendance_policy(db)
    sender_name = current_teacher.name
    sender_id = current_user.id
    try:
        if request.session_id is not None:
            session = await _load_session(db, request.session_id)
        else:
            if request.subject_id is None or not request.date:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Provide session_id, or subject_id and date")
            target_date = _parse_date(request.date)
            stmt = select(ClassSession).where(
                ClassSession.subject_id == request.subject_id,
                ClassSession.session_date == target_date,
                ClassSession.status == SessionStatus.cancelled.value,
            )
            if request.schedule_id is not None:
                stmt = stmt.where(ClassSession.schedule_id == request.schedule_id)
            if request.faculty_id is not None:
                stmt = stmt.where(ClassSession.faculty_id == request.faculty_id)
            if request.semester is not None:
                stmt = stmt.where(ClassSession.semester == request.semester)
            start_time = _parse_time(request.start_time)
            if start_time is not None:
                stmt = stmt.where(ClassSession.start_time == start_time)
            candidates = list((await db.execute(stmt.order_by(ClassSession.start_time, ClassSession.id))).scalars().all())
            if len(candidates) > 1:
                candidates = await _owned_sessions(db, current_teacher.id, candidates) or candidates
            if not candidates:
                raise DomainError("session_not_found", "No cancelled class session matches", http_status=404,
                                  details={"subject_id": request.subject_id, "date": target_date.isoformat()})
            if len(candidates) > 1:
                raise DomainError("ambiguous_session", "Several cancelled sessions match; specify session_id",
                                  http_status=409, details={"slots": [_session_dict(s) for s in candidates]})
            session = candidates[0]
        session = await uncancel_session(db, session=session, actor=current_user, reason=request.reason, policy=policy)
        info = await _session_context(db, session)
    except DomainError as err:
        await _fail(db, err)
    await db.commit()

    notification_id = None
    if request.notify_students and info["roster_size"] > 0:
        notification_id = await _notify_cohort(
            db,
            title=f"Class Restored: {info['subject_name'] or 'Your Class'}",
            message=(
                f"Your {info['subject_name'] or 'class'} on {info['session_date'].strftime('%B %d, %Y')} at "
                f"{info['start_time']} will take place as scheduled."
            ),
            faculty_id=info["faculty_id"],
            sender_id=sender_id,
            sender_name=sender_name,
            payload={
                "subject_id": info["subject_id"],
                "semester": info["semester"],
                "class_restored": True,
                "session_date": info["session_date"].isoformat(),
                "original_time": info["start_time"],
                "session_id": info["session_id"],
            },
            priority="medium",
            ntype="info",
        )

    return {
        "success": True,
        "message": "Class restored",
        "session_id": info["session_id"],
        "session_status": info["status"],
        "session_date": info["session_date"].isoformat(),
        "start_time": info["start_time"],
        "end_time": info["end_time"],
        "subject_name": info["subject_name"],
        "notification_id": notification_id,
    }


@router.get("/notifications")
async def get_teacher_notifications(
    skip: int = 0,
    limit: int = 50,
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get notifications sent by this teacher or relevant to them.
    """
    from app.models.notifications import EnhancedNotification, NotificationReadReceipt    
    
    # Get notifications SENT BY THIS TEACHER only (teacher-specific "Sent Notifications")
    notifications_result = await db.execute(
        select(EnhancedNotification).options(
            selectinload(EnhancedNotification.read_receipts)
        ).where(
            and_(
                EnhancedNotification.is_active == True,
                EnhancedNotification.sender_id == current_user.id,
            )
        ).order_by(desc(EnhancedNotification.created_at)).offset(skip).limit(limit)
    )
    notifications = notifications_result.scalars().all()

    def serialize_notification(notif):
        # Safe payload; avoid Base.metadata name collision
        safe_payload = getattr(notif, "payload", None) if isinstance(getattr(notif, "payload", None), dict) else None
        return {
            "id": notif.id,
            "title": notif.title,
            "message": notif.message,
            "type": notif.type.value,
            "priority": notif.priority.value,
            "scope": notif.scope.value,
            "created_at": notif.created_at.isoformat(),
            "payload": safe_payload,
            "is_read": any(r.user_id == current_user.id for r in notif.read_receipts),
        }

    return [serialize_notification(notif) for notif in notifications]


# ============================================================================
# NOTIFICATION INBOX (per-user read/clear without deletion)
# ============================================================================

@router.get("/notifications/inbox")
async def get_teacher_notifications_inbox(
    only_unread: bool = Query(True, description="Return only unread (not dismissed) notifications"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Inbox for the current teacher (user). Returns notifications relevant to this user
    (global, faculty-specific to their faculty, or individual) excluding dismissed.
    """
    from app.models.notifications import EnhancedNotification, NotificationReadReceipt, NotificationScope

    # Relevance conditions
    relevance = or_(
        EnhancedNotification.scope == NotificationScope.global_scope,
        and_(
            EnhancedNotification.scope == NotificationScope.faculty_specific,
            EnhancedNotification.target_faculty_id == current_teacher.faculty_id,
        ),
        and_(
            EnhancedNotification.scope == NotificationScope.individual,
            EnhancedNotification.target_user_id == current_user.id,
        ),
    )

    # LEFT JOIN receipts for this user to evaluate read/dismiss state without excluding missing rows
    receipts_subq = (
        select(NotificationReadReceipt)
        .where(NotificationReadReceipt.user_id == current_user.id)
        .subquery()
    )

    # Base query
    query = (
        select(EnhancedNotification, receipts_subq.c.read_at, receipts_subq.c.dismissed_at)
        .outerjoin(receipts_subq, receipts_subq.c.notification_id == EnhancedNotification.id)
        .where(and_(EnhancedNotification.is_active == True, relevance))
    )

    # Exclude dismissed always
    query = query.where(or_(receipts_subq.c.dismissed_at.is_(None)))

    # Filter only unread if requested (no read_at)
    if only_unread:
        query = query.where(or_(receipts_subq.c.read_at.is_(None)))

    query = query.order_by(desc(EnhancedNotification.created_at), desc(EnhancedNotification.id)).offset(skip).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    def serialize_row(notif, read_at, dismissed_at):
        safe_payload = getattr(notif, "payload", None) if isinstance(getattr(notif, "payload", None), dict) else None
        return {
            "id": notif.id,
            "title": notif.title,
            "message": notif.message,
            "type": notif.type.value,
            "priority": notif.priority.value,
            "scope": notif.scope.value,
            "created_at": notif.created_at.isoformat(),
            "payload": safe_payload,
            "is_read": read_at is not None,
        }

    return [serialize_row(n, r, d) for (n, r, d) in rows]


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark a notification as read for the current user (idempotent).
    """
    from app.models.notifications import EnhancedNotification, NotificationReadReceipt, NotificationScope

    # Verify notification is relevant
    notif_result = await db.execute(
        select(EnhancedNotification).where(EnhancedNotification.id == notification_id)
    )
    notif = notif_result.scalars().first()
    if not notif or not notif.is_active:
        raise HTTPException(status_code=404, detail="Notification not found")

    is_relevant = (
        notif.scope == NotificationScope.global_scope or
        (notif.scope == NotificationScope.faculty_specific and notif.target_faculty_id == current_teacher.faculty_id) or
        (notif.scope == NotificationScope.individual and notif.target_user_id == current_user.id)
    )
    if not is_relevant:
        raise HTTPException(status_code=403, detail="Not authorized for this notification")

    # Upsert receipt
    receipt_result = await db.execute(
        select(NotificationReadReceipt).where(
            and_(
                NotificationReadReceipt.notification_id == notification_id,
                NotificationReadReceipt.user_id == current_user.id,
            )
        )
    )
    receipt = receipt_result.scalars().first()
    now = local_naive(app_now())
    if receipt:
        if receipt.read_at is None:
            receipt.read_at = now
        # don't change dismissed_at here
    else:
        new_receipt = NotificationReadReceipt(
            notification_id=notification_id,
            user_id=current_user.id,
            read_at=now,
            dismissed_at=None,
        )
        db.add(new_receipt)

    await db.commit()
    return {"success": True}


@router.post("/notifications/{notification_id}/clear")
async def clear_notification_for_user(
    notification_id: int,
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Dismiss a single notification for the current user (idempotent).
    """
    from app.models.notifications import EnhancedNotification, NotificationReadReceipt, NotificationScope

    notif_result = await db.execute(
        select(EnhancedNotification).where(EnhancedNotification.id == notification_id)
    )
    notif = notif_result.scalars().first()
    if not notif or not notif.is_active:
        raise HTTPException(status_code=404, detail="Notification not found")

    is_relevant = (
        notif.scope == NotificationScope.global_scope or
        (notif.scope == NotificationScope.faculty_specific and notif.target_faculty_id == current_teacher.faculty_id) or
        (notif.scope == NotificationScope.individual and notif.target_user_id == current_user.id)
    )
    if not is_relevant:
        raise HTTPException(status_code=403, detail="Not authorized for this notification")

    receipt_result = await db.execute(
        select(NotificationReadReceipt).where(
            and_(
                NotificationReadReceipt.notification_id == notification_id,
                NotificationReadReceipt.user_id == current_user.id,
            )
        )
    )
    receipt = receipt_result.scalars().first()
    now = local_naive(app_now())
    if receipt:
        receipt.dismissed_at = receipt.dismissed_at or now
        if receipt.read_at is None:
            receipt.read_at = now
    else:
        new_receipt = NotificationReadReceipt(
            notification_id=notification_id,
            user_id=current_user.id,
            read_at=now,
            dismissed_at=now,
        )
        db.add(new_receipt)

    await db.commit()
    return {"success": True}


@router.post("/notifications/clear")
async def clear_all_notifications_for_user(
    current_teacher: Teacher = Depends(get_current_teacher),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Dismiss all relevant notifications for current user.
    Performs an INSERT ... SELECT for missing receipts and an UPDATE for existing ones.
    """
    from app.models.notifications import EnhancedNotification, NotificationReadReceipt, NotificationScope

    # INSERT missing receipts as dismissed in a single SQL statement (PostgreSQL)
    insert_sql = text(
        """
        INSERT INTO notification_read_receipts (notification_id, user_id, read_at, dismissed_at)
        SELECT n.id, :uid, NOW(), NOW()
        FROM enhanced_notifications n
        LEFT JOIN notification_read_receipts r
          ON r.notification_id = n.id AND r.user_id = :uid
        WHERE n.is_active = TRUE
          AND (
                n.scope = :global
             OR (n.scope = :faculty AND n.target_faculty_id = :fid)
             OR (n.scope = :individual AND n.target_user_id = :uid)
          )
          AND r.id IS NULL
        """
    )

    await db.execute(
        insert_sql,
        {
            "uid": current_user.id,
            "fid": current_teacher.faculty_id,
            "global": "global_scope",
            "faculty": "faculty_specific",
            "individual": "individual",
        },
    )

    # UPDATE existing receipts to set dismissed_at where not already dismissed
    await db.execute(
        update(NotificationReadReceipt)
        .where(
            and_(
                NotificationReadReceipt.user_id == current_user.id,
                NotificationReadReceipt.dismissed_at.is_(None),
            )
        )
        .values(dismissed_at=local_naive(app_now()), read_at=func.coalesce(NotificationReadReceipt.read_at, local_naive(app_now())))
    )

    await db.commit()
    return {"success": True}
