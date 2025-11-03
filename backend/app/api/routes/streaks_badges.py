"""
Advanced Streak and Badges API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models import User
from app.api.dependencies import get_current_user
from app.services.streak_badge_system import StreakCalculator, BadgeSystem
from typing import Optional

router = APIRouter(prefix="/streaks-badges", tags=["streaks-badges"])


@router.get("/my-streaks")
async def get_my_streaks(
    period_days: int = Query(180, description="Calculation period in days", ge=30, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive streak data for the current logged-in student
    
    Returns:
    - current_streak: Active consecutive present days
    - longest_streak: Maximum streak achieved
    - current_week_streak: Days present this week
    - monthly_streaks: Breakdown by month
    - streak_history: Day-by-day progression
    - is_streak_active: Whether streak is currently active
    """
    from app.models import Student
    from sqlalchemy import select
    
    # Get student record
    student_query = select(Student).where(Student.user_id == current_user.id)
    result = await db.execute(student_query)
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    # Calculate streaks using advanced system
    streak_data = await StreakCalculator.calculate_comprehensive_streaks(
        db, student.id, period_days
    )
    
    return streak_data


@router.get("/{student_id}/streaks")
async def get_student_streaks(
    student_id: int,
    period_days: int = Query(180, description="Calculation period in days", ge=30, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive streak data for a specific student (Admin only)
    """
    from app.models import UserRole
    
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Calculate streaks
    streak_data = await StreakCalculator.calculate_comprehensive_streaks(
        db, student_id, period_days
    )
    
    return streak_data


@router.get("/my-badges")
async def get_my_badges(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all earned badges for the current logged-in student
    
    Returns list of badges with:
    - id: Unique badge identifier
    - name: Badge name
    - description: What it represents
    - tier: legendary/epic/rare/uncommon/common
    - icon: Emoji or icon identifier
    - color: Visual color theme
    """
    from app.models import Student
    from sqlalchemy import select
    
    # Get student record
    student_query = select(Student).where(Student.user_id == current_user.id)
    result = await db.execute(student_query)
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    # Get streak data first (needed for badge calculation)
    streak_data = await StreakCalculator.calculate_comprehensive_streaks(
        db, student.id, 180
    )
    
    # Calculate earned badges
    badges = await BadgeSystem.calculate_earned_badges(
        db, student.id, streak_data
    )
    
    return {
        'badges': badges,
        'total_earned': len(badges),
        'streak_summary': {
            'current_streak': streak_data['current_streak'],
            'longest_streak': streak_data['longest_streak'],
            'is_active': streak_data['is_streak_active']
        }
    }


@router.get("/{student_id}/badges")
async def get_student_badges(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all earned badges for a specific student (Admin only)
    """
    from app.models import UserRole
    
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get streak data
    streak_data = await StreakCalculator.calculate_comprehensive_streaks(
        db, student_id, 180
    )
    
    # Calculate earned badges
    badges = await BadgeSystem.calculate_earned_badges(
        db, student_id, streak_data
    )
    
    return {
        'badges': badges,
        'total_earned': len(badges),
        'streak_summary': {
            'current_streak': streak_data['current_streak'],
            'longest_streak': streak_data['longest_streak'],
            'is_active': streak_data['is_streak_active']
        }
    }


@router.get("/leaderboard")
async def get_streak_leaderboard(
    limit: int = Query(10, description="Number of top students", ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get leaderboard of students with highest streaks
    """
    from app.models import Student, UserRole
    from sqlalchemy import select
    
    # Get all students (limit to same faculty if not admin)
    if current_user.role == UserRole.admin:
        students_query = select(Student).limit(limit * 2)  # Get more to sort
    else:
        # Get student's faculty
        student_query = select(Student).where(Student.user_id == current_user.id)
        result = await db.execute(student_query)
        student = result.scalar_one_or_none()
        
        if not student:
            raise HTTPException(status_code=404, detail="Student profile not found")
        
        students_query = select(Student).where(
            Student.faculty_id == student.faculty_id
        ).limit(limit * 2)
    
    result = await db.execute(students_query)
    students = result.scalars().all()
    
    # Calculate streaks for each student
    leaderboard = []
    for student in students:
        streak_data = await StreakCalculator.calculate_comprehensive_streaks(
            db, student.id, 90  # Last 3 months
        )
        
        from sqlalchemy import select as sql_select
        from app.models import User
        user_query = sql_select(User).where(User.id == student.user_id)
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()
        
        leaderboard.append({
            'student_id': student.id,
            'student_name': user.full_name if user else 'Unknown',
            'student_number': student.student_id,
            'current_streak': streak_data['current_streak'],
            'longest_streak': streak_data['longest_streak'],
            'is_active': streak_data['is_streak_active']
        })
    
    # Sort by current streak (descending)
    leaderboard.sort(key=lambda x: x['current_streak'], reverse=True)
    
    return {
        'leaderboard': leaderboard[:limit],
        'total_students': len(students)
    }
