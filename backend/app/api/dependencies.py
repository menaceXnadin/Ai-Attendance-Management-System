from typing import Optional, Set, Tuple

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_token
from app.models import User, Student, Admin, Teacher, ClassSchedule

security = HTTPBearer()


# ---------------------------------------------------------------------------
# Role helpers
#
# ``User.role`` is a ``UserRole`` enum, so comparing it to a plain string
# (``user.role == "admin"``) is always False. Every role check must go through
# these helpers. "teacher" is accepted as an alias of the stored "faculty" role.
# ---------------------------------------------------------------------------

_ROLE_ALIASES = {"teacher": "faculty"}


def _normalize_role(role) -> str:
    if role is None:
        return ""
    value = getattr(role, "value", role)
    value = str(value).strip().lower()
    return _ROLE_ALIASES.get(value, value)


def role_of(user) -> str:
    """Return the user's role as a lowercase string ("admin", "faculty", "student")."""
    return _normalize_role(getattr(user, "role", None))


def has_role(user, *roles) -> bool:
    """True if the user's role is one of ``roles`` (strings or UserRole members)."""
    if user is None:
        return False
    wanted = {_normalize_role(r) for r in roles}
    return role_of(user) in wanted


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user."""
    token = credentials.credentials
    payload = verify_token(token)

    user_id_str: str = payload.get("sub")
    role: str = payload.get("role")

    if user_id_str is None or role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token"
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user"
        )

    # Ensure the role in the token matches the user's role in the database
    if role_of(user) != _normalize_role(role):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Role mismatch"
        )

    return user


def require_roles(*roles):
    """Dependency factory: allow only users whose role is one of ``roles``."""
    allowed = tuple(sorted({_normalize_role(r) for r in roles}))

    async def _require_roles(current_user: User = Depends(get_current_user)) -> User:
        if not has_role(current_user, *allowed):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user

    _require_roles.__name__ = "require_roles_" + "_".join(allowed)
    _require_roles.__qualname__ = _require_roles.__name__
    return _require_roles


async def get_current_student(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Student:
    """Get current student (requires student role)."""
    if not has_role(current_user, "student"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = result.scalar_one_or_none()

    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found"
        )

    return student


async def get_current_admin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Admin:
    """Get current admin (requires admin role)."""
    if not has_role(current_user, "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    result = await db.execute(
        select(Admin).where(Admin.user_id == current_user.id)
    )
    admin = result.scalar_one_or_none()

    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin profile not found"
        )

    return admin


def require_admin_role(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role."""
    if not has_role(current_user, "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def require_student_role(current_user: User = Depends(get_current_user)) -> User:
    """Require student role."""
    if not has_role(current_user, "student"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )
    return current_user


async def get_current_teacher(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Teacher:
    """Get current teacher (requires teacher/faculty role)."""
    if not has_role(current_user, "faculty"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    result = await db.execute(
        select(Teacher).options(selectinload(Teacher.user)).where(Teacher.user_id == current_user.id)
    )
    teacher = result.scalar_one_or_none()

    if teacher is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher profile not found"
        )

    return teacher


def require_teacher_role(current_user: User = Depends(get_current_user)) -> User:
    """Require teacher/faculty role."""
    if not has_role(current_user, "faculty"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher access required"
        )
    return current_user


def require_admin_or_teacher(current_user: User = Depends(get_current_user)) -> User:
    """Require either admin or teacher role."""
    if not has_role(current_user, "admin", "faculty"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or teacher access required"
        )
    return current_user


# Preferred name; same dependency.
require_teacher_or_admin = require_admin_or_teacher


def debug_tools_enabled() -> bool:
    """Debug/test endpoints are only served when the app runs with DEBUG on."""
    return bool(getattr(settings, "debug", False))


def require_debug_admin(current_user: User = Depends(get_current_user)) -> User:
    """Admin-only access to debug/test endpoints, and only when DEBUG is enabled.

    When DEBUG is off the endpoint answers 404 so it is indistinguishable from
    a route that does not exist.
    """
    if not debug_tools_enabled():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested resource was not found"
        )
    if not has_role(current_user, "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# ---------------------------------------------------------------------------
# Ownership / scope helpers
# ---------------------------------------------------------------------------

async def get_student_for_user(db: AsyncSession, user: User) -> Optional[Student]:
    """Return the Student profile belonging to ``user`` (or None)."""
    result = await db.execute(select(Student).where(Student.user_id == user.id))
    return result.scalars().first()


async def get_teacher_for_user(db: AsyncSession, user: User) -> Optional[Teacher]:
    """Return the Teacher profile belonging to ``user`` (or None)."""
    result = await db.execute(select(Teacher).where(Teacher.user_id == user.id))
    return result.scalars().first()


async def get_teacher_cohorts(db: AsyncSession, teacher_id: int) -> Set[Tuple[int, int]]:
    """(faculty_id, semester) pairs of every class_schedules row taught by the teacher."""
    result = await db.execute(
        select(ClassSchedule.faculty_id, ClassSchedule.semester)
        .where(ClassSchedule.teacher_id == teacher_id)
        .distinct()
    )
    return {(row[0], row[1]) for row in result.all()}


async def teacher_teaches_student(db: AsyncSession, teacher_id: int, student: Student) -> bool:
    """True if the teacher has any schedule row for the student's cohort."""
    if student.faculty_id is None or student.semester is None:
        return False
    result = await db.execute(
        select(ClassSchedule.id)
        .where(
            ClassSchedule.teacher_id == teacher_id,
            ClassSchedule.faculty_id == student.faculty_id,
            ClassSchedule.semester == student.semester,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def resolve_student_scope(
    current_user: User,
    student_id: Optional[int],
    db: AsyncSession,
) -> Optional[int]:
    """Return the student id (students.id) the caller may read.

    - student: only themselves. ``student_id=None`` resolves to their own id;
      any other id -> 403.
    - admin: any student; ``None`` stays ``None`` (caller decides what "all" means).
    - teacher (faculty): students in a cohort (faculty_id + semester) of any
      class_schedules row assigned to them; otherwise 403. ``None`` stays ``None``.
    - anything else: 403.
    """
    if has_role(current_user, "admin"):
        return student_id

    if has_role(current_user, "student"):
        own = await get_student_for_user(db, current_user)
        if own is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found"
            )
        if student_id is not None and int(student_id) != own.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this student's data"
            )
        return own.id

    if has_role(current_user, "faculty"):
        if student_id is None:
            return None
        teacher = await get_teacher_for_user(db, current_user)
        if teacher is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Teacher profile not found"
            )
        result = await db.execute(select(Student).where(Student.id == student_id))
        student = result.scalars().first()
        if student is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        if not await teacher_teaches_student(db, teacher.id, student):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this student's data"
            )
        return student.id

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not enough permissions"
    )


def require_face_engine():
    """503 ``face_engine_unavailable`` when the InsightFace models failed to load (the engine
    singleton is ``None``). Add to every endpoint that runs face models."""
    from app.services import insightface_service as engine_module

    if getattr(engine_module, "insightface_service", None) is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "face_engine_unavailable",
                    "message": "Face recognition is temporarily unavailable. Please contact an administrator.",
                    "details": {}},
        )
