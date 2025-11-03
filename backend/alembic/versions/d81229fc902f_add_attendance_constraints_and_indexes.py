"""add_attendance_constraints_and_indexes

Revision ID: d81229fc902f
Revises: 147a31fb2d67
Create Date: 2025-11-01 21:33:41.429922

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd81229fc902f'
down_revision: Union[str, Sequence[str], None] = '147a31fb2d67'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add database-level protections for attendance_records table:
    1. UNIQUE constraint on (student_id, subject_id, date) - prevents duplicates
    2. NOT NULL constraint on subject_id - prevents NULL values
    3. Performance indexes for efficient queries
    
    These protections prevent the bugs fixed in November 2025:
    - Cross-faculty contamination (Oct 29, 2025)
    - Duplicate attendance records (464 sets, 899 total)
    - NULL subject_id records (541 legacy records)
    """
    
    # 1. Add UNIQUE constraint to prevent duplicate attendance records
    # Ensures one attendance record per student per subject per day
    op.create_unique_constraint(
        'unique_attendance_student_subject_date',
        'attendance_records',
        ['student_id', 'subject_id', 'date']
    )
    
    # 2. Add NOT NULL constraint to subject_id
    # Prevents incomplete records (NULL subject_id bypasses unique constraint)
    op.alter_column(
        'attendance_records',
        'subject_id',
        existing_type=sa.Integer(),
        nullable=False
    )
    
    # 3. Add performance indexes
    # Speeds up common queries in auto-absent service and reporting
    op.create_index(
        'idx_attendance_student_date',
        'attendance_records',
        ['student_id', 'date']
    )
    
    # Partial index for location-based queries (auto-absent uses 'AUTO_ABSENT')
    op.execute("""
        CREATE INDEX idx_attendance_location 
        ON attendance_records (location) 
        WHERE location = 'AUTO_ABSENT'
    """)


def downgrade() -> None:
    """Remove attendance constraints and indexes."""
    
    # Remove indexes (in reverse order)
    op.execute("DROP INDEX IF EXISTS idx_attendance_location")
    op.drop_index('idx_attendance_student_date', table_name='attendance_records')
    
    # Remove NOT NULL constraint
    op.alter_column(
        'attendance_records',
        'subject_id',
        existing_type=sa.Integer(),
        nullable=True
    )
    
    # Remove UNIQUE constraint
    op.drop_constraint(
        'unique_attendance_student_subject_date',
        'attendance_records',
        type_='unique'
    )
