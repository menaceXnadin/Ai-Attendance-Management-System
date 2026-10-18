"""Single-use liveness challenges (docs/system/face-verification.md §6). Flushes only."""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import delete, select

from app.core.clock import app_now
from app.models import ChallengeAction, ChallengePurpose, FaceChallenge, Student
from app.services.domain_errors import DomainError
from app.services.face_policy import FacePolicy

INSTRUCTIONS = {
    ChallengeAction.turn_left: "Look at the camera, then slowly turn your head to your left.",
    ChallengeAction.turn_right: "Look at the camera, then slowly turn your head to your right.",
    ChallengeAction.front_left_right: "Look straight at the camera, then turn your head to your left, then to your right.",
}


def pick_action(purpose: str) -> ChallengeAction:
    if purpose == ChallengePurpose.enrolment:
        return ChallengeAction.front_left_right
    return secrets.choice([ChallengeAction.turn_left, ChallengeAction.turn_right])


async def create_challenge(db, *, student: Student, purpose: str, policy: FacePolicy,
                           session_id: Optional[int] = None, now: Optional[datetime] = None) -> FaceChallenge:
    """New challenge for ``student``; also purges that student's challenges older than a day."""
    if purpose not in (ChallengePurpose.checkin, ChallengePurpose.enrolment):
        raise DomainError("invalid_purpose", "purpose must be 'checkin' or 'enrolment'", http_status=400)
    now = now or app_now()
    await db.execute(delete(FaceChallenge).where(
        FaceChallenge.student_id == student.id, FaceChallenge.created_at < now - timedelta(days=1)))
    challenge = FaceChallenge(
        id=uuid.uuid4().hex,
        student_id=student.id,
        purpose=str(purpose),
        action=str(pick_action(purpose)),
        session_id=session_id,
        created_at=now,
        expires_at=now + timedelta(seconds=policy.challenge_ttl_seconds),
    )
    db.add(challenge)
    await db.flush()
    return challenge


def challenge_payload(challenge: FaceChallenge, policy: FacePolicy) -> dict:
    """API body for ``POST /face-recognition/challenge``."""
    return {
        "challenge_id": challenge.id,
        "purpose": challenge.purpose,
        "action": challenge.action,
        "expires_at": challenge.expires_at.isoformat(),
        "ttl_seconds": policy.challenge_ttl_seconds,
        "frames_min": policy.enrolment_min_images if challenge.purpose == ChallengePurpose.enrolment else policy.effective_frames_min,
        "frames_max": policy.frames_max,
        "requires_head_turn": policy.require_head_turn,
        "requires_liveness": policy.require_liveness,
        "requires_presence_code": policy.require_presence_code and challenge.purpose == ChallengePurpose.checkin,
        "instructions": INSTRUCTIONS[ChallengeAction(challenge.action)],
    }


async def consume_challenge(db, *, student: Student, challenge_id: Optional[str], purpose: str,
                            now: Optional[datetime] = None) -> FaceChallenge:
    """Mark the challenge used and return it. Raises ``challenge_invalid`` (400) when it is
    unknown, another student's, for another purpose, already used or expired. A matching
    but expired/used challenge is still marked used (single use regardless of outcome)."""
    now = now or app_now()
    if not challenge_id:
        raise DomainError("challenge_required", "Start the camera again to get a new liveness challenge", http_status=400)
    challenge = (await db.execute(
        select(FaceChallenge).where(FaceChallenge.id == str(challenge_id)).with_for_update()
    )).scalars().first()
    if challenge is None or challenge.student_id != student.id or challenge.purpose != str(purpose):
        raise DomainError("challenge_invalid", "This liveness challenge is not valid; please try again", http_status=400)
    already_used = challenge.used_at is not None
    if not already_used:
        challenge.used_at = now
        await db.flush()
    if already_used or challenge.expires_at <= now:
        raise DomainError("challenge_invalid", "This liveness challenge has expired; please try again", http_status=400)
    return challenge
