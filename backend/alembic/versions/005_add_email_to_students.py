"""Add email column to students table

Revision ID: 005_add_email_to_students
Revises: 004_add_name_to_students
Create Date: 2025-01-13 11:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '005_add_email_to_students'
down_revision = '004_add_name_to_students'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add email column to students table
    op.add_column('students', sa.Column('email', sa.String(), nullable=True))
    
    # Update existing records by copying emails from users table
    op.execute("""
        UPDATE students 
        SET email = users.email
        FROM users 
        WHERE students.user_id = users.id
    """)
    
    # Make the column non-nullable after setting values
    op.alter_column('students', 'email', nullable=False)

def downgrade() -> None:
    # Remove the email column
    op.drop_column('students', 'email')
