"""Update confidence score precision

Revision ID: 009_conf_score_fix
Revises: 1bc71370b7f7
Create Date: 2025-08-03 13:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '009_conf_score_fix'
down_revision = '1bc71370b7f7'
branch_labels = None
depends_on = None


def upgrade():
    """Update confidence_score column to allow larger values."""
    # Change confidence_score from NUMERIC(3,2) to NUMERIC(5,2)
    op.alter_column('attendance_records', 'confidence_score',
                   existing_type=sa.NUMERIC(precision=3, scale=2),
                   type_=sa.NUMERIC(precision=5, scale=2),
                   nullable=True)


def downgrade():
    """Revert confidence_score column to original precision."""
    # Change confidence_score back to NUMERIC(3,2)
    op.alter_column('attendance_records', 'confidence_score',
                   existing_type=sa.NUMERIC(precision=5, scale=2),
                   type_=sa.NUMERIC(precision=3, scale=2),
                   nullable=True)
