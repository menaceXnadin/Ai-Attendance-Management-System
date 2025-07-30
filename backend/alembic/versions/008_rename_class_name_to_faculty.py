"""
Alembic migration to rename 'class_name' column to 'faculty' in students table.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008_rename_class_name_to_faculty'
down_revision = None  # Set this to the latest migration revision
branch_labels = None
depends_on = None

def upgrade():
    op.alter_column('students', 'class_name', new_column_name='faculty', existing_type=sa.String(), nullable=False)

def downgrade():
    op.alter_column('students', 'faculty', new_column_name='class_name', existing_type=sa.String(), nullable=False)
