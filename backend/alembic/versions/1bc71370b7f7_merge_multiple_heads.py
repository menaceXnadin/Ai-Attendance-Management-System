"""Merge multiple heads

Revision ID: 1bc71370b7f7
Revises: 007_add_simple_relationships, 008_rename_class_name_to_faculty, 70dfc2254e95
Create Date: 2025-07-13 11:00:37.581209

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1bc71370b7f7'
down_revision: Union[str, Sequence[str], None] = ('007_add_simple_relationships', '008_rename_class_name_to_faculty', '70dfc2254e95')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
