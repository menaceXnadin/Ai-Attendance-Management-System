"""empty message

Revision ID: 5b46aee9f484
Revises: 20250724_add_faculty_table, 8517f9e59128
Create Date: 2025-07-24 22:04:28.185679

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b46aee9f484'
down_revision: Union[str, Sequence[str], None] = ('20250724_add_faculty_table', '8517f9e59128')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
