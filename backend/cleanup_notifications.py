#!/usr/bin/env python3
"""
Clean up old inactive notifications from database
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_db
from app.models.notifications import EnhancedNotification

async def cleanup_inactive_notifications():
    async for db in get_db():
        try:
            # Count inactive notifications before cleanup
            result = await db.execute(
                select(EnhancedNotification).filter(EnhancedNotification.is_active == False)
            )
            inactive_notifications = result.scalars().all()
            
            print(f"Found {len(inactive_notifications)} inactive notifications to clean up:")
            for notif in inactive_notifications:
                print(f"  - ID: {notif.id}, Title: {notif.title[:50]}...")
            
            if len(inactive_notifications) > 0:
                # Delete all inactive notifications
                result = await db.execute(
                    delete(EnhancedNotification).filter(EnhancedNotification.is_active == False)
                )
                
                await db.commit()
                print(f"✅ Successfully deleted {result.rowcount} inactive notifications")
            else:
                print("No inactive notifications to clean up")
            
            # Verify cleanup
            result = await db.execute(select(EnhancedNotification))
            remaining_notifications = result.scalars().all()
            print(f"📊 Total notifications remaining in database: {len(remaining_notifications)}")
            
        except Exception as e:
            await db.rollback()
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            break

if __name__ == "__main__":
    asyncio.run(cleanup_inactive_notifications())
