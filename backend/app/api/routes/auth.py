from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta, datetime
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.models import User, Student, Admin
from app.schemas import (
    LoginRequest, Token, UserCreate, User as UserSchema,
    StudentCreate, Student as StudentSchema
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
    role="student"
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
