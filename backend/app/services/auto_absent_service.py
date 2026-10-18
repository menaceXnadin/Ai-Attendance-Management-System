"""Automatic absence finalization (DOMAIN_RULES §7, amended by §13.1, §13.3, §13.11).

One run (scheduler every 10 minutes, or an admin's manual trigger):

1. Take ``pg_try_advisory_lock(AUTO_ABSENT_LOCK_KEY)`` on a DEDICATED connection held for the
   whole run and released in ``finally`` on that same connection (Rule §13.11). Not acquired ->
   ``{"skipped": "another run in progress"}``; nothing is stored (skips are only logged).
2. Insert a ``job_runs`` row (status ``running``; ``success``/``failed`` at the end).
3. Materialize every expected session (Rule §4) for
   ``[max(tracking_start_date, today - auto_absent_lookback_days), today]`` (Rule §13.1),
   skipping cohorts with no enrolled, active student on the date (coordinator decision).
4. Finalize ALL held, unfinalized, non-cancelled sessions whose date is in an active term,
   on/after ``tracking_start_date``, and whose ``end + finalize_grace <= now`` — the look-back
   limits only materialization (Rule §13.3). Coordinator decision (§13.3 amended): held
   sessions dated before ``tracking_start_date`` are legacy data kept "as recorded" and never
   receive retroactive absences. Sessions covered by a suppressing calendar event or flagged ``review_required`` are
   skipped and reported. Per session, in its own transaction: ``SELECT ... FOR UPDATE`` the
   session, insert ``absent`` (source ``system_auto``, method ``other``, location
   ``AUTO_ABSENT_SYSTEM``, ``marked_by`` NULL) for every roster student without a record
   (``ON CONFLICT DO NOTHING``; never updates), write one ``finalize`` audit row, set
   ``finalized_at``, commit.

Scheduled-but-unrecorded sessions are NEVER auto-absented (Rule §0.2); they surface as
unrecorded. The finalizer reads only the session snapshot + covering events, never
``schedule.is_active`` (Rule §13.2).

Transactions: unlike the request-scoped services, this job MANAGES ITS OWN TRANSACTIONS on the
session it is given (one commit per finalized session, plus commits for materialization and the
``job_runs`` row). Callers must not hold uncommitted work in that session.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta
from typing import Any, Optional, Sequence

from sqlalchemy import func, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.clock import app_now, app_timezone_name, local_naive, utc_now
from app.core.config import settings
from app.models import (
    AttendanceMethod,
    AttendanceRecord,
    AttendanceSource,
    AttendanceStatus,
    AuditAction,
    ClassSession,
    JobRun,
    JobRunStatus,
    SessionStatus,
    Student,
    Subject,
    User,
)
from app.services.attendance_policy import AttendancePolicy, get_attendance_policy
from app.services.class_sessions import (
    actor_user_id,
    add_audit,
    count_unrecorded_sessions,
    event_drives_sessions,
    is_session_finalizable,
    lock_session,
    materialize_sessions,
    roster_conditions,
    session_end_sql,
    time_slot_label,
)
from app.services.domain_errors import DomainError
from app.services.instructional_calendar import EventInfo, event_suppresses, load_events
from app.services.term_service import Term, load_terms, term_for_date

logger = logging.getLogger(__name__)

#: Session-level advisory lock key for the whole run (Rule §7, §13.11).
AUTO_ABSENT_LOCK_KEY = 815_200_001
JOB_NAME = "auto_absent"
#: Admins may pass a manual ``target_date`` up to this many days back, inside an active term (Rule §7).
MANUAL_MAX_DAYS_BACK = 30
AUTO_ABSENT_NOTE = "Auto-marked absent: no check-in recorded for a held session"
AUTO_ABSENT_LOCATION = "AUTO_ABSENT_SYSTEM"
SCHEDULE_DESCRIPTION = "Every 10 minutes, all day ({tz})"


# ============================================================================ pure helpers


def materialization_window(today: date, policy: AttendancePolicy, target_date: Optional[date] = None) -> tuple[date, date]:
    """Rule §13.1: ``[max(tracking_start_date, today - lookback), today]``; a valid manual
    ``target_date`` earlier than that extends the start (never before ``tracking_start_date``)."""
    start = today - timedelta(days=policy.auto_absent_lookback_days)
    if target_date is not None and target_date < start:
        start = target_date
    if policy.tracking_start_date is not None and policy.tracking_start_date > start:
        start = policy.tracking_start_date
    return start, today


def validate_manual_target_date(
    target: date, today: date, terms: Sequence[Term], *, max_days_back: int = MANUAL_MAX_DAYS_BACK
) -> None:
    """Rule §7 manual trigger: ``target`` must not be in the future, at most ``max_days_back``
    days ago, and inside an active term. Raises ``DomainError("invalid_target_date", 422)``."""
    if target > today:
        raise DomainError("invalid_target_date", "The date cannot be in the future", http_status=422,
                          details={"target_date": target.isoformat()})
    if (today - target).days > max_days_back:
        raise DomainError("invalid_target_date", f"The date must be within the last {max_days_back} days",
                          http_status=422, details={"target_date": target.isoformat()})
    if term_for_date(terms, target) is None:
        raise DomainError("invalid_target_date", "The date is not inside an active term", http_status=422,
                          details={"target_date": target.isoformat()})


def blocking_event_for(session: Any, events: Sequence[EventInfo], policy: AttendancePolicy) -> Optional[EventInfo]:
    """A suppressing event (holiday / exam when suspending / cancelled_class) covering the
    session's own snapshot (Rule §13.2), if any."""
    for ev in events:
        if event_drives_sessions(ev, policy) and event_suppresses(
            ev, session.session_date, faculty_id=session.faculty_id, subject_id=session.subject_id,
            start_time=session.start_time, end_time=session.end_time, policy=policy, kind=session.kind or "regular",
        ):
            return ev
    return None


def _lock_engine(db):
    """Engine for the dedicated advisory-lock connection: the session's own engine (so the lock
    always lives in the same database as the data), else the application engine."""
    from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

    bind = getattr(db, "bind", None)
    if isinstance(bind, AsyncEngine):
        return bind
    if isinstance(bind, AsyncConnection):
        return bind.engine
    from app.core.database import async_engine

    return async_engine


def _jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(v) for v in value]
    if isinstance(value, (date, datetime, time)):
        return value.isoformat()
    return value


# ============================================================================ service


class AutoAbsentService:
    """Finalizer for held class sessions (Rule §7). Public entry points: :meth:`run` (alias
    :meth:`process_auto_absent_for_today`), :meth:`get_status`, :meth:`get_last_run`,
    :meth:`get_auto_absent_stats`."""

    def __init__(self) -> None:
        # Kept for backward compatibility; the grace period now comes from the policy.
        self.attendance_window_minutes = 0

    # ------------------------------------------------------------------ main entry point
    async def run(
        self,
        db,
        *,
        triggered_by: Any = None,
        target_date: Optional[date] = None,
        now: Optional[datetime] = None,
        trigger: str = "manual",
    ) -> dict[str, Any]:
        """Run materialization + finalization once (see module docstring). ``triggered_by`` is a
        ``User`` (or user id) for manual runs, ``None`` for the scheduler. Returns the legacy
        result keys (``success, processed_date, expired_classes, students_marked_absent,
        new_records_created, students_already_marked, class_details, message``) plus
        ``job_run_id, lock_acquired, skipped, sessions_materialized, sessions_finalized,
        sessions_skipped, unrecorded_sessions, materialization_window``."""
        now = now or app_now()
        today = now.date()
        triggered_by_id = actor_user_id(triggered_by)
        policy = await get_attendance_policy(db)
        terms = await load_terms(db)
        if target_date is not None:
            validate_manual_target_date(target_date, today, terms)
        await db.commit()  # end the read transaction; the job manages its own transactions

        result = self._empty_result(today)
        result["triggered_by"] = triggered_by_id
        result["trigger"] = trigger

        engine = _lock_engine(db)
        async with engine.connect() as lock_conn:
            acquired = bool((await lock_conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": AUTO_ABSENT_LOCK_KEY})).scalar())
            await lock_conn.commit()  # session-level lock survives; don't sit idle in a transaction
            if not acquired:
                logger.info("auto-absent run skipped: another run holds the advisory lock")
                result.update(lock_acquired=False, skipped="another run in progress",
                              message="Skipped: another auto-absent run is in progress")
                return result
            result["lock_acquired"] = True
            job_id: Optional[int] = None
            try:
                params = {"trigger": trigger, "target_date": target_date.isoformat() if target_date else None,
                          "now": now.isoformat(), "timezone": app_timezone_name()}
                job = JobRun(job_name=JOB_NAME, started_at=utc_now(), status=JobRunStatus.running.value,
                             triggered_by=triggered_by_id, params=params)
                db.add(job)
                await db.flush()
                job_id = job.id
                await db.commit()
                result["job_run_id"] = job_id

                # 1) materialize expected sessions (Rule §13.1)
                win_start, win_end = materialization_window(today, policy, target_date)
                mat = await materialize_sessions(db, win_start, win_end, policy=policy, now=now,
                                                 skip_empty_cohorts=True)
                await db.commit()
                result["materialization_window"] = {"start": win_start.isoformat(), "end": win_end.isoformat()}
                result["sessions_materialized"] = mat.created
                result["sessions_skipped_empty_cohort"] = mat.skipped_empty_cohort

                # 2) finalize held sessions (Rule §7 + §13.3)
                await self._finalize_all(db, now=now, policy=policy, terms=terms, result=result)

                result["unrecorded_sessions"] = await count_unrecorded_sessions(db, policy=policy, now=now)
                result["message"] = self._message(result)
                await db.execute(update(JobRun).where(JobRun.id == job_id).values(
                    status=JobRunStatus.success.value, finished_at=utc_now(), result=_jsonable(self._job_summary(result))))
                await db.commit()
                return result
            except Exception as exc:
                logger.exception("auto-absent run failed")
                await db.rollback()
                try:
                    values = dict(status=JobRunStatus.failed.value, finished_at=utc_now(), error=str(exc)[:4000],
                                  result=_jsonable(self._job_summary(result)))
                    if job_id is not None:
                        await db.execute(update(JobRun).where(JobRun.id == job_id).values(**values))
                    else:
                        db.add(JobRun(job_name=JOB_NAME, started_at=utc_now(), triggered_by=triggered_by_id,
                                      params={"trigger": trigger}, **values))
                    await db.commit()
                except Exception:  # pragma: no cover - DB unavailable
                    logger.exception("could not record failed auto-absent job run")
                    await db.rollback()
                raise
            finally:
                try:
                    await lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": AUTO_ABSENT_LOCK_KEY})
                    await lock_conn.commit()
                except Exception:  # pragma: no cover - connection lost: the lock dies with it
                    logger.exception("failed to release auto-absent advisory lock")

    async def process_auto_absent_for_today(self, db, *, triggered_by: Any = None, target_date: Optional[date] = None,
                                            now: Optional[datetime] = None, trigger: str = "manual") -> dict[str, Any]:
        """Backward-compatible name used by routes and the scheduler; delegates to :meth:`run`."""
        return await self.run(db, triggered_by=triggered_by, target_date=target_date, now=now, trigger=trigger)

    # ------------------------------------------------------------------ finalization
    async def candidate_session_ids(self, db, *, now: datetime, policy: AttendancePolicy) -> list[int]:
        """Held, unfinalized sessions with ``end + grace <= now``, dated on/after
        ``tracking_start_date`` (coordinator decision, §13.3 amended), oldest first."""
        cutoff = local_naive(now - timedelta(minutes=policy.finalize_grace_minutes))
        stmt = (
            select(ClassSession.id)
            .where(ClassSession.status == SessionStatus.held.value, ClassSession.finalized_at.is_(None),
                   session_end_sql() <= cutoff)
            .order_by(ClassSession.session_date, ClassSession.start_time, ClassSession.id)
        )
        if policy.tracking_start_date is not None:
            stmt = stmt.where(ClassSession.session_date >= policy.tracking_start_date)
        return [r[0] for r in (await db.execute(stmt)).all()]

    async def _finalize_all(self, db, *, now: datetime, policy: AttendancePolicy, terms: Sequence[Term],
                            result: dict[str, Any]) -> None:
        ids = await self.candidate_session_ids(db, now=now, policy=policy)
        if not ids:
            await db.commit()
            return
        bounds = (await db.execute(
            select(func.min(ClassSession.session_date), func.max(ClassSession.session_date)).where(ClassSession.id.in_(ids))
        )).first()
        events = await load_events(db, bounds[0], bounds[1])
        await db.commit()
        for sid in ids:
            try:
                detail = await self.finalize_session(db, sid, now=now, policy=policy, terms=terms, events=events)
            except Exception as exc:
                await db.rollback()
                logger.exception("auto-absent: finalizing session %s failed", sid)
                result["sessions_skipped"].append({"session_id": sid, "reason": "error", "error": str(exc)[:500]})
                result["errors"] += 1
                continue
            if detail.get("finalized"):
                result["sessions_finalized"] += 1
                result["expired_classes"] += 1
                result["new_records_created"] += detail["records_created"]
                result["students_marked_absent"] += detail["records_created"]
                result["students_already_marked"] += detail["students_already_marked"]
                result["class_details"].append(detail)
                result["finalized_session_ids"].append(sid)
            else:
                result["sessions_skipped"].append({"session_id": sid, "reason": detail.get("skip_reason"),
                                                   "event_id": detail.get("event_id")})

    async def finalize_session(
        self,
        db,
        session_id: int,
        *,
        now: Optional[datetime] = None,
        policy: Optional[AttendancePolicy] = None,
        terms: Optional[Sequence[Term]] = None,
        events: Optional[Sequence[EventInfo]] = None,
    ) -> dict[str, Any]:
        """Finalize one session in its own transaction (commits or rolls back). Rule §7."""
        now = now or app_now()
        policy = policy or await get_attendance_policy(db)
        terms = terms if terms is not None else await load_terms(db)
        session = await lock_session(db, session_id)
        if events is None:
            events = await load_events(db, session.session_date, session.session_date)
        block = blocking_event_for(session, events, policy)
        in_term = term_for_date(terms, session.session_date) is not None
        base = {
            "session_id": session.id,
            "schedule_id": session.schedule_id,
            "subject_id": session.subject_id,
            "faculty_id": session.faculty_id,
            "semester": session.semester,
            "session_date": session.session_date.isoformat(),
            "time_slot": time_slot_label(session.start_time, session.end_time),
            "kind": session.kind,
        }
        if not is_session_finalizable(
            status=session.status, finalized_at=session.finalized_at, session_date=session.session_date,
            end_time=session.end_time, now=now, grace_minutes=policy.finalize_grace_minutes,
            in_active_term=in_term, blocked_by_event=block is not None, review_required=bool(session.review_required),
            tracking_start_date=policy.tracking_start_date,
        ):
            if policy.tracking_start_date is not None and session.session_date < policy.tracking_start_date:
                reason = "before_tracking_start"
            elif block is not None:
                reason = f"blocked_by_{block.event_type}"
            elif not in_term:
                reason = "outside_term"
            elif session.review_required:
                reason = "review_required"
            else:
                reason = "not_eligible"
            await db.rollback()  # releases the row lock
            return {**base, "finalized": False, "skip_reason": reason, "event_id": block.id if block else None}

        roster = {r[0] for r in (await db.execute(
            select(Student.id).join(User, User.id == Student.user_id)
            .where(*roster_conditions(session.faculty_id, session.semester, session.session_date))
        )).all()}
        recorded = {r[0] for r in (await db.execute(
            select(AttendanceRecord.student_id).where(AttendanceRecord.session_id == session.id)
        )).all()}
        missing = sorted(roster - recorded)
        created_ids: list[int] = []
        if missing:
            slot = time_slot_label(session.start_time, session.end_time)
            rows = [{
                "student_id": sid,
                "subject_id": session.subject_id,
                "session_id": session.id,
                "date": session.session_date,
                "time_slot": slot,
                "status": AttendanceStatus.absent,
                "method": AttendanceMethod.other,
                "source": AttendanceSource.system_auto.value,
                "location": AUTO_ABSENT_LOCATION,
                "notes": AUTO_ABSENT_NOTE,
                "marked_by": None,
                "excluded_from_metrics": False,
            } for sid in missing]
            res = await db.execute(
                pg_insert(AttendanceRecord).values(rows).on_conflict_do_nothing().returning(AttendanceRecord.id)
            )
            created_ids = [r[0] for r in res.all()]
        subject_name = (await db.execute(select(Subject.name).where(Subject.id == session.subject_id))).scalar()
        counts = {"roster": len(roster), "already_recorded": len(roster & recorded), "absent_created": len(created_ids),
                  "conflicts_skipped": len(missing) - len(created_ids)}
        add_audit(db, action=AuditAction.finalize, session_id=session.id, new_status=session.status, context=counts)
        session.finalized_at = now
        await db.flush()
        await db.commit()
        return {
            **base,
            "finalized": True,
            "subject_name": subject_name or "Unknown",
            "students_affected": len(created_ids),
            "records_created": len(created_ids),
            "students_already_marked": counts["already_recorded"],
            "total_students": len(roster),
            "message": f"Marked {len(created_ids)} students absent" if created_ids else "All students already have records",
        }

    # ------------------------------------------------------------------ status / history
    async def get_last_run(self, db) -> Optional[dict[str, Any]]:
        """Most recent ``job_runs`` row for this job (Rule §7 observability)."""
        row = (await db.execute(
            select(JobRun).where(JobRun.job_name == JOB_NAME).order_by(JobRun.started_at.desc(), JobRun.id.desc()).limit(1)
        )).scalars().first()
        if row is None:
            return None
        return {
            "id": row.id,
            "status": row.status,
            "started_at": row.started_at.isoformat() if row.started_at else None,
            "finished_at": row.finished_at.isoformat() if row.finished_at else None,
            "triggered_by": row.triggered_by,
            "params": row.params,
            "result": row.result,
            "error": row.error,
        }

    async def count_ready_sessions(self, db, *, now: Optional[datetime] = None, policy: Optional[AttendancePolicy] = None) -> int:
        """Held sessions past ``end + grace`` and not yet finalized (what a run would look at)."""
        now = now or app_now()
        policy = policy or await get_attendance_policy(db)
        return len(await self.candidate_session_ids(db, now=now, policy=policy))

    async def get_status(self, db, *, now: Optional[datetime] = None) -> dict[str, Any]:
        """Status payload with the legacy keys (``auto_absent_enabled, current_time,
        in_schedule_window, schedule_window, expired_classes_ready_to_process,
        next_scheduled_run, notes``) plus ``unrecorded_sessions``, ``last_run``,
        ``scheduler_running``, ``timezone``, ``term_state``. Read-only."""
        from app.services.term_service import compute_term_state

        now = now or app_now()
        policy = await get_attendance_policy(db)
        terms = await load_terms(db)
        try:
            from app.services.scheduler_service import scheduler_service

            running = bool(scheduler_service.running)
            next_run = scheduler_service.next_run_at.isoformat() if running and scheduler_service.next_run_at else None
        except Exception:  # pragma: no cover
            running, next_run = False, None
        tz = app_timezone_name()
        return {
            "auto_absent_enabled": bool(settings.enable_auto_absent_scheduler),
            "scheduler_enabled_in_process": bool(settings.run_scheduler and settings.enable_auto_absent_scheduler),
            "scheduler_running": running,
            "current_time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "timezone": tz,
            "in_schedule_window": True,
            "schedule_window": SCHEDULE_DESCRIPTION.format(tz=tz),
            "expired_classes_ready_to_process": await self.count_ready_sessions(db, now=now, policy=policy),
            "next_scheduled_run": next_run or "Every 10 minutes (when the scheduler is enabled)",
            "unrecorded_sessions": await count_unrecorded_sessions(db, policy=policy, now=now),
            "last_run": await self.get_last_run(db),
            "term_state": compute_term_state(terms, now.date()),
            "finalize_grace_minutes": policy.finalize_grace_minutes,
            "notes": (
                "Only sessions where attendance was taken (held) are finalized, "
                f"{policy.finalize_grace_minutes} min after they end: students without a record are marked absent. "
                "Sessions nobody recorded are listed as unrecorded and never auto-absented."
            ),
        }

    async def get_auto_absent_stats(self, db, target_date: Optional[date] = None) -> dict[str, Any]:
        """Counts of auto-absent vs manual absent records for a date (default today, APP_TIMEZONE)."""
        target_date = target_date or app_now().date()
        is_auto = AttendanceRecord.source == AttendanceSource.system_auto.value
        row = (await db.execute(
            select(
                func.count(AttendanceRecord.id),
                func.count(AttendanceRecord.id).filter(AttendanceRecord.status == AttendanceStatus.absent),
                func.count(AttendanceRecord.id).filter(AttendanceRecord.status == AttendanceStatus.absent, is_auto),
            ).where(AttendanceRecord.date == target_date)
        )).first()
        total, total_absent, auto_absent = (int(x or 0) for x in row)
        return {
            "date": target_date.isoformat(),
            "auto_absent_records": auto_absent,
            "total_absent_records": total_absent,
            "manual_absent_records": total_absent - auto_absent,
            "total_attendance_records": total,
            "auto_absent_percentage": round((auto_absent / total * 100) if total > 0 else 0, 2),
        }

    # ------------------------------------------------------------------ compatibility shims
    async def _is_holiday_or_cancelled(self, db, target_date: date) -> bool:
        """Compat shim for ``routes/auto_absent_trigger.py``: True when ``target_date`` is a
        university-wide holiday / exam day / weekly off day (Rule §4 ``day_status``)."""
        from app.services.instructional_calendar import day_status

        info = await day_status(db, target_date)
        return info["reason"] in ("holiday", "exam", "weekly_off")

    async def _get_expired_schedules(self, db, target_date: Optional[date] = None, current_time: Any = None) -> list[ClassSession]:
        """Compat shim for ``routes/auto_absent_trigger.py``: the held sessions a run would
        finalize now (any date; Rule §13.3). Items expose ``subject_id`` like the old rows."""
        policy = await get_attendance_policy(db)
        ids = await self.candidate_session_ids(db, now=app_now(), policy=policy)
        if not ids:
            return []
        rows = await db.execute(select(ClassSession).where(ClassSession.id.in_(ids)).order_by(ClassSession.session_date))
        return list(rows.scalars().all())

    # ------------------------------------------------------------------ result helpers
    @staticmethod
    def _empty_result(today: date) -> dict[str, Any]:
        return {
            "success": True,
            "processed_date": today.isoformat(),
            "expired_classes": 0,
            "students_marked_absent": 0,
            "new_records_created": 0,
            "students_already_marked": 0,
            "class_details": [],
            "message": "",
            "job_run_id": None,
            "lock_acquired": False,
            "skipped": None,
            "sessions_materialized": 0,
            "sessions_skipped_empty_cohort": 0,
            "sessions_finalized": 0,
            "sessions_skipped": [],
            "finalized_session_ids": [],
            "unrecorded_sessions": 0,
            "materialization_window": None,
            "errors": 0,
        }

    @staticmethod
    def _message(result: dict[str, Any]) -> str:
        n, created = result["sessions_finalized"], result["new_records_created"]
        parts = []
        if n:
            parts.append(f"Finalized {n} held session(s); {created} absent record(s) created")
        else:
            parts.append("No held sessions were ready to finalize")
        if result["sessions_materialized"]:
            parts.append(f"{result['sessions_materialized']} expected session(s) materialized")
        if result["sessions_skipped"]:
            parts.append(f"{len(result['sessions_skipped'])} skipped")
        if result["unrecorded_sessions"]:
            parts.append(f"{result['unrecorded_sessions']} unrecorded session(s) need follow-up")
        return ". ".join(parts) + "."

    @staticmethod
    def _job_summary(result: dict[str, Any]) -> dict[str, Any]:
        keys = ("sessions_materialized", "sessions_finalized", "new_records_created", "students_already_marked",
                "unrecorded_sessions", "materialization_window", "errors", "finalized_session_ids")
        summary = {k: result.get(k) for k in keys}
        summary["sessions_skipped"] = result.get("sessions_skipped", [])[:200]
        return summary


# Singleton instance
auto_absent_service = AutoAbsentService()

__all__ = [
    "AUTO_ABSENT_LOCK_KEY",
    "JOB_NAME",
    "MANUAL_MAX_DAYS_BACK",
    "materialization_window",
    "validate_manual_target_date",
    "blocking_event_for",
    "AutoAbsentService",
    "auto_absent_service",
]
