from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, update, desc, text
from typing import List
from datetime import datetime
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models import User, Student, Admin, Faculty
from app.models.notifications import EnhancedNotification, NotificationReadReceipt, NotificationScope, NotificationPriority, NotificationType
from app.schemas.notifications import NotificationCreate, BulkNotificationResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])

# Simple notification structure for now
@router.get("/faculties")
async def get_faculties_for_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of faculties for notification targeting. Admin only."""
    
    print("[DEBUG] Fetching faculties for notifications")
    print(f"[DEBUG] Current user: {current_user.email}")

    # Check if user is admin
    print("[DEBUG] Checking if user is admin")
    result = await db.execute(select(Admin).filter(Admin.user_id == current_user.id))
    admin = result.scalar_one_or_none()
    print(f"[DEBUG] Admin found: {admin}")

    if not admin:
        print("[DEBUG] User is not an admin")
        raise HTTPException(status_code=403, detail="Admin access required")

    # Fetch faculties with students eagerly loaded
    result = await db.execute(select(Faculty).options(selectinload(Faculty.students)))
    faculties = result.scalars().all()

    print(f"[DEBUG] Faculties found: {len(faculties)}")
    
    return [
        {
            "id": faculty.id,
            "name": faculty.name,
            "description": faculty.description or "",
            "student_count": len(faculty.students) if faculty.students else 0
        }
        for faculty in faculties
    ]

@router.post("/", response_model=BulkNotificationResponse)
async def create_simple_notification(
    notification_data: NotificationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a notification and save it to the database. Admin only."""
    
    print(f"[DEBUG] Creating notification - User: {current_user.email} (ID: {current_user.id})")
    print(f"[DEBUG] Notification data: {notification_data}")
    
    # Check if user is admin
    result = await db.execute(select(Admin).filter(Admin.user_id == current_user.id))
    admin = result.scalar_one_or_none()
    print(f"[DEBUG] Admin check result: {admin}")
    
    if not admin:
        print(f"[DEBUG] User is not admin, rejecting request")
        raise HTTPException(status_code=403, detail="Only admins can create notifications")
    
    try:
        print(f"[DEBUG] Creating notification object...")
        # Create the notification from the validated pydantic model
        notification_dict = notification_data.model_dump()
        print(f"[DEBUG] Notification dict: {notification_dict}")
        
        new_notification = EnhancedNotification(
            **notification_dict,
            sender_id=current_user.id,
            sender_name=current_user.full_name or current_user.email,
            is_active=True
        )
        
        print(f"[DEBUG] Created notification object: {new_notification}")
        print(f"[DEBUG] Notification scope: {new_notification.scope}")
        print(f"[DEBUG] Notification type: {new_notification.type}")
        
        # Add to database
        db.add(new_notification)
        print(f"[DEBUG] Added notification to session")
        
        await db.flush()  # Get the ID without committing yet
        print(f"[DEBUG] Flushed session, notification ID: {new_notification.id}")
        
        # Calculate recipients count based on scope
        recipients_count = 0
        
        if new_notification.scope == NotificationScope.global_scope:
            print(f"[DEBUG] Calculating recipients for global scope")
            # Count all students and admins
            student_count_result = await db.execute(select(func.count(Student.id)))
            admin_count_result = await db.execute(select(func.count(Admin.id)))
            recipients_count = student_count_result.scalar_one() + admin_count_result.scalar_one()
            print(f"[DEBUG] Global scope recipients: {recipients_count}")
            
        elif new_notification.scope == NotificationScope.faculty_specific and new_notification.target_faculty_id:
            print(f"[DEBUG] Calculating recipients for faculty scope: {new_notification.target_faculty_id}")
            # Count students in specific faculty
            result = await db.execute(
                select(func.count(Student.id)).where(Student.faculty_id == new_notification.target_faculty_id)
            )
            recipients_count = result.scalar_one()
            print(f"[DEBUG] Faculty scope recipients: {recipients_count}")
            
        elif new_notification.scope == NotificationScope.individual and new_notification.target_user_id:
            print(f"[DEBUG] Individual notification to user: {new_notification.target_user_id}")
            # Individual notification
            recipients_count = 1
        
        # Commit the transaction
        print(f"[DEBUG] Committing transaction...")
        await db.commit()
        print(f"[DEBUG] Transaction committed successfully")
        
        await db.refresh(new_notification)
        print(f"[DEBUG] Notification refreshed: ID={new_notification.id}")
        
        return BulkNotificationResponse(
            success=True,
            notification_id=new_notification.id,
            recipients_count=recipients_count,
            message=f"Notification '{new_notification.title}' created successfully and sent to {recipients_count} recipients"
        )
        
    except Exception as e:
        await db.rollback()
        print(f"[ERROR] Failed to create notification: {str(e)}")
        print(f"[ERROR] Exception type: {type(e)}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to create notification: {str(e)}")

@router.get("/")
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get notifications for the current user."""
    
    try:
        print(f"[DEBUG] Getting notifications for user: {current_user.email} (ID: {current_user.id})")
        
        # Check if user is a student or admin
        result = await db.execute(select(Student).filter(Student.user_id == current_user.id))
        student = result.scalar_one_or_none()
        result = await db.execute(select(Admin).filter(Admin.user_id == current_user.id))
        admin = result.scalar_one_or_none()
        
        print(f"[DEBUG] User roles - Admin: {admin is not None}, Student: {student is not None}")
        
        if not student and not admin:
            raise HTTPException(status_code=403, detail="Access denied")
        
        notifications_query = None
        
        if admin:
            print(f"[DEBUG] User is admin, fetching admin notifications")
            # Admins can see all notifications and their own created notifications
            notifications_query = select(EnhancedNotification).options(
                selectinload(EnhancedNotification.read_receipts)
            ).filter(
                and_(
                    EnhancedNotification.is_active == True,
                    or_(
                        EnhancedNotification.scope == NotificationScope.global_scope,
                        EnhancedNotification.sender_id == current_user.id,
                        EnhancedNotification.target_user_id == current_user.id
                    )
                )
            ).order_by(EnhancedNotification.created_at.desc())
            
        elif student:
            print(f"[DEBUG] User is student, fetching student notifications")
            print(f"[DEBUG] Student faculty_id: {student.faculty_id}")
            print(f"[DEBUG] Student faculty name: {student.faculty}")
            # Students see notifications targeted to them
            notifications_query = select(EnhancedNotification).options(
                selectinload(EnhancedNotification.read_receipts)
            ).filter(
                and_(
                    EnhancedNotification.is_active == True,
                    or_(
                        EnhancedNotification.scope == NotificationScope.global_scope,
                        and_(
                            EnhancedNotification.scope == NotificationScope.faculty_specific,
                            EnhancedNotification.target_faculty_id == student.faculty_id
                        ),
                        EnhancedNotification.target_user_id == current_user.id
                    )
                )
            ).order_by(EnhancedNotification.created_at.desc())
        
        result = await db.execute(notifications_query)
        notifications = result.scalars().all()
        
        print(f"[DEBUG] Found {len(notifications)} notifications")
        for notif in notifications:
            print(f"[DEBUG] Notification: ID={notif.id}, Title={notif.title}, Scope={notif.scope.value}, Target Faculty ID={notif.target_faculty_id}")
            if notif.scope == NotificationScope.faculty_specific:
                print(f"[DEBUG]   Faculty-specific notification - Student faculty_id={student.faculty_id if student else 'N/A'}, Target faculty_id={notif.target_faculty_id}")
        
        
        # Format response
        response_notifications = []
        for notification in notifications:
            # Check if user has read this notification
            read_receipt = None
            for receipt in notification.read_receipts:
                if receipt.user_id == current_user.id:
                    read_receipt = receipt
                    break
            
            response_notifications.append({
                "id": notification.id,
                "title": notification.title,
                "message": notification.message,
                "type": notification.type.value,
                "priority": notification.priority.value,
                "scope": notification.scope.value,
                "sender_id": notification.sender_id,
                "sender_name": notification.sender_name,
                "target_faculty_id": notification.target_faculty_id,
                "target_user_id": notification.target_user_id,
                "action_url": notification.action_url,
                "expires_at": notification.expires_at.isoformat() if notification.expires_at else None,
                "created_at": notification.created_at.isoformat(),
                "updated_at": notification.updated_at.isoformat(),
                "is_read": read_receipt is not None,
                "read_at": read_receipt.read_at.isoformat() if read_receipt else None
            })
        
        return response_notifications
        
    except Exception as e:
        print(f"[ERROR] Failed to fetch notifications: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch notifications: {str(e)}")

@router.put("/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a notification as read."""
    
    try:
        # Check if notification exists
        result = await db.execute(
            select(EnhancedNotification).filter(EnhancedNotification.id == notification_id)
        )
        notification = result.scalar_one_or_none()
        
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        # Check if read receipt already exists
        result = await db.execute(
            select(NotificationReadReceipt).filter(
                and_(
                    NotificationReadReceipt.notification_id == notification_id,
                    NotificationReadReceipt.user_id == current_user.id
                )
            )
        )
        existing_receipt = result.scalar_one_or_none()
        
        if not existing_receipt:
            # Create new read receipt
            read_receipt = NotificationReadReceipt(
                notification_id=notification_id,
                user_id=current_user.id
            )
            db.add(read_receipt)
            await db.commit()
        
        return {
            "success": True,
            "message": f"Notification {notification_id} marked as read"
        }
        
    except Exception as e:
        await db.rollback()
        print(f"[ERROR] Failed to mark notification as read: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to mark notification as read: {str(e)}")

@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a notification. Only admins can delete notifications."""
    
    try:
        # Check if user is admin
        result = await db.execute(select(Admin).filter(Admin.user_id == current_user.id))
        admin = result.scalar_one_or_none()
        if not admin:
            raise HTTPException(status_code=403, detail="Only admins can delete notifications")
        
        # Check if notification exists
        result = await db.execute(
            select(EnhancedNotification).filter(EnhancedNotification.id == notification_id)
        )
        notification = result.scalar_one_or_none()
        
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found or access denied")
        
        # Hard delete - actually remove from database
        await db.delete(notification)
        await db.commit()
        
        return {
            "success": True,
            "message": f"Notification {notification_id} deleted successfully"
        }
        
    except Exception as e:
        await db.rollback()
        print(f"[ERROR] Failed to delete notification: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete notification: {str(e)}")


# ============================================================================
# INBOX ENDPOINTS (per-user read/clear without deletion)
# ============================================================================

@router.get("/inbox")
async def get_inbox(
    only_unread: bool = Query(True, description="Return only unread (not dismissed) notifications"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Inbox for the current user (student/admin). Returns notifications relevant to this user
    (global, faculty-specific to their faculty, or individual) excluding dismissed.
    """
    
    # Check if user is a student or admin
    result = await db.execute(select(Student).filter(Student.user_id == current_user.id))
    student = result.scalar_one_or_none()
    result = await db.execute(select(Admin).filter(Admin.user_id == current_user.id))
    admin = result.scalar_one_or_none()
    
    if not student and not admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Build relevance conditions
    if admin:
        relevance = or_(
            EnhancedNotification.scope == NotificationScope.global_scope,
            EnhancedNotification.target_user_id == current_user.id,
        )
    elif student:
        relevance = or_(
            EnhancedNotification.scope == NotificationScope.global_scope,
            and_(
                EnhancedNotification.scope == NotificationScope.faculty_specific,
                EnhancedNotification.target_faculty_id == student.faculty_id,
            ),
            EnhancedNotification.target_user_id == current_user.id,
        )
    
    # LEFT JOIN receipts for this user to evaluate read/dismiss state
    receipts_subq = (
        select(NotificationReadReceipt)
        .where(NotificationReadReceipt.user_id == current_user.id)
        .subquery()
    )
    
    # Base query
    query = (
        select(EnhancedNotification, receipts_subq.c.read_at, receipts_subq.c.dismissed_at)
        .outerjoin(receipts_subq, receipts_subq.c.notification_id == EnhancedNotification.id)
        .where(and_(EnhancedNotification.is_active == True, relevance))
    )
    
    # Exclude dismissed always
    query = query.where(or_(receipts_subq.c.dismissed_at.is_(None)))
    
    # Filter only unread if requested
    if only_unread:
        query = query.where(or_(receipts_subq.c.read_at.is_(None)))
    
    query = query.order_by(desc(EnhancedNotification.created_at), desc(EnhancedNotification.id)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    rows = result.all()
    
    def serialize_row(notif, read_at, dismissed_at):
        safe_payload = getattr(notif, "payload", None) if isinstance(getattr(notif, "payload", None), dict) else None
        return {
            "id": notif.id,
            "title": notif.title,
            "message": notif.message,
            "type": notif.type.value,
            "priority": notif.priority.value,
            "scope": notif.scope.value,
            "sender_name": notif.sender_name,
            "created_at": notif.created_at.isoformat(),
            "payload": safe_payload,
            "is_read": read_at is not None,
        }
    
    return [serialize_row(n, r, d) for (n, r, d) in rows]


@router.post("/{notification_id}/mark-read")
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark a notification as read for the current user (idempotent).
    """
    # Verify notification is relevant
    notif_result = await db.execute(
        select(EnhancedNotification).where(EnhancedNotification.id == notification_id)
    )
    notif = notif_result.scalar_one_or_none()
    if not notif or not notif.is_active:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Check user access
    result = await db.execute(select(Student).filter(Student.user_id == current_user.id))
    student = result.scalar_one_or_none()
    result = await db.execute(select(Admin).filter(Admin.user_id == current_user.id))
    admin = result.scalar_one_or_none()
    
    if admin:
        is_relevant = (
            notif.scope == NotificationScope.global_scope or
            notif.target_user_id == current_user.id
        )
    elif student:
        is_relevant = (
            notif.scope == NotificationScope.global_scope or
            (notif.scope == NotificationScope.faculty_specific and notif.target_faculty_id == student.faculty_id) or
            notif.target_user_id == current_user.id
        )
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not is_relevant:
        raise HTTPException(status_code=403, detail="Not authorized for this notification")
    
    # Upsert receipt
    receipt_result = await db.execute(
        select(NotificationReadReceipt).where(
            and_(
                NotificationReadReceipt.notification_id == notification_id,
                NotificationReadReceipt.user_id == current_user.id,
            )
        )
    )
    receipt = receipt_result.scalar_one_or_none()
    now = datetime.now()
    if receipt:
        if receipt.read_at is None:
            receipt.read_at = now
    else:
        new_receipt = NotificationReadReceipt(
            notification_id=notification_id,
            user_id=current_user.id,
            read_at=now,
            dismissed_at=None,
        )
        db.add(new_receipt)
    
    await db.commit()
    return {"success": True}


@router.post("/{notification_id}/dismiss")
async def dismiss_notification_for_user(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Dismiss a single notification for the current user (idempotent).
    """
    notif_result = await db.execute(
        select(EnhancedNotification).where(EnhancedNotification.id == notification_id)
    )
    notif = notif_result.scalar_one_or_none()
    if not notif or not notif.is_active:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Check user access
    result = await db.execute(select(Student).filter(Student.user_id == current_user.id))
    student = result.scalar_one_or_none()
    result = await db.execute(select(Admin).filter(Admin.user_id == current_user.id))
    admin = result.scalar_one_or_none()
    
    if admin:
        is_relevant = (
            notif.scope == NotificationScope.global_scope or
            notif.target_user_id == current_user.id
        )
    elif student:
        is_relevant = (
            notif.scope == NotificationScope.global_scope or
            (notif.scope == NotificationScope.faculty_specific and notif.target_faculty_id == student.faculty_id) or
            notif.target_user_id == current_user.id
        )
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not is_relevant:
        raise HTTPException(status_code=403, detail="Not authorized for this notification")
    
    receipt_result = await db.execute(
        select(NotificationReadReceipt).where(
            and_(
                NotificationReadReceipt.notification_id == notification_id,
                NotificationReadReceipt.user_id == current_user.id,
            )
        )
    )
    receipt = receipt_result.scalar_one_or_none()
    now = datetime.now()
    if receipt:
        receipt.dismissed_at = receipt.dismissed_at or now
        if receipt.read_at is None:
            receipt.read_at = now
    else:
        new_receipt = NotificationReadReceipt(
            notification_id=notification_id,
            user_id=current_user.id,
            read_at=now,
            dismissed_at=now,
        )
        db.add(new_receipt)
    
    await db.commit()
    return {"success": True}


@router.post("/dismiss-all")
async def dismiss_all_notifications_for_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Dismiss all relevant notifications for current user.
    Performs an INSERT ... SELECT for missing receipts and an UPDATE for existing ones.
    """
    # Check user type
    result = await db.execute(select(Student).filter(Student.user_id == current_user.id))
    student = result.scalar_one_or_none()
    result = await db.execute(select(Admin).filter(Admin.user_id == current_user.id))
    admin = result.scalar_one_or_none()
    
    if not student and not admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # INSERT missing receipts as dismissed in a single SQL statement
    if admin:
        insert_sql = text(
            """
            INSERT INTO notification_read_receipts (notification_id, user_id, read_at, dismissed_at)
            SELECT n.id, :uid, NOW(), NOW()
            FROM enhanced_notifications n
            LEFT JOIN notification_read_receipts r
              ON r.notification_id = n.id AND r.user_id = :uid
            WHERE n.is_active = TRUE
              AND (
                    n.scope = :global
                 OR n.target_user_id = :uid
              )
              AND r.id IS NULL
            """
        )
        await db.execute(
            insert_sql,
            {
                "uid": current_user.id,
                "global": "global_scope",
            },
        )
    elif student:
        insert_sql = text(
            """
            INSERT INTO notification_read_receipts (notification_id, user_id, read_at, dismissed_at)
            SELECT n.id, :uid, NOW(), NOW()
            FROM enhanced_notifications n
            LEFT JOIN notification_read_receipts r
              ON r.notification_id = n.id AND r.user_id = :uid
            WHERE n.is_active = TRUE
              AND (
                    n.scope = :global
                 OR (n.scope = :faculty AND n.target_faculty_id = :fid)
                 OR n.target_user_id = :uid
              )
              AND r.id IS NULL
            """
        )
        await db.execute(
            insert_sql,
            {
                "uid": current_user.id,
                "fid": student.faculty_id,
                "global": "global_scope",
                "faculty": "faculty_specific",
            },
        )
    
    # UPDATE existing receipts to set dismissed_at where not already dismissed
    await db.execute(
        update(NotificationReadReceipt)
        .where(
            and_(
                NotificationReadReceipt.user_id == current_user.id,
                NotificationReadReceipt.dismissed_at.is_(None),
            )
        )
        .values(dismissed_at=datetime.now(), read_at=func.coalesce(NotificationReadReceipt.read_at, datetime.now()))
    )
    
    await db.commit()
    return {"success": True}
