"""Attendance routes (``/api/attendance``).

All business rules live in the domain services (DOMAIN_RULES §5-§8, §13); these routes parse
input, enforce role guards, delegate, commit, and translate :class:`DomainError`:

* writes -> ``attendance_recording.record_attendance`` (register submissions use ``submit=True``)
* sessions -> ``class_sessions`` (materialize / resolve / cancel / uncancel / make-up / unrecorded)
* percentages and day statuses -> ``attendance_metrics``
* auto-absent -> ``auto_absent_service``
* "today/now" -> ``app.core.clock``

Services flush; routes own the transaction (commit on success, rollback on a DomainError).
"""
from collections import Counter
from datetime import date, datetime, time, timedelta
from typing import Any, Iterable, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    get_current_user,
    get_teacher_cohorts,
    get_teacher_for_user,
    has_role,
    require_admin_or_teacher,
    require_admin_role,
    resolve_student_scope,
)
from app.core.clock import app_now, app_today
from app.core.database import get_db
from app.models import (
    AcademicEvent,
    AttendanceAuditLog,
    AttendanceRecord,
    ClassSchedule,
    ClassSession,
    EventType,
    Faculty,
    FaceVerificationAttempt,
    SessionStatus,
    Student,
    Subject,
    Teacher,
    User,
)
from app.services.attendance_metrics import (
    compute_student_day_statuses,
    compute_student_metrics,
    compute_students_overall,
)
from app.services.attendance_policy import get_attendance_policy
from app.services.attendance_recording import Entry, checkin_window, record_attendance, set_metrics_exclusion
from app.services.auto_absent_service import auto_absent_service
from app.services import presence_code as presence_codes
from app.services.face_policy import get_face_policy
from app.services.class_sessions import (
    actor_owns_session,
    clear_review,
    cancel_session,
    count_schedules_without_teacher,
    create_makeup_session,
    ensure_sessions_for,
    get_teacher_id,
    is_unrecorded,
    list_unrecorded_sessions,
    lock_session,
    resolve_session_for,
    roster_conditions,
    roster_start_sql,
    session_end_at,
    session_roster_ids,
    session_start_at,
    uncancel_session,
)
from app.services.domain_errors import DomainError

router = APIRouter(prefix="/attendance", tags=["attendance"])

UNMARKED_LEGACY_STATUS = "no_data"


# ============================================================================ helpers


def _domain_http(err: DomainError) -> HTTPException:
    """DomainError -> HTTPException (contract v1).

    Per-entry validation errors become ``400 {detail: {code: "invalid_entries", message, errors}}``;
    everything else keeps the service's status with ``detail = {code, message, details, **details}``.
    """
    if err.code == "validation_failed":
        detail = {
            "code": "invalid_entries",
            "message": err.message,
            "errors": err.details.get("errors", []),
            "details": err.details,
        }
        if "session_id" in err.details:
            detail["session_id"] = err.details["session_id"]
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    detail = err.to_dict()
    for key, value in err.details.items():
        detail.setdefault(key, value)
    return HTTPException(status_code=err.http_status, detail=detail)


async def _fail(db: AsyncSession, err: DomainError) -> HTTPException:
    await db.rollback()
    return _domain_http(err)


def _bad_request(message: str, code: str = "invalid_request") -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": code, "message": message})


def _parse_date(value: Any, field: str = "date") -> date:
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field}. Use YYYY-MM-DD")


def _parse_time(value: Any, field: str = "start_time") -> time:
    if isinstance(value, time):
        return value
    raw = str(value or "").strip()
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).time()
        except ValueError:
            continue
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field}. Use HH:MM")


def _opt_int(value: Any, field: str) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        raise _bad_request(f"{field} must be an integer")


def _as_bool(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    return bool(value)


def _status_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    return str(getattr(value, "value", value)).lower()


def _iso(value: Any) -> Optional[str]:
    return value.isoformat() if value is not None else None


def _hhmm(value: Optional[time]) -> Optional[str]:
    return value.strftime("%H:%M") if value is not None else None


async def _teacher_id_or_403(db: AsyncSession, user: Any) -> int:
    tid = await get_teacher_id(db, user)
    if tid is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teacher profile not found")
    return tid


async def _ensure_can_manage(db: AsyncSession, user: Any, session: ClassSession) -> None:
    """Admin, or the teacher who owns the session (snapshot or schedule teacher)."""
    if has_role(user, "admin"):
        return
    if has_role(user, "teacher") and await actor_owns_session(db, user, session):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "not_session_teacher", "message": "You are not the teacher of this class session"},
    )


async def _get_session_or_404(db: AsyncSession, session_id: int) -> ClassSession:
    session = (await db.execute(select(ClassSession).where(ClassSession.id == session_id))).scalars().first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "session_not_found", "message": f"Class session {session_id} not found"},
        )
    return session


# ---------------------------------------------------------------------------- batch lookups


async def _schedule_teachers(db: AsyncSession, schedule_ids: Iterable[Optional[int]]) -> dict[int, Optional[int]]:
    ids = sorted({i for i in schedule_ids if i is not None})
    if not ids:
        return {}
    rows = await db.execute(select(ClassSchedule.id, ClassSchedule.teacher_id).where(ClassSchedule.id.in_(ids)))
    return {sid: tid for sid, tid in rows.all()}


async def _teacher_names(db: AsyncSession, teacher_ids: Iterable[Optional[int]]) -> dict[int, Optional[str]]:
    ids = sorted({i for i in teacher_ids if i is not None})
    if not ids:
        return {}
    rows = await db.execute(
        select(Teacher.id, Teacher.name, User.full_name)
        .outerjoin(User, User.id == Teacher.user_id)
        .where(Teacher.id.in_(ids))
    )
    return {tid: (full_name or name) for tid, name, full_name in rows.all()}


async def _record_counts(db: AsyncSession, session_ids: Iterable[int]) -> dict[int, dict[str, int]]:
    ids = sorted({int(i) for i in session_ids})
    if not ids:
        return {}
    rows = await db.execute(
        select(AttendanceRecord.session_id, AttendanceRecord.status, func.count(AttendanceRecord.id))
        .where(AttendanceRecord.session_id.in_(ids))
        .group_by(AttendanceRecord.session_id, AttendanceRecord.status)
    )
    out: dict[int, dict[str, int]] = {}
    for sid, rstatus, n in rows.all():
        bucket = out.setdefault(sid, {"total": 0})
        bucket[_status_str(rstatus)] = bucket.get(_status_str(rstatus), 0) + int(n)
        bucket["total"] += int(n)
    return out


async def _roster_sizes(db: AsyncSession, keys: Iterable[tuple[int, int, date]]) -> dict[tuple[int, int, date], int]:
    """Roster size per (faculty_id, semester, session_date) (Rule §13.7), one query for all cohorts."""
    keys = set(keys)
    cohorts = {(f, s) for f, s, _ in keys if f is not None and s is not None}
    if not cohorts:
        return {k: 0 for k in keys}
    rows = await db.execute(
        select(Student.faculty_id, Student.semester, roster_start_sql())
        .join(User, User.id == Student.user_id)
        .where(
            or_(*[and_(Student.faculty_id == f, Student.semester == s) for f, s in cohorts]),
            func.coalesce(User.is_active, True).is_(True),
        )
    )
    starts: dict[tuple[int, int], list[date]] = {}
    for f, s, start in rows.all():
        starts.setdefault((f, s), []).append(start)
    return {(f, s, d): sum(1 for st in starts.get((f, s), []) if st is None or st <= d) for f, s, d in keys}


async def _serialize_sessions(db: AsyncSession, sessions: list[ClassSession]) -> list[dict[str, Any]]:
    """Session payloads with names, teacher, roster size and record counts (batch queries)."""
    if not sessions:
        return []
    now = app_now()
    policy = await get_attendance_policy(db)
    subjects = {
        sid: (name, code)
        for sid, name, code in (await db.execute(
            select(Subject.id, Subject.name, Subject.code).where(Subject.id.in_({s.subject_id for s in sessions}))
        )).all()
    }
    faculties = {
        fid: name
        for fid, name in (await db.execute(
            select(Faculty.id, Faculty.name).where(Faculty.id.in_({s.faculty_id for s in sessions}))
        )).all()
    }
    sched_teacher = await _schedule_teachers(db, (s.schedule_id for s in sessions))
    teacher_of = {s.id: (s.teacher_id if s.teacher_id is not None else sched_teacher.get(s.schedule_id)) for s in sessions}
    names = await _teacher_names(db, teacher_of.values())
    counts = await _record_counts(db, (s.id for s in sessions))
    rosters = await _roster_sizes(db, ((s.faculty_id, s.semester, s.session_date) for s in sessions))
    out = []
    for s in sessions:
        subj_name, subj_code = subjects.get(s.subject_id, (None, None))
        c = counts.get(s.id, {})
        tid = teacher_of.get(s.id)
        out.append({
            "id": s.id,
            "session_id": s.id,
            "schedule_id": s.schedule_id,
            "kind": s.kind,
            "status": s.status,
            "session_date": s.session_date.isoformat(),
            "start_time": _hhmm(s.start_time),
            "end_time": _hhmm(s.end_time),
            "subject_id": s.subject_id,
            "subject_name": subj_name,
            "subject_code": subj_code,
            "faculty_id": s.faculty_id,
            "faculty_name": faculties.get(s.faculty_id),
            "semester": s.semester,
            "term_id": s.term_id,
            "teacher_id": tid,
            "teacher_name": names.get(tid) if tid is not None else None,
            "cancelled": s.status == SessionStatus.cancelled,
            "cancellation_reason": s.cancellation_reason,
            "cancelled_at": _iso(s.cancelled_at),
            "cancelled_by_event_id": s.cancelled_by_event_id,
            "attendance_taken_at": _iso(s.attendance_taken_at),
            "submitted_at": _iso(s.submitted_at),
            "finalized_at": _iso(s.finalized_at),
            "review_required": bool(s.review_required),
            "review_reason": s.review_reason,
            "unrecorded": is_unrecorded(s.status, s.session_date, s.end_time, now, policy.finalize_grace_minutes,
                                        tracking_start_date=policy.tracking_start_date,
                                        roster_size=rosters.get((s.faculty_id, s.semester, s.session_date), 0)),
            "roster_size": rosters.get((s.faculty_id, s.semester, s.session_date), 0),
            "recorded_count": c.get("total", 0),
            "status_counts": {k: c.get(k, 0) for k in ("present", "late", "absent", "excused")},
        })
    return out


async def _register_students(db: AsyncSession, session: ClassSession) -> list[dict[str, Any]]:
    """Roster of a session + its records; students without a record have ``status: None``."""
    roster = await session_roster_ids(db, session)
    records = {
        r.student_id: r
        for r in (await db.execute(
            select(AttendanceRecord).where(AttendanceRecord.session_id == session.id)
        )).scalars().all()
    }
    ids = roster | set(records)
    if not ids:
        return []
    rows = (await db.execute(
        select(Student.id, Student.student_id, User.full_name, User.email, Student.semester, Student.faculty_id)
        .join(User, User.id == Student.user_id)
        .where(Student.id.in_(ids))
        .order_by(User.full_name, Student.id)
    )).all()
    out = []
    for sid, number, name, email, semester, faculty_id in rows:
        rec = records.get(sid)
        out.append({
            "student_id": sid,
            "student_number": number,
            "name": name,
            "email": email,
            "semester": semester,
            "faculty_id": faculty_id,
            "in_roster": sid in roster,
            "status": _status_str(rec.status) if rec else None,
            "source": rec.source if rec else None,
            "record_id": rec.id if rec else None,
            "excluded_from_metrics": bool(rec.excluded_from_metrics) if rec else False,
            "exclusion_reason": rec.exclusion_reason if rec else None,
        })
    return out


# ---------------------------------------------------------------------------- recording


def _parse_entries(items: Any, *, key: str) -> list[Entry]:
    if items is None:
        return []
    if not isinstance(items, list):
        raise _bad_request(f"'{key}' must be a list")
    entries = []
    for item in items:
        if not isinstance(item, dict):
            raise _bad_request(f"Every item of '{key}' must be an object")
        entries.append(Entry(student_id=item.get("student_id"), status=item.get("status"), reason=item.get("reason")))
    return entries


async def _record_snapshot(db: AsyncSession, session_id: int) -> dict[int, tuple]:
    rows = await db.execute(
        select(AttendanceRecord.student_id, AttendanceRecord.id, AttendanceRecord.status, AttendanceRecord.source,
               AttendanceRecord.excluded_from_metrics, AttendanceRecord.marked_by, AttendanceRecord.notes)
        .where(AttendanceRecord.session_id == session_id)
    )
    return {r[0]: tuple(r[1:]) for r in rows.all()}


async def _write(
    db: AsyncSession,
    *,
    actor: Any,
    session: ClassSession,
    entries: list[Entry],
    reason: Optional[str],
    submit: bool,
    confirm_held: bool,
    mark_remaining_absent: bool,
    context: Optional[dict] = None,
):
    """Run ``record_attendance`` and derive per-student outcomes (created/updated/unchanged) by
    diffing the session's records before/after the write (under the session row lock)."""
    await lock_session(db, session.id)
    before = await _record_snapshot(db, session.id)
    result = await record_attendance(
        db, actor=actor, session=session, entries=entries, reason=(reason or None),
        submit=submit, confirm_held=confirm_held, mark_remaining_absent=mark_remaining_absent, context=context,
    )
    after = await _record_snapshot(db, session.id)
    results = []
    for sid, final_status in result.statuses.items():
        if sid not in before:
            outcome = "created"
        elif before[sid] != after.get(sid):
            outcome = "updated"
        else:
            outcome = "unchanged"
        results.append({
            "student_id": sid,
            "status": final_status,
            "outcome": outcome,
            "record_id": result.record_ids.get(sid),
        })
    results.sort(key=lambda r: r["student_id"])
    return result, results


async def _cohort_of_students(db: AsyncSession, student_ids: list[Any]) -> tuple[int, int]:
    ids = []
    for sid in student_ids:
        try:
            ids.append(int(sid))
        except (TypeError, ValueError):
            continue
    if not ids:
        raise _bad_request("No valid student ids provided")
    rows = (await db.execute(
        select(Student.faculty_id, Student.semester).where(Student.id.in_(ids)).distinct()
    )).all()
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Student {ids[0]} not found")
    if len(rows) > 1:
        raise _bad_request(
            "The students belong to different cohorts; pass faculty_id and semester (or session_id)",
            code="ambiguous_cohort",
        )
    return rows[0][0], rows[0][1]


async def _resolve_write_session(
    db: AsyncSession,
    data: dict,
    *,
    student_ids: list[Any],
    default_today: bool = True,
) -> ClassSession:
    """``session_id`` -> that session; else subject_id + date [+ start_time] + cohort (explicit
    ``faculty_id``/``semester`` or the students' common cohort) -> ``resolve_session_for``."""
    session_id = _opt_int(data.get("session_id"), "session_id")
    subject_id = _opt_int(data.get("subject_id"), "subject_id")
    if session_id is not None:
        session = await _get_session_or_404(db, session_id)
        if subject_id is not None and session.subject_id != subject_id:
            raise _bad_request("session_id does not belong to subject_id", code="session_subject_mismatch")
        return session
    if subject_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="subject_id is required and cannot be null")
    raw_date = data.get("date")
    session_date = _parse_date(raw_date) if raw_date else app_today()
    start_time = _parse_time(data["start_time"]) if data.get("start_time") else None
    faculty_id = _opt_int(data.get("faculty_id"), "faculty_id")
    semester = _opt_int(data.get("semester"), "semester")
    if faculty_id is None or semester is None:
        faculty_id, semester = await _cohort_of_students(db, student_ids)
    return await resolve_session_for(
        db, subject_id=subject_id, faculty_id=faculty_id, semester=semester,
        session_date=session_date, start_time=start_time,
    )


# ============================================================================ records list


@router.get("")
async def get_attendance_records(
    student_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    status: Optional[str] = None,
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get attendance records with optional filters, including student and subject names."""

    # Students only ever see their own records.
    if has_role(current_user, "student"):
        student = (await db.execute(select(Student).where(Student.user_id == current_user.id))).scalars().first()
        if student is None:
            return {"records": [], "total": 0, "hasMore": False}
        student_id = student.id

    # Teachers only see records of cohorts they teach (DOMAIN_RULES §10).
    teacher_cohorts = None
    if has_role(current_user, "teacher"):
        teacher = await get_teacher_for_user(db, current_user)
        teacher_cohorts = await get_teacher_cohorts(db, teacher.id) if teacher is not None else set()
        if not teacher_cohorts:
            return {"records": [], "total": 0, "hasMore": False}

    query = select(
        AttendanceRecord,
        Student.student_id.label('student_number'),
        User.full_name.label('student_name'),
        Subject.name.label('subject_name'),
        Subject.code.label('subject_code'),
        AcademicEvent.id.label('cancelled_event_id'),
        AcademicEvent.notification_settings.op('->>')('cancellation_reason').label('cancellation_reason'),
        ClassSession.status.label('session_status'),
        ClassSession.cancellation_reason.label('session_cancellation_reason'),
    ).join(
        Student, AttendanceRecord.student_id == Student.id
    ).join(
        User, Student.user_id == User.id
    ).outerjoin(
        Subject, AttendanceRecord.subject_id == Subject.id
    ).outerjoin(
        ClassSession, ClassSession.id == AttendanceRecord.session_id
    ).outerjoin(
        ClassSchedule, and_(
            ClassSchedule.subject_id == Subject.id,
            ClassSchedule.faculty_id == Student.faculty_id
        )
    ).outerjoin(
        AcademicEvent, and_(
            AcademicEvent.subject_id == AttendanceRecord.subject_id,
            func.date(AcademicEvent.start_date) == AttendanceRecord.date,
            AcademicEvent.event_type == EventType.CANCELLED_CLASS,
            AcademicEvent.is_active == True
        )
    )

    conditions = []
    if teacher_cohorts is not None:
        conditions.append(or_(*[
            and_(Student.faculty_id == fid, Student.semester == sem) for fid, sem in sorted(teacher_cohorts)
        ]))
    if student_id:
        conditions.append(AttendanceRecord.student_id == student_id)
    if subject_id:
        conditions.append(AttendanceRecord.subject_id == subject_id)
    if faculty_id:
        conditions.append(Student.faculty_id == faculty_id)
    if semester:
        conditions.append(ClassSchedule.semester == semester)
    if status:
        status_lower = status.lower()
        if status_lower in ['present', 'absent', 'late', 'excused', 'cancelled']:
            conditions.append(AttendanceRecord.status == status_lower)
    if date:
        conditions.append(AttendanceRecord.date == _parse_date(date))
    if start_date and end_date:
        start = _parse_date(start_date, "start_date")
        end = _parse_date(end_date, "end_date")
        conditions.append(and_(AttendanceRecord.date >= start, AttendanceRecord.date <= end))
    if search:
        pattern = f"%{search.lower()}%"
        conditions.append(or_(
            func.lower(User.full_name).like(pattern),
            func.lower(Student.student_id).like(pattern)
        ))

    if conditions:
        query = query.where(and_(*conditions))
    query = query.distinct()  # the ClassSchedule join can duplicate rows

    count_query = select(func.count(func.distinct(AttendanceRecord.id))).select_from(AttendanceRecord)
    count_query = count_query.join(Student, AttendanceRecord.student_id == Student.id)
    count_query = count_query.join(User, Student.user_id == User.id)
    count_query = count_query.outerjoin(Subject, AttendanceRecord.subject_id == Subject.id)
    count_query = count_query.outerjoin(
        ClassSchedule, and_(
            ClassSchedule.subject_id == Subject.id,
            ClassSchedule.faculty_id == Student.faculty_id
        )
    )
    if conditions:
        count_query = count_query.where(and_(*conditions))
    total_count = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(AttendanceRecord.date.desc(), AttendanceRecord.id.desc()).offset(skip).limit(limit)
    records = (await db.execute(query)).all()

    attendance_list = []
    for row in records:
        record = row[0]
        session_cancelled = row.session_status == SessionStatus.cancelled
        attendance_list.append({
            "id": str(record.id),
            "studentId": str(record.student_id),
            "studentNumber": row.student_number,
            "studentName": row.student_name or "Unknown Student",
            "subjectId": str(record.subject_id) if record.subject_id and record.subject_id != 0 else "",
            "subjectName": row.subject_name or "Unknown Subject",
            "subjectCode": row.subject_code or "N/A",
            "classId": str(record.subject_id) if record.subject_id and record.subject_id != 0 else "",
            "date": record.date.strftime("%Y-%m-%d"),
            "timeIn": record.time_in.strftime("%H:%M:%S") if record.time_in else None,
            "timeOut": record.time_out.strftime("%H:%M:%S") if record.time_out else None,
            "status": _status_str(record.status),
            "method": _status_str(record.method),
            "confidence_score": float(record.confidence_score) if record.confidence_score else None,
            "location": record.location,
            "notes": record.notes,
            "marked_by": str(record.marked_by) if record.marked_by else "system",
            "is_cancelled": row.cancelled_event_id is not None or session_cancelled,
            "cancellation_reason": row.session_cancellation_reason if session_cancelled else row.cancellation_reason,
            # session model (Rule §6.1 / §13.5)
            "session_id": record.session_id,
            "session_status": row.session_status,
            "source": record.source,
            "excluded_from_metrics": bool(record.excluded_from_metrics),
            "exclusion_reason": record.exclusion_reason,
        })

    return {
        "records": attendance_list,
        "total": total_count,
        "skip": skip,
        "limit": limit,
        "hasMore": (skip + limit) < total_count
    }


# ============================================================================ metrics


@router.get("/summary")
async def get_attendance_summary(
    student_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    term_id: Optional[int] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Attendance summary from ``attendance_metrics`` (Rule §8, §13.12).

    Legacy fields keep their names (now session-based: ``present``/``absent``/``late``/``excused``
    are session counts, ``total`` = considered + excused, ``percentage_present`` = the metrics
    percentage, 0 when there is no data); §13.12 fields are added. ``end_date`` acts as the
    "as of" date; the window is always the reporting term (``term_id`` overrides).
    Without ``student_id``: admins get the aggregate over all students, teachers over the
    students of the cohorts they teach.
    """
    # Students: always their own id (another student's id -> 403).
    # Teachers: only students of cohorts they teach. Admins: any / all.
    student_id = await resolve_student_scope(current_user, student_id, db)
    if start_date:
        _parse_date(start_date, "start_date")
    as_of = _parse_date(end_date, "end_date") if end_date else None

    day_counts: Counter = Counter()
    subjects: Optional[list] = None
    window = None
    try:
        if student_id is not None:
            metrics = await compute_student_metrics(db, student_id, term_id=term_id, as_of=as_of)
            overall = metrics.overall
            term = metrics.term_context.term.summary() if metrics.term_context.term else None
            term_state = metrics.term_state
            window = metrics.window
            subjects = metrics.per_subject
            if window is not None:
                days = await compute_student_day_statuses(db, student_id, window[0], window[1])
                day_counts = Counter(d["status"] for d in days)
        else:
            ids = None
            if not has_role(current_user, "admin"):
                teacher = await get_teacher_for_user(db, current_user)
                cohorts = await get_teacher_cohorts(db, teacher.id) if teacher is not None else set()
                ids = []
                if cohorts:
                    ids = [r[0] for r in (await db.execute(
                        select(Student.id).where(or_(*[
                            and_(Student.faculty_id == f, Student.semester == s) for f, s in cohorts
                        ]))
                    )).all()]
            agg = await compute_students_overall(db, student_ids=ids, term_id=term_id, as_of=as_of)
            overall = agg["aggregate"]
            term = agg["term"]
            term_state = agg["term_state"]
    except DomainError as err:
        raise await _fail(db, err)

    class_days = day_counts["present"] + day_counts["absent"] + day_counts["partial"]
    partial_days = day_counts["partial"]
    total_records = overall["present"] + overall["absent"] + overall["late"] + overall["excused"]
    response = {
        "present": overall["present"],
        "absent": overall["absent"],
        "late": overall["late"],
        "excused": overall["excused"],
        "total": overall["total_classes"],
        "percentage_present": overall["percentage_present"],
        "days_with_any_attendance": partial_days,
        "partial_attendance_percentage": round(partial_days / class_days * 100, 1) if class_days else 0.0,
        "semester_start_date": term["start_date"] if term else None,
        "semester_end_date": term["end_date"] if term else None,
        "days_with_records": class_days,
        "present_records": overall["present"],
        "absent_records": overall["absent"],
        "late_records": overall["late"],
        "excused_records": overall["excused"],
        "total_records": total_records,
        "percentage_present_records": overall["percentage_present"],
        # Rule §13.12
        "term": term,
        "term_state": term_state,
        "window": {"start": window[0].isoformat(), "end": window[1].isoformat()} if window else None,
        "scope": "student" if student_id is not None else "aggregate",
    }
    for key, value in overall.items():
        response.setdefault(key, value)
    if subjects is not None:
        response["subjects"] = subjects
    return response


@router.get("/student-subject-breakdown/{student_id}")
async def get_student_subject_breakdown(
    student_id: int,
    month: Optional[int] = None,
    year: Optional[int] = None,
    accurate: bool = True,  # kept for compatibility; there is a single calculation now
    term_id: Optional[int] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Per-subject attendance for a student from ``attendance_metrics`` (Rule §8, §13.12).

    Figures are always term-to-date (the reporting term, or ``term_id``). ``month``/``year`` only
    move the "as of" date to the end of that month (``scope``/``as_of``/``month_filter_applied``
    say so explicitly) — the metrics service has no arbitrary date-range window.
    """
    # Ownership: students -> self only, teachers -> students of cohorts they teach, admins -> anyone.
    await resolve_student_scope(current_user, student_id, db)

    today = app_today()
    as_of = None
    target_month = target_year = None
    if month is not None or year is not None:
        target_month = month if month is not None else today.month
        target_year = year if year is not None else today.year
        if target_month < 1 or target_month > 12:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Month must be between 1 and 12")
        next_month = date(target_year + (target_month == 12), target_month % 12 + 1, 1)
        as_of = min(next_month - timedelta(days=1), today)

    try:
        metrics = await compute_student_metrics(db, student_id, term_id=term_id, as_of=as_of)
    except DomainError as err:
        raise await _fail(db, err)

    credits = {
        sid: c for sid, c in (await db.execute(
            select(Subject.id, Subject.credits).where(Subject.id.in_([s["subject_id"] for s in metrics.per_subject] or [0]))
        )).all()
    }
    subjects = [{**s, "credits": credits.get(s["subject_id"]) or 3} for s in metrics.per_subject]
    term = metrics.term_context.term
    response: dict[str, Any] = {
        "subjects": subjects,
        "calculation_method": "held_sessions",
        "scope": "term_to_date",
        "as_of": (as_of or today).isoformat(),
        "month_filter_applied": False,
        "term": term.summary() if term else None,
        "term_state": metrics.term_state,
        "window": {"start": metrics.window[0].isoformat(), "end": metrics.window[1].isoformat()} if metrics.window else None,
        "overall": metrics.overall,
    }
    if target_month is not None:
        response.update({
            "month": target_month,
            "year": target_year,
            "month_name": date(target_year, target_month, 1).strftime("%B"),
        })
    return response


@router.get("/calendar")
async def get_calendar_attendance(
    year: int,
    month: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Student's own month calendar from ``compute_student_day_statuses`` (Rule §8).

    ``status`` values: present, absent, partial, excused, cancelled, unrecorded, no_class, future,
    holiday, weekly_off, exam, between_terms (a day nobody recorded is ``unrecorded``, never absent).
    """
    if not has_role(current_user, "student"):
        raise HTTPException(status_code=403, detail="Calendar endpoint is only available for students")
    student = (await db.execute(select(Student).where(Student.user_id == current_user.id))).scalars().first()
    if student is None:
        raise HTTPException(status_code=404, detail="Student record not found for current user")
    try:
        start = date(year, month, 1)
        end = date(year + (month == 12), month % 12 + 1, 1) - timedelta(days=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid year or month")
    try:
        days = await compute_student_day_statuses(db, student.id, start, end)
    except DomainError as err:
        raise await _fail(db, err)

    calendar_data = []
    for d in days:
        live = [s for s in d["sessions"] if s["session_status"] != SessionStatus.cancelled]
        counted = Counter(
            s["record_status"] for s in live if s.get("record_status") and not s.get("excluded_from_metrics")
        )
        calendar_data.append({
            "date": d["date"],
            "status": d["status"],
            "reason": d["reason"],
            "total_classes": len(live),
            "present_count": counted["present"],
            "absent_count": counted["absent"],
            "late_count": counted["late"],
            "excused_count": counted["excused"],
            "sessions": d["sessions"],
        })
    return {"calendar_data": calendar_data, "month": month, "year": year}


# ============================================================================ rosters / registers


@router.get("/students-by-subject")
async def get_students_by_subject(
    faculty_id: int,
    semester: int,
    subject_id: int,
    date: Optional[str] = None,
    session_id: Optional[int] = None,
    start_time: Optional[str] = None,
    current_user = Depends(require_admin_or_teacher),
    db: AsyncSession = Depends(get_db)
):
    """Cohort roster for a subject on a date with each student's attendance for that session.

    Admins: any class. Teachers: only a class (subject + faculty + semester) they teach.

    Unmarked students are never defaulted to absent: ``attendance_status`` is ``null`` and the
    legacy ``status`` string is ``"no_data"`` (the old ``"system_inactive"`` and the "absent
    because someone else has a record that day" defaults are gone). Adds ``record_id``,
    ``source``, ``excluded_from_metrics`` per student and ``session``/``sessions``/``session_id``.
    Sessions are materialized on demand for dates up to today (future dates show existing ones).
    """
    if not has_role(current_user, "admin"):
        teacher = await get_teacher_for_user(db, current_user)
        teaches = None
        if teacher is not None:
            teaches = (await db.execute(
                select(ClassSchedule.id).where(
                    ClassSchedule.teacher_id == teacher.id,
                    ClassSchedule.subject_id == subject_id,
                    ClassSchedule.faculty_id == faculty_id,
                    ClassSchedule.semester == semester,
                ).limit(1)
            )).first()
        if teaches is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to teach this class")

    target_date = _parse_date(date) if date else app_today()
    wanted_start = _parse_time(start_time) if start_time else None
    try:
        if target_date <= app_today():
            sessions = await ensure_sessions_for(db, session_date=target_date, faculty_id=faculty_id,
                                                 semester=semester, subject_id=subject_id)
        else:
            sessions = list((await db.execute(
                select(ClassSession).where(
                    ClassSession.session_date == target_date, ClassSession.faculty_id == faculty_id,
                    ClassSession.semester == semester, ClassSession.subject_id == subject_id,
                ).order_by(ClassSession.start_time, ClassSession.id)
            )).scalars().all())
    except DomainError as err:
        raise await _fail(db, err)

    chosen = None
    if session_id is not None or wanted_start is not None:
        chosen = next((s for s in sessions if (s.id == session_id if session_id is not None
                                               else s.start_time.replace(tzinfo=None) == wanted_start)), None)
        if chosen is None:
            raise HTTPException(status_code=404, detail={"code": "session_not_found",
                                                         "message": "That session is not part of this class on this date"})
    elif sessions:
        chosen = sessions[0]  # several slots: earliest by default; ``sessions`` lets the client pick

    payloads = await _serialize_sessions(db, sessions)
    by_id = {p["id"]: p for p in payloads}

    students_out = []
    if chosen is not None:
        rows = await _register_students(db, chosen)
    else:
        # No session that day: cohort roster + any legacy (session-less) records of that day.
        legacy = {
            r.student_id: r for r in (await db.execute(
                select(AttendanceRecord).where(
                    AttendanceRecord.subject_id == subject_id,
                    AttendanceRecord.date == target_date,
                    AttendanceRecord.session_id.is_(None),
                )
            )).scalars().all()
        }
        roster_rows = (await db.execute(
            select(Student.id, Student.student_id, User.full_name, User.email, Student.semester, Student.faculty_id)
            .join(User, User.id == Student.user_id)
            .where(*roster_conditions(faculty_id, semester, target_date))
            .order_by(User.full_name, Student.id)
        )).all()
        rows = []
        for sid, number, name, email, sem, fac in roster_rows:
            rec = legacy.get(sid)
            rows.append({
                "student_id": sid, "student_number": number, "name": name, "email": email,
                "semester": sem, "faculty_id": fac, "in_roster": True,
                "status": _status_str(rec.status) if rec else None,
                "source": rec.source if rec else None,
                "record_id": rec.id if rec else None,
                "excluded_from_metrics": bool(rec.excluded_from_metrics) if rec else False,
                "exclusion_reason": rec.exclusion_reason if rec else None,
            })
    for r in rows:
        students_out.append({
            "id": r["student_id"],
            "student_id": r["student_number"],
            "name": r["name"] or "Unknown",
            "email": r["email"] or "",
            "semester": r["semester"],
            "faculty_id": r["faculty_id"],
            "status": r["status"] or UNMARKED_LEGACY_STATUS,
            "attendance_status": r["status"],
            "record_id": r["record_id"],
            "source": r["source"],
            "excluded_from_metrics": r["excluded_from_metrics"],
        })

    await db.commit()  # persist on-demand materialization
    return {
        "students": students_out,
        "date": target_date.isoformat(),
        "faculty_id": faculty_id,
        "semester": semester,
        "subject_id": subject_id,
        "session_id": chosen.id if chosen is not None else None,
        "session": by_id.get(chosen.id) if chosen is not None else None,
        "sessions": payloads,
    }


# ============================================================================ sessions (contract v1)


@router.get("/sessions/unrecorded")
async def get_unrecorded_sessions(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user = Depends(require_admin_or_teacher),
    db: AsyncSession = Depends(get_db)
):
    """Actionable unrecorded sessions + sessions flagged for review (Rule §13.4, amended: only
    sessions on/after ``tracking_start_date`` whose cohort roster is non-empty). Admin: all;
    teacher: own sessions. Paginated (``limit`` default 200, max 1000; ``offset``); ``total`` is
    the true match count. ``schedules_without_teacher`` is reported to admins."""
    start = _parse_date(from_date, "from") if from_date else None
    end = _parse_date(to_date, "to") if to_date else None
    is_admin = has_role(current_user, "admin")
    teacher_id = None if is_admin else await _teacher_id_or_403(db, current_user)
    items = await list_unrecorded_sessions(db, start=start, end=end, teacher_id=teacher_id,
                                           faculty_id=faculty_id, semester=semester, limit=limit, offset=offset)
    names = await _teacher_names(db, (i["teacher_id"] for i in items))
    counts = await _record_counts(db, (i["id"] for i in items))
    keys = {(i["faculty_id"], i["semester"], date.fromisoformat(i["session_date"])) for i in items}
    rosters = await _roster_sizes(db, keys)
    for i in items:
        i["teacher_name"] = names.get(i["teacher_id"]) if i["teacher_id"] is not None else None
        i["recorded_count"] = counts.get(i["id"], {}).get("total", 0)
        i["roster_size"] = rosters.get((i["faculty_id"], i["semester"], date.fromisoformat(i["session_date"])), 0)
    return {
        "sessions": list(items),
        "schedules_without_teacher": await count_schedules_without_teacher(db) if is_admin else 0,
        "total": items.total,
        "limit": limit,
        "offset": offset,
        "has_more": items.has_more,
    }


@router.get("/sessions")
async def list_sessions(
    date: Optional[str] = None,
    faculty_id: Optional[int] = None,
    semester: Optional[int] = None,
    subject_id: Optional[int] = None,
    current_user = Depends(require_admin_or_teacher),
    db: AsyncSession = Depends(get_db)
):
    """Sessions of a date (default today) with status and counts. Admin: all; teacher: own.
    Dates up to today are materialized on demand (Rule §13.1); future dates list existing
    sessions only (materializing ahead would freeze a snapshot before timetable edits)."""
    target_date = _parse_date(date) if date else app_today()
    teacher_id = None if has_role(current_user, "admin") else await _teacher_id_or_403(db, current_user)
    try:
        if target_date <= app_today():
            sessions = await ensure_sessions_for(db, session_date=target_date, faculty_id=faculty_id,
                                                 semester=semester, subject_id=subject_id)
        else:
            stmt = select(ClassSession).where(ClassSession.session_date == target_date)
            if faculty_id is not None:
                stmt = stmt.where(ClassSession.faculty_id == faculty_id)
            if semester is not None:
                stmt = stmt.where(ClassSession.semester == semester)
            if subject_id is not None:
                stmt = stmt.where(ClassSession.subject_id == subject_id)
            sessions = list((await db.execute(stmt.order_by(ClassSession.start_time, ClassSession.id))).scalars().all())
    except DomainError as err:
        raise await _fail(db, err)
    if teacher_id is not None:
        sched_teacher = await _schedule_teachers(db, (s.schedule_id for s in sessions))
        sessions = [s for s in sessions if teacher_id in (s.teacher_id, sched_teacher.get(s.schedule_id))]
    payloads = await _serialize_sessions(db, sessions)
    await db.commit()  # persist on-demand materialization
    return {"date": target_date.isoformat(), "sessions": payloads, "total": len(payloads)}


@router.post("/sessions/makeup")
async def create_makeup(
    body: dict,
    current_user = Depends(require_admin_or_teacher),
    db: AsyncSession = Depends(get_db)
):
    """Make-up session (Rule §13.2): admin, or a teacher of that subject + cohort; reason required."""
    for field in ("subject_id", "faculty_id", "semester", "session_date", "start_time", "end_time"):
        if body.get(field) in (None, ""):
            raise _bad_request(f"{field} is required")
    try:
        session = await create_makeup_session(
            db, actor=current_user,
            subject_id=_opt_int(body["subject_id"], "subject_id"),
            faculty_id=_opt_int(body["faculty_id"], "faculty_id"),
            semester=_opt_int(body["semester"], "semester"),
            session_date=_parse_date(body["session_date"], "session_date"),
            start_time=_parse_time(body["start_time"], "start_time"),
            end_time=_parse_time(body["end_time"], "end_time"),
            teacher_id=_opt_int(body.get("teacher_id"), "teacher_id"),
            reason=body.get("reason"),
        )
        payload = (await _serialize_sessions(db, [session]))[0]
        await db.commit()
    except DomainError as err:
        raise await _fail(db, err)
    return {"success": True, "session": payload}


@router.get("/sessions/{session_id}/register")
async def get_session_register(
    session_id: int,
    current_user = Depends(require_admin_or_teacher),
    db: AsyncSession = Depends(get_db)
):
    """Register of a session (admin / owning teacher). Unmarked students have ``status: null``."""
    session = await _get_session_or_404(db, session_id)
    await _ensure_can_manage(db, current_user, session)
    payload = (await _serialize_sessions(db, [session]))[0]
    return {"session": payload, "students": await _register_students(db, session)}


@router.post("/sessions/{session_id}/register")
async def submit_session_register(
    session_id: int,
    body: dict,
    current_user = Depends(require_admin_or_teacher),
    db: AsyncSession = Depends(get_db)
):
    """Register submission (Rule §13.3/§13.4) via ``record_attendance(submit=True)``.

    Body ``{entries: [{student_id, status, reason?}], reason?, mark_remaining_absent?, confirm_held?}``.
    Errors: 400 ``invalid_entries`` (per-entry ``errors``), 403, 409 ``session_cancelled`` ...
    """
    session = await _get_session_or_404(db, session_id)
    entries = _parse_entries(body.get("entries"), key="entries")
    try:
        result, results = await _write(
            db, actor=current_user, session=session, entries=entries, reason=body.get("reason"),
            submit=True, confirm_held=_as_bool(body.get("confirm_held")),
            mark_remaining_absent=_as_bool(body.get("mark_remaining_absent")),
            context={"endpoint": "attendance.sessions.register"},
        )
        payload = (await _serialize_sessions(db, [session]))[0]
        await db.commit()
    except DomainError as err:
        raise await _fail(db, err)
    return {**result.to_dict(), "results": results, "session": payload}


@router.post("/sessions/{session_id}/cancel")
async def cancel_class_session(
    session_id: int,
    body: dict,
    current_user = Depends(require_admin_or_teacher),
    db: AsyncSession = Depends(get_db)
):
    """Cancel a session (admin / owning teacher; reason required). Records are kept and drop out
    of metrics while the session is cancelled."""
    session = await _get_session_or_404(db, session_id)
    try:
        session = await cancel_session(db, session=session, actor=current_user, reason=body.get("reason"))
        payload = (await _serialize_sessions(db, [session]))[0]
        await db.commit()
    except DomainError as err:
        raise await _fail(db, err)
    return {"success": True, "session": payload}


@router.post("/sessions/{session_id}/uncancel")
async def uncancel_class_session(
    session_id: int,
    body: dict,
    current_user = Depends(require_admin_or_teacher),
    db: AsyncSession = Depends(get_db)
):
    """Restore a cancelled session (admin / owning teacher; reason required)."""
    session = await _get_session_or_404(db, session_id)
    try:
        session = await uncancel_session(db, session=session, actor=current_user, reason=body.get("reason"))
        payload = (await _serialize_sessions(db, [session]))[0]
        await db.commit()
    except DomainError as err:
        raise await _fail(db, err)
    return {"success": True, "session": payload}


@router.post("/sessions/{session_id}/clear-review")
async def clear_class_session_review(
    session_id: int,
    body: dict,
    current_user = Depends(require_admin_role),
    db: AsyncSession = Depends(get_db)
):
    """Admin keeps a session's status despite a covering calendar event (Rule §13.6; reason required, audited)."""
    session = await _get_session_or_404(db, session_id)
    try:
        session = await clear_review(db, session=session, actor=current_user, reason=body.get("reason"))
        payload = (await _serialize_sessions(db, [session]))[0]
        await db.commit()
    except DomainError as err:
        raise await _fail(db, err)
    return {"success": True, "session": payload}


# ============================================================================ proof of presence + face attempts
# (docs/system/face-verification.md §9)

FACE_ATTEMPTS_LIMIT = 200


@router.get("/sessions/{session_id}/presence-code")
async def get_session_presence_code(
    session_id: int,
    current_user = Depends(require_admin_or_teacher),
    db: AsyncSession = Depends(get_db)
):
    """Current rotating check-in code of a session (admin / owning teacher), for the classroom
    screen and QR. 409 ``not_today`` for another day, 409 ``session_cancelled`` if cancelled."""
    session = await _get_session_or_404(db, session_id)
    await _ensure_can_manage(db, current_user, session)
    now = app_now()
    if session.session_date != now.date():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail={"code": "not_today", "message": "Check-in codes are only available on the day of the class"})
    if session.status == SessionStatus.cancelled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail={"code": "session_cancelled", "message": "This class has been cancelled"})
    face_policy = await get_face_policy(db)
    attendance_policy = await get_attendance_policy(db)
    opens_at, closes_at, late_after = checkin_window(
        session_start_at(session.session_date, session.start_time),
        session_end_at(session.session_date, session.end_time),
        attendance_policy,
    )
    state = "not_open" if now < opens_at else ("closed" if now >= closes_at else "open")
    period = face_policy.presence_code_period_seconds
    code = presence_codes.code_for(session.id, now, period)
    subject_name = (await db.execute(select(Subject.name).where(Subject.id == session.subject_id))).scalar()
    return {
        "session_id": session.id,
        "code": code,
        "digits": presence_codes.DIGITS,
        "period_seconds": period,
        "expires_in_seconds": presence_codes.seconds_until_rotation(now, period),
        "server_time": now.isoformat(),
        "required": face_policy.require_presence_code,
        "checkin_path": presence_codes.checkin_path(session.id, code),
        "window": {"opens_at": opens_at.isoformat(), "closes_at": closes_at.isoformat(),
                   "late_after": late_after.isoformat(), "state": state},
        "subject_name": subject_name,
        "start_time": _hhmm(session.start_time),
        "end_time": _hhmm(session.end_time),
    }


@router.get("/sessions/{session_id}/face-attempts")
async def get_session_face_attempts(
    session_id: int,
    current_user = Depends(require_admin_or_teacher),
    db: AsyncSession = Depends(get_db)
):
    """Face check-in attempts logged against a session (admin / owning teacher), newest first
    (at most 200), with a summary over all of the session's attempts."""
    session = await _get_session_or_404(db, session_id)
    await _ensure_can_manage(db, current_user, session)
    rows = (await db.execute(
        select(FaceVerificationAttempt, Student.student_id, User.full_name)
        .join(Student, Student.id == FaceVerificationAttempt.student_id)
        .join(User, User.id == Student.user_id)
        .where(FaceVerificationAttempt.session_id == session.id)
        .order_by(FaceVerificationAttempt.created_at.desc(), FaceVerificationAttempt.id.desc())
        .limit(FACE_ATTEMPTS_LIMIT)
    )).all()
    attempts = [
        {
            "id": a.id,
            "student_id": a.student_id,
            "student_name": full_name,
            "roll_number": roll_number,
            "outcome": a.outcome,
            "counts_as_failure": bool(a.counts_as_failure),
            "similarity": float(a.similarity) if a.similarity is not None else None,
            "liveness_score": float(a.liveness_score) if a.liveness_score is not None else None,
            "created_at": _iso(a.created_at),
        }
        for a, roll_number, full_name in rows
    ]
    by_outcome: dict[str, int] = {}
    failures = 0
    for outcome, is_failure, n in (await db.execute(
        select(FaceVerificationAttempt.outcome, FaceVerificationAttempt.counts_as_failure, func.count())
        .where(FaceVerificationAttempt.session_id == session.id)
        .group_by(FaceVerificationAttempt.outcome, FaceVerificationAttempt.counts_as_failure)
    )).all():
        by_outcome[outcome] = by_outcome.get(outcome, 0) + int(n)
        if is_failure:
            failures += int(n)
    return {
        "session_id": session.id,
        "attempts": attempts,
        "summary": {
            "total": sum(by_outcome.values()),
            "successes": by_outcome.get("success", 0),
            "failures": failures,
            "by_outcome": by_outcome,
        },
    }


# ============================================================================ records: exclusion + audit


@router.patch("/records/{record_id}/metrics-exclusion")
async def set_record_metrics_exclusion(
    record_id: int,
    body: dict,
    current_user = Depends(require_admin_role),
    db: AsyncSession = Depends(get_db)
):
    """Admin toggles ``excluded_from_metrics`` with a reason (Rule §13.5; audited)."""
    if "excluded" not in body:
        raise _bad_request("'excluded' is required")
    try:
        rec = await set_metrics_exclusion(db, actor=current_user, record_id=record_id,
                                          excluded=_as_bool(body.get("excluded")), reason=body.get("reason"))
        response = {
            "success": True,
            "id": rec.id,
            "record_id": rec.id,
            "session_id": rec.session_id,
            "status": _status_str(rec.status),
            "excluded_from_metrics": bool(rec.excluded_from_metrics),
            "exclusion_reason": rec.exclusion_reason,
        }
        await db.commit()
    except DomainError as err:
        raise await _fail(db, err)
    return response


@router.get("/records/{record_id}/audit")
async def get_record_audit(
    record_id: int,
    current_user = Depends(require_admin_or_teacher),
    db: AsyncSession = Depends(get_db)
):
    """Audit history of one record (admin; teacher only for records of their own sessions)."""
    rec = (await db.execute(select(AttendanceRecord).where(AttendanceRecord.id == record_id))).scalars().first()
    if rec is None:
        raise HTTPException(status_code=404, detail={"code": "record_not_found", "message": "Attendance record not found"})
    if not has_role(current_user, "admin"):
        session = await _get_session_or_404(db, rec.session_id) if rec.session_id is not None else None
        if session is None or not await actor_owns_session(db, current_user, session):
            raise HTTPException(status_code=403, detail={"code": "not_session_teacher",
                                                         "message": "You are not the teacher of this class session"})
    rows = (await db.execute(
        select(AttendanceAuditLog, User.full_name)
        .outerjoin(User, User.id == AttendanceAuditLog.changed_by)
        .where(AttendanceAuditLog.attendance_record_id == record_id)
        .order_by(AttendanceAuditLog.changed_at, AttendanceAuditLog.id)
    )).all()
    return [
        {
            "id": log.id,
            "action": log.action,
            "old_status": log.old_status,
            "new_status": log.new_status,
            "old_source": log.old_source,
            "new_source": log.new_source,
            "changed_by": log.changed_by,
            "changed_by_name": name if log.changed_by is not None else "System",
            "changed_at": _iso(log.changed_at),
            "reason": log.reason,
            "session_id": log.session_id,
            "context": log.context,
        }
        for log, name in rows
    ]


# ============================================================================ writes (admin)


@router.post("")
async def create_attendance_record(
    attendance_data: dict,
    current_user = Depends(require_admin_role),
    db: AsyncSession = Depends(get_db)
):
    """Admin single-record write via ``record_attendance`` (not a register submission).

    Body ``{student_id, status, subject_id + date? [+ start_time] | session_id, reason?, confirm_held?}``.
    A write that would make a past ``scheduled`` session held needs ``confirm_held: true``
    (409 ``confirm_held`` with ``students_without_record`` otherwise).
    """
    if attendance_data.get("student_id") in (None, ""):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="student_id is required")
    if attendance_data.get("subject_id") in (None, "") and attendance_data.get("session_id") in (None, ""):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="subject_id is required and cannot be null")
    entry = Entry(student_id=attendance_data.get("student_id"), status=attendance_data.get("status"),
                  reason=attendance_data.get("reason"))
    try:
        session = await _resolve_write_session(db, attendance_data, student_ids=[entry.student_id])
        result, results = await _write(
            db, actor=current_user, session=session, entries=[entry], reason=attendance_data.get("reason"),
            submit=False, confirm_held=_as_bool(attendance_data.get("confirm_held")), mark_remaining_absent=False,
            context={"endpoint": "attendance.create"},
        )
        await db.commit()
    except DomainError as err:
        raise await _fail(db, err)
    row = results[0] if results else {}
    return {
        "success": True,
        "id": str(row["record_id"]) if row.get("record_id") else None,
        "studentId": str(entry.student_id),
        "classId": str(session.subject_id),
        "subjectId": str(session.subject_id),
        "date": session.session_date.isoformat(),
        "status": row.get("status"),
        "confidence_score": None,
        "marked_by": str(current_user.id),
        "session_id": session.id,
        "session_status": result.session_status,
        "outcome": row.get("outcome"),
    }


@router.post("/mark-bulk")
async def mark_bulk_attendance(
    attendance_data: dict,
    current_user = Depends(require_admin_role),
    db: AsyncSession = Depends(get_db)
):
    """Admin register submission for one class session (Rule §13.3), via
    ``record_attendance(submit=True)``.

    Body ``{subject_id, date?, students: [{student_id, status, reason?}], session_id?, start_time?,
    faculty_id?, semester?, reason?, confirm_held?, mark_remaining_absent?}``. Only the listed
    students are written (plus roster students without a record when ``mark_remaining_absent``);
    nothing is ever written for other subjects or students (the old cascade mode is gone).
    Errors: 400 ``invalid_entries``, 404 ``session_not_found``, 409 ``ambiguous_session`` (pass
    ``start_time``/``session_id``), 409 ``session_cancelled``, 403 ...
    """
    student_attendance = attendance_data.get("students") or []
    entries = _parse_entries(student_attendance, key="students")
    has_explicit_session = attendance_data.get("session_id") not in (None, "") or (
        attendance_data.get("faculty_id") not in (None, "") and attendance_data.get("semester") not in (None, "")
    )
    if not entries and not (has_explicit_session and _as_bool(attendance_data.get("mark_remaining_absent"))):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No students provided in request")
    try:
        session = await _resolve_write_session(db, attendance_data, student_ids=[e.student_id for e in entries])
        result, results = await _write(
            db, actor=current_user, session=session, entries=entries, reason=attendance_data.get("reason"),
            submit=True, confirm_held=_as_bool(attendance_data.get("confirm_held")),
            mark_remaining_absent=_as_bool(attendance_data.get("mark_remaining_absent")),
            context={"endpoint": "attendance.mark_bulk"},
        )
        await db.commit()
    except DomainError as err:
        raise await _fail(db, err)
    return {
        "success": True,
        "message": "Bulk attendance marked successfully",
        "mode": "normal",
        "created_records": result.created,
        "updated_records": result.updated,
        "unchanged_records": result.unchanged,
        "date": session.session_date.isoformat(),
        "subject_id": session.subject_id,
        "session_id": session.id,
        "session_status": result.session_status,
        "submitted": result.submitted,
        "results": results,
    }


# ============================================================================ auto-absent (legacy paths)


@router.post("/auto-absent")
async def trigger_auto_absent(
    target_date: Optional[str] = None,
    current_user = Depends(require_admin_role),
    db: AsyncSession = Depends(get_db)
):
    """Legacy alias of ``POST /auto-absent/trigger`` (admin): one run of ``auto_absent_service``.
    ``target_date`` (YYYY-MM-DD) is honoured: within an active term and at most 30 days back."""
    process_date = _parse_date(target_date, "target_date") if target_date else None
    try:
        result = await auto_absent_service.run(db, triggered_by=current_user, target_date=process_date)
    except DomainError as err:
        raise await _fail(db, err)
    return {
        "success": True,
        "message": "Auto-absent processing completed successfully",
        "processing_date": (process_date or app_today()).isoformat(),
        "triggered_by": current_user.email,
        "triggered_at": app_now().isoformat(),
        **result,
    }


@router.get("/auto-absent/stats")
async def get_auto_absent_stats(
    target_date: Optional[str] = None,
    current_user = Depends(require_admin_role),
    db: AsyncSession = Depends(get_db)
):
    """Auto-absent record statistics for a date (default today) — admin only."""
    process_date = _parse_date(target_date, "target_date") if target_date else None
    stats = await auto_absent_service.get_auto_absent_stats(db, process_date)
    return {
        "success": True,
        "stats": stats,
        "requested_by": current_user.email,
        "requested_at": app_now().isoformat(),
    }


# ============================================================================ single record (keep LAST:
# the catch-all path parameter must not shadow the static GET routes above)


@router.get("/{attendance_id}")
async def get_attendance_record(
    attendance_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific attendance record."""
    record = (await db.execute(select(AttendanceRecord).where(AttendanceRecord.id == attendance_id))).scalars().first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")

    # Students may only read their own records; teachers only their cohorts' records.
    await resolve_student_scope(current_user, record.student_id, db)

    return {
        "id": str(record.id),
        "studentId": str(record.student_id),
        "classId": str(record.subject_id) if record.subject_id else "1",
        "date": record.date.strftime("%Y-%m-%d"),
        "status": _status_str(record.status),
        "confidence_score": record.confidence_score,
        "marked_by": str(record.marked_by),
        "session_id": record.session_id,
        "source": record.source,
        "excluded_from_metrics": bool(record.excluded_from_metrics),
        "exclusion_reason": record.exclusion_reason,
    }
