from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models import User, Admin, UserRole
from app.schemas import Admin as AdminSchema, AdminCreate, AdminBase, User as UserSchema
from app.api.dependencies import get_current_admin

router = APIRouter(prefix="/admins", tags=["admin management"])

@router.get("/", response_model=List[AdminSchema])
async def get_all_admins(
    skip: int = 0,
    limit: int = 100,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all admin users (admin only)."""
    result = await db.execute(
        select(Admin)
        .options(selectinload(Admin.user))
        .offset(skip)
        .limit(limit)
    )
    admins = result.scalars().all()
    return admins

@router.get("/{admin_id}", response_model=AdminSchema)
async def get_admin(
    admin_id: int,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific admin by ID (admin only)."""
    result = await db.execute(
        select(Admin)
        .options(selectinload(Admin.user))
        .where(Admin.id == admin_id)
    )
    admin = result.scalar_one_or_none()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found"
        )
    
    return admin

@router.post("/", response_model=AdminSchema)
async def create_admin(
    admin_data: AdminCreate,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new admin user (admin only)."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == admin_data.user.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if admin_id already exists
    result = await db.execute(select(Admin).where(Admin.admin_id == admin_data.admin_id))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin ID already exists"
        )
    
    try:
        # Create user
        user = User(
            email=admin_data.user.email,
            full_name=admin_data.user.full_name,
            hashed_password=get_password_hash(admin_data.user.password),
            role=UserRole.admin,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        # Create admin profile
        admin_profile = Admin(
            user_id=user.id,
            admin_id=admin_data.admin_id,
            name=admin_data.name,  # Use the name from the request
            department=admin_data.department,
            permissions=admin_data.permissions or [
                "manage_students",
                "manage_faculty",
                "manage_subjects",
                "view_reports",
                "manage_attendance"
            ],
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.add(admin_profile)
        await db.commit()
        await db.refresh(admin_profile, ["user"])
        
        return admin_profile
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create admin: {str(e)}"
        )

@router.put("/{admin_id}", response_model=AdminSchema)
async def update_admin(
    admin_id: int,
    admin_data: AdminBase,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update an admin user (admin only)."""
    result = await db.execute(
        select(Admin)
        .options(selectinload(Admin.user))
        .where(Admin.id == admin_id)
    )
    admin = result.scalar_one_or_none()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found"
        )
    
    try:
        # Update admin fields
        if admin_data.admin_id and admin_data.admin_id != admin.admin_id:
            # Check if new admin_id already exists
            existing_admin = await db.execute(
                select(Admin).where(Admin.admin_id == admin_data.admin_id, Admin.id != admin_id)
            )
            if existing_admin.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Admin ID already exists"
                )
            admin.admin_id = admin_data.admin_id
        
        if admin_data.name:
            admin.name = admin_data.name
            # Also update user's full_name to keep them in sync
            admin.user.full_name = admin_data.name
        
        if admin_data.department is not None:
            admin.department = admin_data.department
        
        if admin_data.permissions is not None:
            admin.permissions = admin_data.permissions
        
        admin.updated_at = datetime.now()
        admin.user.updated_at = datetime.now()
        
        await db.commit()
        await db.refresh(admin, ["user"])
        
        return admin
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update admin: {str(e)}"
        )

@router.delete("/{admin_id}")
async def delete_admin(
    admin_id: int,
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete an admin user (admin only)."""
    result = await db.execute(
        select(Admin)
        .options(selectinload(Admin.user))
        .where(Admin.id == admin_id)
    )
    admin = result.scalar_one_or_none()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found"
        )
    
    # Prevent deleting the last admin or self-deletion
    if admin.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own admin account"
        )
    
    try:
        # Delete admin profile (this will also delete the user due to cascade)
        await db.delete(admin)
        await db.commit()
        
        return {"message": "Admin deleted successfully"}
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete admin: {str(e)}"
        )

@router.get("/me", response_model=AdminSchema)
async def get_current_admin_info(
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get current admin information."""
    # Refresh the admin with user relationship
    await db.refresh(current_admin, ["user"])
    return current_admin
