"""Add name column to admins table

Revision ID: add_name_to_admins
Revises: 
Create Date: 2025-07-27 06:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_name_to_admins'
down_revision = None  # This will be updated automatically by Alembic
branch_labels = None
depends_on = None

def upgrade() -> None:
    """Add name column to admins table and populate from users table"""
    # Add name column to admins table (nullable initially)
    op.add_column('admins', sa.Column('name', sa.String(), nullable=True))
    
    # Update existing records by copying names from users table
    op.execute("""
        UPDATE admins 
        SET name = users.full_name
        FROM users 
        WHERE admins.user_id = users.id
    """)
    
    # Make the column non-nullable after setting values
    op.alter_column('admins', 'name', nullable=False)

def downgrade() -> None:
    """Remove the name column from admins table"""
    op.drop_column('admins', 'name')
