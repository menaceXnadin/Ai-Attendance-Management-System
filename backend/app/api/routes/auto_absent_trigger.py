"""Auto-absent admin endpoints (DOMAIN_RULES §7, §13.3, §13.11). Admin only.

All logic lives in ``app.services.auto_absent_service`` (one implementation shared with the
scheduler): the trigger calls ``run()``, the status endpoint returns ``get_status()`` verbatim
(so status and trigger cannot diverge), and the history endpoint reads ``job_runs``.

* ``POST /auto-absent/trigger`` body ``{date?}`` — optional date must be inside an active term,
  not in the future and at most 30 days back (400 otherwise). Records ``triggered_by``.
* ``GET /auto-absent/status`` — legacy keys + ``unrecorded_sessions``, ``last_run``.
* ``GET /auto-absent/runs?limit=20`` — newest ``job_runs`` rows for this job.
"""
import datetime as _dt
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_admin
from app.core.clock import app_now
from app.core.database import get_db
from app.models import Admin, JobRun, User
from app.services.auto_absent_service import JOB_NAME, auto_absent_service
from app.services.domain_errors import DomainError

router = APIRouter(prefix="/auto-absent", tags=["auto-absent"])


class AutoAbsentTriggerRequest(BaseModel):
    date: Optional[_dt.date] = None


class AutoAbsentTriggerResponse(BaseModel):
    success: bool
    message: str
    records_created: int
    expired_classes_processed: Optional[int] = None
    students_already_marked: Optional[int] = None
    timestamp: datetime
    # v2 additions
    processed_date: Optional[str] = None
    target_date: Optional[str] = None
    skipped: Optional[str] = None
    job_run_id: Optional[int] = None
    sessions_materialized: int = 0
    sessions_finalized: int = 0
    sessions_skipped: int = 0
    unrecorded_sessions: int = 0
    triggered_by: Optional[int] = None


@router.post("/trigger", response_model=AutoAbsentTriggerResponse)
async def trigger_auto_absent(
    body: Optional[AutoAbsentTriggerRequest] = Body(None),
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Run materialization + finalization now (same code path as the scheduler).

    Only held sessions (attendance was taken) are finalized; unrecorded sessions are never
    auto-absented. Idempotent: re-running creates no duplicate absences.
    """
    target_date = body.date if body is not None else None
    try:
        result = await auto_absent_service.run(db, triggered_by=current_admin, target_date=target_date, trigger="manual")
    except DomainError as err:
        if err.code == "invalid_target_date":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err.message)
        raise err.to_http_exception()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to trigger auto-absent: {exc}")

    skipped = result.get("skipped")
    return AutoAbsentTriggerResponse(
        success=bool(result.get("success", True)) and not skipped,
        message=result.get("message") or "Auto-absent processing completed",
        records_created=int(result.get("new_records_created", 0)),
        expired_classes_processed=int(result.get("expired_classes", 0)),
        students_already_marked=int(result.get("students_already_marked", 0)),
        timestamp=app_now(),
        processed_date=result.get("processed_date"),
        target_date=target_date.isoformat() if target_date else None,
        skipped=skipped,
        job_run_id=result.get("job_run_id"),
        sessions_materialized=int(result.get("sessions_materialized", 0)),
        sessions_finalized=int(result.get("sessions_finalized", 0)),
        sessions_skipped=len(result.get("sessions_skipped") or []),
        unrecorded_sessions=int(result.get("unrecorded_sessions", 0)),
        triggered_by=result.get("triggered_by"),
    )


@router.get("/status")
async def get_auto_absent_status(
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Status from the service (same candidate query the trigger uses)."""
    return await auto_absent_service.get_status(db)


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


@router.get("/runs")
async def list_auto_absent_runs(
    limit: int = Query(20, ge=1, le=200),
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Run history (``job_runs`` for the auto-absent job), newest first."""
    rows = (await db.execute(
        select(JobRun, User.full_name)
        .outerjoin(User, User.id == JobRun.triggered_by)
        .where(JobRun.job_name == JOB_NAME)
        .order_by(JobRun.started_at.desc(), JobRun.id.desc())
        .limit(limit)
    )).all()
    runs = []
    for run, name in rows:
        duration = None
        if run.started_at and run.finished_at:
            duration = round((run.finished_at - run.started_at).total_seconds(), 3)
        runs.append({
            "id": run.id,
            "job_name": run.job_name,
            "status": run.status,
            "started_at": _iso(run.started_at),
            "finished_at": _iso(run.finished_at),
            "duration_seconds": duration,
            "triggered_by": run.triggered_by,
            "triggered_by_name": name,
            "trigger": (run.params or {}).get("trigger") if isinstance(run.params, dict) else None,
            "params": run.params,
            "result": run.result,
            "error": run.error,
        })
    return runs
