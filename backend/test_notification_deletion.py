#!/usr/bin/env python3
"""
Test notification creation and deletion
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.database import get_db
from app.models.notifications import EnhancedNotification, NotificationScope, NotificationPriority, NotificationType

async def test_notification_lifecycle():
    async for db in get_db():
        try:
            # 1. Create a test notification
            test_notification = EnhancedNotification(
                title="Test Notification for Deletion",
                message="This is a test message",
                type=NotificationType.info,
                priority=NotificationPriority.medium,
                scope=NotificationScope.global_scope,
                sender_id=1,
                sender_name="Test Admin",
                is_active=True
            )
            
            db.add(test_notification)
            await db.flush()  # Get ID
            test_id = test_notification.id
            await db.commit()
            
            print(f"✅ Created test notification with ID: {test_id}")
            
            # 2. Verify it exists
            result = await db.execute(
                select(EnhancedNotification).filter(EnhancedNotification.id == test_id)
            )
            found_notification = result.scalar_one_or_none()
            
            if found_notification:
                print(f"✅ Notification {test_id} found in database")
                print(f"   Title: {found_notification.title}")
                print(f"   Is Active: {found_notification.is_active}")
            else:
                print(f"❌ Notification {test_id} not found!")
                return
            
            # 3. Now delete it (hard delete)
            await db.delete(found_notification)
            await db.commit()
            print(f"✅ Deleted notification {test_id}")
            
            # 4. Verify it's gone
            result = await db.execute(
                select(EnhancedNotification).filter(EnhancedNotification.id == test_id)
            )
            deleted_notification = result.scalar_one_or_none()
            
            if deleted_notification is None:
                print(f"✅ Notification {test_id} successfully removed from database")
            else:
                print(f"❌ Notification {test_id} still exists in database!")
            
            # 5. Check current notification count
            result = await db.execute(select(EnhancedNotification))
            all_notifications = result.scalars().all()
            print(f"📊 Total notifications remaining: {len(all_notifications)}")
            
        except Exception as e:
            await db.rollback()
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            break

if __name__ == "__main__":
    asyncio.run(test_notification_lifecycle())
