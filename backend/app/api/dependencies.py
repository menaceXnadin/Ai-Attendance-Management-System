from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import verify_token
from app.models import User, Student, Admin

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user."""
    print(f"[DEBUG] Token received: {credentials.credentials[:50]}...")
    token = credentials.credentials
    payload = verify_token(token)
    print(f"[DEBUG] Token payload: {payload}")

    user_id_str: str = payload.get("sub")
    role: str = payload.get("role")
    print(f"[DEBUG] User ID: {user_id_str}, Role: {role}")
    
    if user_id_str is None or role is None:
        print("[DEBUG] Missing user_id or role in token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        print("[DEBUG] Invalid user ID format")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token"
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    print(f"[DEBUG] User found: {user.email if user else 'None'}")

    if user is None:
        print("[DEBUG] User not found in database")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.is_active:
        print("[DEBUG] User is inactive")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user"
        )

    # Ensure the role matches the user's role in the database (compare as strings)
    user_role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)
    if user_role_str != role:
        print(f"[DEBUG] Role mismatch: token={role}, db={user_role_str}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Role mismatch"
        )

    # Update session activity for real-time tracking
    try:
        from app.services.system_monitor import SessionManager
        await SessionManager.update_activity(db=db, user_id=user.id)
    except Exception as e:
        print(f"[DEBUG] Warning: Failed to update session activity: {e}")

    print("[DEBUG] Authentication successful")
    return user

async def get_current_student(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Student:
    """Get current student (requires student role)."""
    current_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if current_role != "student":
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
    current_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if current_role != "admin":
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
    current_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if current_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

def require_student_role(current_user: User = Depends(get_current_user)) -> User:
    """Require student role."""
    current_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if current_role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )
    return current_user
