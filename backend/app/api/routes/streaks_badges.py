"""Attendance streak and badge endpoints (DOMAIN_RULES §8 streak rule; §13.12 fields).

Streaks come from ``attendance_metrics.compute_streaks`` over class days of the reporting term
(``term_id`` overrides); non-class days are neutral. ``period_days`` is accepted for backward
compatibility and ignored (no fixed lookback windows).
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, has_role
from app.core.database import get_db
from app.models import Student, User
from app.services.domain_errors import DomainError
from app.services.streak_badge_system import BadgeSystem, StreakCalculator, batch_streaks

router = APIRouter(prefix="/streaks-badges", tags=["streaks-badges"])


async def _own_student(db: AsyncSession, current_user: User) -> Student:
    student = (await db.execute(select(Student).where(Student.user_id == current_user.id))).scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return student


async def _streaks(db: AsyncSession, student_id: int, term_id: Optional[int]) -> dict:
    try:
        return await StreakCalculator.calculate_comprehensive_streaks(db, student_id, term_id=term_id)
    except DomainError as exc:
        raise exc.to_http_exception()


async def _badges_payload(db: AsyncSession, student_id: int, term_id: Optional[int]) -> dict:
    streak_data = await _streaks(db, student_id, term_id)
    badges = await BadgeSystem.calculate_earned_badges(db, student_id, streak_data)
    return {
        "badges": badges,
        "total_earned": len(badges),
        "streak_summary": {
            "current_streak": streak_data["current_streak"],
            "longest_streak": streak_data["longest_streak"],
            "is_active": streak_data["is_streak_active"],
        },
        "attendance_rate": streak_data["attendance_rate"],
        "percentage": streak_data["percentage"],
        "has_data": streak_data["has_data"],
        "band": streak_data["band"],
        "eligible": streak_data["eligible"],
        "term": streak_data["term"],
        "term_state": streak_data["term_state"],
    }


@router.get("/my-streaks")
async def get_my_streaks(
    period_days: int = Query(180, description="Deprecated (ignored): streaks cover the reporting term", ge=30, le=365),
    term_id: Optional[int] = Query(None, description="Term (semester configuration) id; default = reporting term"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Streak data for the logged-in student (class days of the reporting term)."""
    student = await _own_student(db, current_user)
    return await _streaks(db, student.id, term_id)


@router.get("/{student_id}/streaks")
async def get_student_streaks(
    student_id: int,
    period_days: int = Query(180, description="Deprecated (ignored)", ge=30, le=365),
    term_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Streak data for a specific student (admin only)."""
    if not has_role(current_user, "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return await _streaks(db, student_id, term_id)


@router.get("/my-badges")
async def get_my_badges(
    term_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Badges earned by the logged-in student."""
    student = await _own_student(db, current_user)
    return await _badges_payload(db, student.id, term_id)


@router.get("/{student_id}/badges")
async def get_student_badges(
    student_id: int,
    term_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Badges earned by a specific student (admin only)."""
    if not has_role(current_user, "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return await _badges_payload(db, student_id, term_id)


@router.get("/leaderboard")
async def get_streak_leaderboard(
    limit: int = Query(10, description="Number of top students", ge=1, le=100),
    term_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Students with the highest current streaks (admin: everyone; student: own faculty).

    Batch computed (one records query for all candidates).
    """
    stmt = (
        select(Student.id, Student.student_id, Student.faculty_id, User.full_name)
        .join(User, User.id == Student.user_id)
        .where(User.is_active.isnot(False))
    )
    if not has_role(current_user, "admin"):
        student = await _own_student(db, current_user)
        stmt = stmt.where(Student.faculty_id == student.faculty_id)
    students = (await db.execute(stmt)).all()
    try:
        streaks = await batch_streaks(db, students, term_id=term_id)
    except DomainError as exc:
        raise exc.to_http_exception()
    leaderboard = [
        {
            "student_id": s.id,
            "student_name": s.full_name or "Unknown",
            "student_number": s.student_id,
            "current_streak": streaks[s.id]["current"],
            "longest_streak": streaks[s.id]["longest"],
            "is_active": streaks[s.id]["current"] > 0,
        }
        for s in students
    ]
    leaderboard.sort(key=lambda x: (-x["current_streak"], -x["longest_streak"], x["student_name"]))
    return {"leaderboard": leaderboard[:limit], "total_students": len(students)}
