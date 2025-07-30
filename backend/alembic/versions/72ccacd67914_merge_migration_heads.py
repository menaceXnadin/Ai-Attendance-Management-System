"""Merge migration heads

Revision ID: 72ccacd67914
Revises: 2f9429a0bda1, cf461bb9abb2
Create Date: 2025-07-25 13:35:50.357059

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '72ccacd67914'
down_revision: Union[str, Sequence[str], None] = ('2f9429a0bda1', 'cf461bb9abb2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
