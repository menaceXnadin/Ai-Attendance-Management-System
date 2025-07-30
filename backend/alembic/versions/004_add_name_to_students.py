"""Add name column to students table

Revision ID: 004_add_name_to_students
Revises: 003_add_semester_batch_columns
Create Date: 2025-01-13 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '004_add_name_to_students'
down_revision = '003_add_semester_batch_columns'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add name column to students table
    op.add_column('students', sa.Column('name', sa.String(), nullable=True))
    
    # Update existing records by copying names from users table
    op.execute("""
        UPDATE students 
        SET name = users.full_name
        FROM users 
        WHERE students.user_id = users.id
    """)
    
    # Make the column non-nullable after setting values
    op.alter_column('students', 'name', nullable=False)

def downgrade() -> None:
    # Remove the name column
    op.drop_column('students', 'name')
