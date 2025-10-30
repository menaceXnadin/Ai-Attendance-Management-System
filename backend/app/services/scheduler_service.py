"""
Background Scheduler Service for Attendance Management System

This service runs periodic tasks in the background:
- Auto-absent processing every 30 minutes during class hours
- Can be extended for other periodic tasks

Set ENABLE_AUTO_ABSENT_SCHEDULER=false in .env to disable for development
"""

import asyncio
import logging
import os
from datetime import datetime, time
from typing import Optional
from contextlib import asynccontextmanager

from app.core.database import AsyncSessionLocal
from app.services.auto_absent_service import auto_absent_service

logger = logging.getLogger(__name__)

class SchedulerService:
    """Service to run periodic background tasks"""
    
    def __init__(self):
        self.task: Optional[asyncio.Task] = None
        self.running = False
        
        # Check if scheduler is enabled (default: disabled for development)
        self.enabled = os.getenv("ENABLE_AUTO_ABSENT_SCHEDULER", "false").lower() == "true"
        
        # Configure when to run auto-absent (during typical class hours)
        self.start_time = time(7, 0)   # 7:00 AM
        self.end_time = time(20, 0)    # 8:00 PM
        self.check_interval_minutes = 30  # Check every 30 minutes
        
    async def start(self):
        """Start the background scheduler"""
        if not self.enabled:
            logger.info("⏸️  Auto-absent scheduler is DISABLED (set ENABLE_AUTO_ABSENT_SCHEDULER=true to enable)")
            return
            
        if self.running:
            logger.warning("Scheduler already running")
            return
            
        self.running = True
        self.task = asyncio.create_task(self._run_scheduler())
        logger.info("✅ Background scheduler started successfully")
        
    async def stop(self):
        """Stop the background scheduler"""
        if not self.running:
            return
            
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("🛑 Background scheduler stopped")
        
    async def _run_scheduler(self):
        """Main scheduler loop"""
        logger.info(f"🔄 Scheduler running (checking every {self.check_interval_minutes} min, active {self.start_time}-{self.end_time})")
        
        while self.running:
            try:
                await asyncio.sleep(self.check_interval_minutes * 60)  # Convert to seconds
                
                # Check if we're in active hours
                current_time = datetime.now().time()
                if self.start_time <= current_time <= self.end_time:
                    await self._run_auto_absent_task()
                else:
                    logger.debug(f"Outside active hours ({current_time}), skipping auto-absent")
                    
            except asyncio.CancelledError:
                logger.info("Scheduler task cancelled")
                break
            except Exception as e:
                logger.error(f"Error in scheduler loop: {str(e)}", exc_info=True)
                # Continue running even if one iteration fails
                
    async def _run_auto_absent_task(self):
        """Run the auto-absent processing task"""
        try:
            logger.info("⏰ Running scheduled auto-absent processing...")
            
            # Create a new database session for this task
            async with AsyncSessionLocal() as db:
                result = await auto_absent_service.process_auto_absent_for_today(db)
                
                if result["success"]:
                    logger.info(
                        f"✅ Auto-absent completed: {result['new_records_created']} records, "
                        f"{result['students_marked_absent']} students affected"
                    )
                else:
                    logger.warning("⚠️ Auto-absent processing returned unsuccessful status")
                    
        except Exception as e:
            logger.error(f"❌ Error running auto-absent task: {str(e)}", exc_info=True)

# Singleton instance
scheduler_service = SchedulerService()
