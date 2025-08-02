#!/usr/bin/env python3
"""
Check notification status in database
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.database import get_db
from app.models.notifications import EnhancedNotification

async def check_notifications():
    async for db in get_db():
        try:
            # Check all notifications (including inactive ones)
            result = await db.execute(
                select(EnhancedNotification).order_by(EnhancedNotification.created_at.desc())
            )
            all_notifications = result.scalars().all()
            
            print(f'Total notifications in database: {len(all_notifications)}')
            
            active_count = 0
            inactive_count = 0
            
            for notif in all_notifications:
                if notif.is_active:
                    active_count += 1
                    print(f'ACTIVE - ID: {notif.id}, Title: {notif.title[:50]}..., Created: {notif.created_at}')
                else:
                    inactive_count += 1
                    print(f'INACTIVE - ID: {notif.id}, Title: {notif.title[:50]}..., Created: {notif.created_at}')
            
            print(f'\nSummary:')
            print(f'Active notifications: {active_count}')
            print(f'Inactive notifications: {inactive_count}')
            
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            break

if __name__ == "__main__":
    asyncio.run(check_notifications())
