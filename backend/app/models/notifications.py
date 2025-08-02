from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class NotificationScope(enum.Enum):
    global_scope = "global_scope"
    faculty_specific = "faculty_specific"
    individual = "individual"

class NotificationPriority(enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"

class NotificationType(enum.Enum):
    info = "info"
    warning = "warning"
    success = "success"
    danger = "danger"
    announcement = "announcement"

class EnhancedNotification(Base):
    __tablename__ = "enhanced_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(Enum(NotificationType, name="notification_type", native_enum=False), nullable=False, default=NotificationType.info)
    priority = Column(Enum(NotificationPriority, name="notification_priority", native_enum=False), nullable=False, default=NotificationPriority.medium)
    scope = Column(Enum(NotificationScope, name="notification_scope", native_enum=False), nullable=False, default=NotificationScope.global_scope)
    
    # Sender information
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sender_name = Column(String, nullable=False)  # Cached for performance
    
    # Target audience
    target_faculty_id = Column(Integer, ForeignKey("faculties.id"), nullable=True)  # For faculty-specific notifications
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # For individual notifications
    
    # Additional fields
    action_url = Column(String, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    target_faculty = relationship("Faculty", foreign_keys=[target_faculty_id])
    target_user = relationship("User", foreign_keys=[target_user_id])
    read_receipts = relationship("NotificationReadReceipt", back_populates="notification", cascade="all, delete-orphan")

class NotificationReadReceipt(Base):
    __tablename__ = "notification_read_receipts"
    
    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(Integer, ForeignKey("enhanced_notifications.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    read_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    notification = relationship("EnhancedNotification", back_populates="read_receipts")
    user = relationship("User")
