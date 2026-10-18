"""Face verification attempt log and lock-out (docs/system/face-verification.md §7).

``record_attempt`` only adds and flushes. Rejected requests usually roll back their
transaction, so routes call it *after* the rollback and then commit, which keeps the
attempt row even when the check-in itself is refused.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy import func, select

from app.core.clock import app_now
from app.models import FaceVerificationAttempt
from app.services.face_policy import FacePolicy

#: Outcomes that count towards the lock-out.
FAILURE_OUTCOMES = frozenset({
    "face_mismatch", "liveness_failed", "spoof_suspected", "presence_code_invalid", "challenge_invalid",
})


def _num(value: Optional[float]) -> Optional[float]:
    return None if value is None else round(float(value), 4)


async def record_attempt(db, *, student_id: int, purpose: str, outcome: str,
                         session_id: Optional[int] = None, challenge_id: Optional[str] = None,
                         similarity: Optional[float] = None, liveness_score: Optional[float] = None,
                         details: Optional[dict[str, Any]] = None, ip_address: Optional[str] = None,
                         counts_as_failure: Optional[bool] = None,
                         now: Optional[datetime] = None) -> FaceVerificationAttempt:
    attempt = FaceVerificationAttempt(
        student_id=student_id,
        session_id=session_id,
        challenge_id=challenge_id,
        purpose=str(purpose),
        outcome=str(outcome),
        counts_as_failure=(outcome in FAILURE_OUTCOMES) if counts_as_failure is None else bool(counts_as_failure),
        similarity=_num(similarity),
        liveness_score=_num(liveness_score),
        details=details,
        ip_address=(ip_address or None) and str(ip_address)[:45],
        created_at=now or app_now(),
    )
    db.add(attempt)
    await db.flush()
    return attempt


async def lockout_status(db, *, student_id: int, policy: FacePolicy,
                         now: Optional[datetime] = None) -> tuple[bool, Optional[int]]:
    """``(locked, retry_after_seconds)``: locked when the student has at least
    ``max_failed_attempts`` failures in the last ``failed_attempt_window_minutes``; the retry
    time is when the oldest counted failure leaves the window."""
    now = now or app_now()
    since = now - timedelta(minutes=policy.failed_attempt_window_minutes)
    rows = (await db.execute(
        select(FaceVerificationAttempt.created_at)
        .where(FaceVerificationAttempt.student_id == student_id,
               FaceVerificationAttempt.counts_as_failure.is_(True),
               FaceVerificationAttempt.created_at > since)
        .order_by(FaceVerificationAttempt.created_at.desc())
        .limit(policy.max_failed_attempts)
    )).scalars().all()
    if len(rows) < policy.max_failed_attempts:
        return False, None
    oldest_counted = rows[-1]
    retry = oldest_counted + timedelta(minutes=policy.failed_attempt_window_minutes) - now
    return True, max(1, int(retry.total_seconds()) + 1)


async def failure_count(db, *, student_id: int, since: datetime) -> int:
    return int((await db.execute(
        select(func.count()).select_from(FaceVerificationAttempt)
        .where(FaceVerificationAttempt.student_id == student_id,
               FaceVerificationAttempt.counts_as_failure.is_(True),
               FaceVerificationAttempt.created_at > since)
    )).scalar() or 0)
