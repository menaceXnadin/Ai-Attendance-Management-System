"""Add EventSession and SessionAttendance tables

Revision ID: 62c94b0a8ac1
Revises: cda27163e2ec
Create Date: 2025-09-03 15:33:53.974282

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '62c94b0a8ac1'
down_revision: Union[str, Sequence[str], None] = 'cda27163e2ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
