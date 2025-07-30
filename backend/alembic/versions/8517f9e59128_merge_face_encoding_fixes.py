"""merge face encoding fixes

Revision ID: 8517f9e59128
Revises: 728c836479ed, fix_face_encoding_simple
Create Date: 2025-07-14 17:20:24.836587

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8517f9e59128'
down_revision: Union[str, Sequence[str], None] = ('728c836479ed', 'fix_face_encoding_simple')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
