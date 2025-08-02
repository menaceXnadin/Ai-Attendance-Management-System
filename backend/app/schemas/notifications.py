from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum

class NotificationScope(str, Enum):
    global_scope = "global_scope"
    faculty_specific = "faculty_specific"
    individual = "individual"

class NotificationPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"

class NotificationType(str, Enum):
    info = "info"
    warning = "warning"
    success = "success"
    danger = "danger"
    announcement = "announcement"

class NotificationCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=2000)
    type: NotificationType = NotificationType.info
    priority: NotificationPriority = NotificationPriority.medium
    scope: NotificationScope = NotificationScope.global_scope
    target_faculty_id: Optional[int] = None
    target_user_id: Optional[int] = None
    action_url: Optional[str] = None
    expires_at: Optional[datetime] = None

    @validator('target_faculty_id', 'target_user_id', pre=True)
    def empty_str_to_none(cls, v):
        if v == '':
            return None
        return v

class NotificationUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    type: Optional[NotificationType] = None
    priority: Optional[NotificationPriority] = None
    action_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None

class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: NotificationType
    priority: NotificationPriority
    scope: NotificationScope
    sender_id: int
    sender_name: str
    target_faculty_id: Optional[int] = None
    target_user_id: Optional[int] = None
    action_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    is_read: bool = False  # Will be set based on read receipt
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class NotificationStats(BaseModel):
    total_notifications: int
    unread_count: int
    notifications_by_type: dict
    notifications_by_priority: dict

class BulkNotificationResponse(BaseModel):
    success: bool
    notification_id: int
    recipients_count: int
    message: str
