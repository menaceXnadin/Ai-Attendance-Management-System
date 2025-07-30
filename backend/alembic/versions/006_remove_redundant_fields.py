"""Remove redundant name and email columns from students table

Revision ID: 006_remove_redundant_fields
Revises: 005_add_email_to_students
Create Date: 2025-01-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '006_remove_redundant_fields'
down_revision = '005_add_email_to_students'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Remove redundant name and email columns from students table
    # Data is already in users table, no need to duplicate
    op.drop_column('students', 'name')
    op.drop_column('students', 'email')

def downgrade() -> None:
    # Add the columns back if needed
    op.add_column('students', sa.Column('name', sa.String(), nullable=True))
    op.add_column('students', sa.Column('email', sa.String(), nullable=True))
