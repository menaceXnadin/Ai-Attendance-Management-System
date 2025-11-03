"""add_faculty_code_column

Revision ID: 147a31fb2d67
Revises: academic_calendar_override
Create Date: 2025-11-01 01:12:23.299360

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '147a31fb2d67'
down_revision: Union[str, Sequence[str], None] = 'academic_calendar_override'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add faculty_code column
    op.add_column('faculties', sa.Column('code', sa.String(length=50), nullable=True))
    op.create_unique_constraint('uq_faculties_code', 'faculties', ['code'])


def downgrade() -> None:
    """Downgrade schema."""
    # Remove faculty_code column
    op.drop_constraint('uq_faculties_code', 'faculties', type_='unique')
    op.drop_column('faculties', 'code')
