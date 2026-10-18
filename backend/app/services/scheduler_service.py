"""Background scheduler (DOMAIN_RULES §7, §13.1, §13.11).

Runs the auto-absent job (session materialization + finalization of held sessions) every
10 minutes, with the first run shortly after startup (not after a full interval). There is no
time-of-day window: the job is idempotent and every "now" decision is made by the job itself
through ``app.core.clock`` (APP_TIMEZONE), never the host's naive local time.

The scheduler starts only when BOTH ``settings.run_scheduler`` (env ``RUN_SCHEDULER``: does this
process run background jobs?) and ``settings.enable_auto_absent_scheduler`` (env
``ENABLE_AUTO_ABSENT_SCHEDULER``: is the job enabled at all?) are true. Running it in several
workers is still safe: each run takes a PostgreSQL advisory lock (Rule §13.11).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from app.core.clock import app_now
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.auto_absent_service import auto_absent_service

logger = logging.getLogger(__name__)


class SchedulerService:
    """Single asyncio task looping over the periodic jobs."""

    def __init__(self) -> None:
        self.task: Optional[asyncio.Task] = None
        self.running = False
        self.enabled = bool(settings.run_scheduler and settings.enable_auto_absent_scheduler)
        self.check_interval_minutes = 10
        self.initial_delay_seconds = 30
        self.last_run_at: Optional[datetime] = None
        self.next_run_at: Optional[datetime] = None
        self.last_result: Optional[dict] = None

    async def start(self) -> None:
        """Start the loop (no-op when disabled or already running). Never raises."""
        try:
            if not self.enabled:
                logger.info(
                    "Background scheduler disabled (RUN_SCHEDULER=%s, ENABLE_AUTO_ABSENT_SCHEDULER=%s)",
                    settings.run_scheduler, settings.enable_auto_absent_scheduler,
                )
                return
            if self.running:
                logger.warning("Scheduler already running")
                return
            self.running = True
            self.next_run_at = app_now() + timedelta(seconds=self.initial_delay_seconds)
            self.task = asyncio.create_task(self._run_scheduler(), name="attendai-scheduler")
            logger.info("Background scheduler started (every %s min, first run in %ss)",
                        self.check_interval_minutes, self.initial_delay_seconds)
        except Exception:  # pragma: no cover - never block application startup
            self.running = False
            logger.exception("Failed to start background scheduler")

    async def stop(self) -> None:
        """Cancel the loop and wait for it. Never raises."""
        if not self.running and self.task is None:
            return
        self.running = False
        task, self.task = self.task, None
        if task is not None:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
        self.next_run_at = None
        logger.info("Background scheduler stopped")

    async def _run_scheduler(self) -> None:
        """Main loop: initial delay, then run every ``check_interval_minutes`` (monotonic)."""
        loop = asyncio.get_running_loop()
        next_tick = loop.time() + self.initial_delay_seconds
        interval = self.check_interval_minutes * 60
        while self.running:
            try:
                await asyncio.sleep(max(0.0, next_tick - loop.time()))
                if not self.running:
                    break
                await self._run_auto_absent_task()
            except asyncio.CancelledError:
                logger.info("Scheduler task cancelled")
                break
            except Exception:
                logger.exception("Error in scheduler loop")  # keep running
            next_tick += interval
            if next_tick < loop.time():  # fell behind (long run / suspend): skip missed ticks
                next_tick = loop.time() + interval
            self.next_run_at = app_now() + timedelta(seconds=max(0.0, next_tick - loop.time()))

    async def _run_auto_absent_task(self) -> None:
        """One auto-absent run on a fresh session (the job commits per session itself)."""
        self.last_run_at = app_now()
        try:
            async with AsyncSessionLocal() as db:
                result = await auto_absent_service.run(db, trigger="scheduler")
            self.last_result = {k: result.get(k) for k in (
                "job_run_id", "skipped", "sessions_materialized", "sessions_finalized", "new_records_created",
                "unrecorded_sessions")}
            if result.get("skipped"):
                logger.info("Auto-absent run skipped: %s", result["skipped"])
            else:
                logger.info("Auto-absent run: %s", result.get("message"))
        except Exception:
            logger.exception("Error running auto-absent task")


# Singleton instance
scheduler_service = SchedulerService()
