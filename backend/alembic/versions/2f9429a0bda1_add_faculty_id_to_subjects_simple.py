"""add_faculty_id_to_subjects_simple

Revision ID: 2f9429a0bda1
Revises: cf461bb9abb2
Create Date: 2025-07-24 23:50:07.931923

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2f9429a0bda1'
down_revision: Union[str, Sequence[str], None] = '5b46aee9f484'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add faculty_id column to subjects table
    op.add_column('subjects', sa.Column('faculty_id', sa.Integer(), nullable=True))
    # Add foreign key constraint
    op.create_foreign_key('fk_subjects_faculty', 'subjects', 'faculties', ['faculty_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Remove foreign key constraint
    op.drop_constraint('fk_subjects_faculty', 'subjects', type_='foreignkey')
    # Remove faculty_id column
    op.drop_column('subjects', 'faculty_id')
