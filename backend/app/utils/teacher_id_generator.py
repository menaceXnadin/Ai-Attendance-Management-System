"""
Teacher ID Auto-Generation Utility
Generates unique teacher IDs
Default Format: TCHR{YEAR}{SEQUENCE}
Example: TCHR2025001

If a faculty is provided, you can optionally include faculty code in the
future; for now we keep a short, faculty-agnostic format.
"""
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Teacher, Faculty
import logging
import asyncio
import random

logger = logging.getLogger(__name__)


async def generate_teacher_id(db: AsyncSession, faculty_id: int | None = None, max_retries: int = 10) -> str:
    """
    Generate a unique teacher ID with race condition protection.

    Format: TCHR{YEAR}{SEQUENCE}
    - YEAR: Current year (4 digits)
    - SEQUENCE: 3-digit sequential number (001, 002, ...)

    Uses row-level locking and retry mechanism to handle concurrent requests.

    Args:
        db: Async DB session
        faculty_id: Optional faculty id (reserved for future patterns)
        max_retries: Maximum number of retry attempts (default: 10)

    Returns:
        Unique teacher ID string

    Raises:
        RuntimeError: If unable to generate unique ID after max_retries
    """
    year = datetime.now().year
    prefix = "TCHR"

    for attempt in range(max_retries):
        try:
            # Use FOR UPDATE to lock rows and prevent race conditions
            pattern = f"{prefix}{year}%"
            result = await db.execute(
                select(Teacher.teacher_id)
                .where(Teacher.teacher_id.like(pattern))
                .order_by(Teacher.teacher_id.desc())
                .limit(1)
                .with_for_update(skip_locked=True)  # Skip locked rows, don't wait
            )
            last_id = result.scalar_one_or_none()

            if last_id:
                try:
                    last_seq = int(last_id[-3:])
                    next_seq = last_seq + 1
                except Exception:
                    next_seq = 1
            else:
                next_seq = 1

            new_id = f"{prefix}{year}{next_seq:03d}"

            # Double-check uniqueness (belt and suspenders approach)
            check = await db.execute(
                select(func.count(Teacher.id))
                .where(Teacher.teacher_id == new_id)
            )
            count = check.scalar()
            
            if count == 0:
                logger.info(f"Generated teacher ID: {new_id} (attempt {attempt + 1})")
                return new_id
            else:
                logger.warning(f"Teacher ID {new_id} already exists, retrying... (attempt {attempt + 1})")
                
        except Exception as e:
            logger.warning(f"Attempt {attempt + 1} failed: {e}")
        
        # Exponential backoff with jitter to reduce collision probability
        if attempt < max_retries - 1:
            delay = (0.1 * (2 ** attempt)) + (random.random() * 0.1)
            await asyncio.sleep(delay)
    
    # If all retries failed, raise an error
    raise RuntimeError(
        f"Failed to generate unique teacher ID after {max_retries} attempts. "
        f"This may indicate high concurrent load or a system issue."
    )
