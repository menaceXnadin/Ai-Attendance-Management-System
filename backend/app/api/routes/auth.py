from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import timedelta, datetime
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.core.config import settings
from app.models import User, Student, Admin, PasswordResetToken
from app.schemas import (
    LoginRequest, Token, UserCreate, User as UserSchema,
    StudentCreate, Student as StudentSchema,
    PasswordResetRequest, PasswordResetConfirm, PasswordResetResponse
)
from app.api.dependencies import get_current_user, get_current_admin

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user and return access token."""
    # Find user by email
    result = await db.execute(select(User).where(User.email == login_data.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    
    # Track user session
    try:
        from app.services.system_monitor import SessionManager
        await SessionManager.create_session(
            db=db,
            user_id=user.id,
            token=access_token
        )
    except Exception as e:
        print(f"Warning: Failed to create session tracking: {e}")
    
    return Token(
        access_token=access_token,
        user=UserSchema.from_orm(user)
    )

@router.post("/register-student", response_model=StudentSchema)
async def register_student(
    student_data: StudentCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    """Register a new student (admin only)."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == student_data.user.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if student ID already exists
    result = await db.execute(select(Student).where(Student.student_id == student_data.student_id))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student ID already exists"
        )
    
    # Create user
    user = User(
        email=student_data.user.email,
        full_name=student_data.user.full_name,
        hashed_password=get_password_hash(student_data.user.password),
        role="student"  # FIXED: Correct indentation
    )
    db.add(user)
    await db.flush()  # Get user ID
    
    # Create student profile
    student = Student(
        user_id=user.id,
        student_id=student_data.student_id,
        faculty=student_data.faculty,
        year=student_data.year,
        phone_number=student_data.phone_number,
        emergency_contact=student_data.emergency_contact
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)
    
    return StudentSchema.from_orm(student)

@router.get("/me", response_model=UserSchema)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user information."""
    return UserSchema.from_orm(current_user)

@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Logout user and end session tracking."""
    try:
        from app.services.system_monitor import SessionManager
        await SessionManager.end_session(db=db, user_id=current_user.id)
    except Exception as e:
        print(f"Warning: Failed to end session tracking: {e}")
    
    return {"message": "Successfully logged out"}

@router.post("/refresh-token", response_model=Token)
async def refresh_token(
    current_user: User = Depends(get_current_user)
):
    """Refresh access token."""
    access_token = create_access_token(data={"sub": str(current_user.id), "role": current_user.role.value})
    
    return Token(
        access_token=access_token,
        user=UserSchema.from_orm(current_user)
    )


@router.post("/forgot-password", response_model=PasswordResetResponse)
async def forgot_password(
    request: PasswordResetRequest,
    db: AsyncSession = Depends(get_db)
):
    """Public password reset request.
    New simplified logic:
    - Always (re)issues a fresh token for an existing user (no throttling) so admin sees the newest request.
    - Invalidates all previous unused tokens for that user.
    - Does NOT leak token or URL to the caller.
    - Returns generic success regardless of user existence.
    """
    import secrets, asyncio
    start_time = datetime.utcnow()
    normalized_email = request.email.strip().lower()
    result = await db.execute(
        select(User).where(func.lower(User.email) == normalized_email)
    )
    user = result.scalar_one_or_none()
    if user:
        now = datetime.utcnow()
        existing = (await db.execute(
            select(PasswordResetToken)
            .where(PasswordResetToken.user_id == user.id)
            .where(PasswordResetToken.is_used == False)
        )).scalars().all()
        for t in existing:
            t.is_used = True
        new_token = PasswordResetToken(
            user_id=user.id,
            token=secrets.token_urlsafe(32),
            expires_at=now + timedelta(hours=1),
            created_at=now  # explicit so we control timezone (UTC naive)
        )
        db.add(new_token)
        await db.commit()
    # Constant response time padding (basic side-channel noise)
    elapsed = (datetime.utcnow() - start_time).total_seconds()
    if elapsed < 0.25:
        await asyncio.sleep(0.25 - elapsed)
    return PasswordResetResponse(success=True, message="If the account exists, a reset request was recorded.")

@router.post("/admin/generate-reset-link", response_model=PasswordResetResponse)
async def admin_generate_reset_link(
    request: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    """Admin-only: Always issues a fresh token (previous unused tokens invalidated)."""
    import secrets
    normalized_email = request.email.strip().lower()
    result = await db.execute(
        select(User).where(func.lower(User.email) == normalized_email)
    )
    user = result.scalar_one_or_none()
    if not user:
        return PasswordResetResponse(success=False, message="User not found")
    now = datetime.utcnow()
    prev = (await db.execute(
        select(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id)
        .where(PasswordResetToken.is_used == False)
    )).scalars().all()
    for t in prev:
        t.is_used = True
    new_token = PasswordResetToken(
        user_id=user.id,
        token=secrets.token_urlsafe(32),
        expires_at=now + timedelta(hours=1),
        created_at=now
    )
    db.add(new_token)
    await db.commit()
    reset_url = f"{settings.frontend_base_url}/reset-password?token={new_token.token}"
    return PasswordResetResponse(success=True, message="Reset link generated", reset_token=new_token.token, reset_url=reset_url)

@router.get("/admin/reset-requests")
async def admin_list_reset_requests(
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    """Admin-only: List all unused tokens with server-evaluated expiry flag."""
    now = datetime.utcnow()
    result = await db.execute(
        select(PasswordResetToken, User)
        .join(User, PasswordResetToken.user_id == User.id)
        .where(PasswordResetToken.is_used == False)
        .order_by(PasswordResetToken.created_at.desc())
    )
    rows = result.all()
    out = []
    for token, user in rows:
        created_iso = token.created_at.isoformat() + 'Z' if not token.created_at.isoformat().endswith('Z') else token.created_at.isoformat()
        expires_iso = token.expires_at.isoformat() + 'Z' if not token.expires_at.isoformat().endswith('Z') else token.expires_at.isoformat()
        expired = now > token.expires_at
        out.append({
            "id": token.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "created_at": created_iso,
            "expires_at": expires_iso,
            "expired": expired,
            "token": token.token,
        })
    return {"success": True, "requests": out}

@router.post("/reset-password", response_model=PasswordResetResponse)
async def reset_password(
    request: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db)
):
    """
    Reset password using a valid reset token (no email notifications).
    """
    
    # Find the reset token
    result = await db.execute(
        select(PasswordResetToken)
        .where(PasswordResetToken.token == request.token)
        .where(PasswordResetToken.is_used == False)
    )
    token_record = result.scalar_one_or_none()
    
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Check if token is expired
    if datetime.utcnow() > token_record.expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one."
        )
    
    # Get the user
    result = await db.execute(
        select(User).where(User.id == token_record.user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update password
    user.hashed_password = get_password_hash(request.new_password)
    
    # Mark token as used
    token_record.is_used = True
    
    await db.commit()
    
    return PasswordResetResponse(
        success=True,
        message="Password has been reset successfully. You can now login with your new password."
    )
