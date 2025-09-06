"""Merge all migration heads

Revision ID: cda27163e2ec
Revises: 009_conf_score_fix, 009_update_confidence_score_precision, 72ccacd67914, add_name_to_admins
Create Date: 2025-09-03 15:33:25.501071

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cda27163e2ec'
down_revision: Union[str, Sequence[str], None] = ('009_conf_score_fix', '009_update_confidence_score_precision', '72ccacd67914', 'add_name_to_admins')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
