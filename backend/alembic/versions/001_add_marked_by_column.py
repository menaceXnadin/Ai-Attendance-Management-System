"""Add marked_by column to attendance_records

Revision ID: 001
Revises: 
Create Date: 2025-07-11 06:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add marked_by column to attendance_records table."""
    # Check if column already exists before adding it
    op.add_column('attendance_records', sa.Column('marked_by', sa.Integer(), nullable=True))
    
    # Add foreign key constraint to users table
    op.create_foreign_key(
        'fk_attendance_marked_by_user',
        'attendance_records', 
        'users',
        ['marked_by'], 
        ['id']
    )


def downgrade() -> None:
    """Remove marked_by column from attendance_records table."""
    # Drop foreign key constraint first
    op.drop_constraint('fk_attendance_marked_by_user', 'attendance_records', type_='foreignkey')
    
    # Drop the column
    op.drop_column('attendance_records', 'marked_by')
