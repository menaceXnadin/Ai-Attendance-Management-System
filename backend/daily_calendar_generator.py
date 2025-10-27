"""
Daily Calendar Auto-Generator Script

This script should be run daily (via cron/scheduler) to automatically
generate upcoming class events based on class schedules.

Setup Instructions:

1. Linux/Mac (crontab):
   crontab -e
   Add line: 0 2 * * * cd /path/to/backend && python daily_calendar_generator.py

2. Windows (Task Scheduler):
   - Create new task
   - Trigger: Daily at 2:00 AM
   - Action: python daily_calendar_generator.py

3. Docker/Kubernetes:
   - Use CronJob resource
   - Schedule: "0 2 * * *"

4. Cloud Services:
   - AWS EventBridge / Lambda
   - Google Cloud Scheduler
   - Azure Logic Apps
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.services.calendar_generator import auto_generate_calendar
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('calendar_generator.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


async def run_daily_generation():
    """Run the daily calendar generation"""
    
    logger.info("=" * 60)
    logger.info("Starting Daily Calendar Auto-Generation")
    logger.info("=" * 60)
    
    try:
        async with AsyncSessionLocal() as db:
            # Generate events for next 30 days
            result = await auto_generate_calendar(db, days_ahead=30)
            
            logger.info("✅ Calendar generation completed successfully")
            logger.info(f"📊 Statistics:")
            logger.info(f"   - Total days processed: {result.get('total_days', 0)}")
            logger.info(f"   - Class days: {result.get('class_days', 0)}")
            logger.info(f"   - Holiday days: {result.get('holiday_days', 0)}")
            logger.info(f"   - Events created: {result.get('events_created', 0)}")
            logger.info(f"   - Events skipped (existing): {result.get('events_skipped', 0)}")
            
            if result.get('errors', 0) > 0:
                logger.warning(f"⚠️  Errors encountered: {result['errors']}")
            
            return result
            
    except Exception as e:
        logger.error(f"❌ Error during calendar generation: {str(e)}")
        logger.exception("Full traceback:")
        raise
    
    finally:
        logger.info("=" * 60)
        logger.info("Daily Calendar Generation Complete")
        logger.info("=" * 60)


async def run_cleanup():
    """Optional: Clean up old events (run weekly)"""
    
    logger.info("Running weekly cleanup of old events...")
    
    try:
        async with AsyncSessionLocal() as db:
            from app.services.calendar_generator import CalendarGeneratorService
            
            generator = CalendarGeneratorService(db)
            deleted_count = await generator.cleanup_old_events(days_old=90)
            
            logger.info(f"✅ Cleanup complete: {deleted_count} old events removed")
            
    except Exception as e:
        logger.error(f"❌ Error during cleanup: {str(e)}")


def main():
    """Main entry point"""
    
    import argparse
    
    parser = argparse.ArgumentParser(description="Daily Calendar Auto-Generator")
    parser.add_argument(
        '--cleanup',
        action='store_true',
        help='Also run cleanup of old events'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=30,
        help='Number of days to generate ahead (default: 30)'
    )
    
    args = parser.parse_args()
    
    # Run generation
    result = asyncio.run(run_daily_generation())
    
    # Optionally run cleanup
    if args.cleanup:
        asyncio.run(run_cleanup())
    
    # Exit with appropriate code
    if result.get('errors', 0) > 0:
        logger.warning("Generation completed with errors")
        sys.exit(1)
    else:
        logger.info("Generation completed successfully")
        sys.exit(0)


if __name__ == "__main__":
    main()
