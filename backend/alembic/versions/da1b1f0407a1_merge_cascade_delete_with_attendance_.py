"""merge cascade delete with attendance constraints

Revision ID: da1b1f0407a1
Revises: 010_cascade_delete, d81229fc902f
Create Date: 2025-11-02 21:01:39.075677

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da1b1f0407a1'
down_revision: Union[str, Sequence[str], None] = ('010_cascade_delete', 'd81229fc902f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
