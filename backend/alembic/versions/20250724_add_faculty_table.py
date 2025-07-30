"""Add faculty table and link students to faculty by foreign key

Revision ID: 20250724_add_faculty_table
Revises: 
Create Date: 2025-01-24 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '20250724_add_faculty_table'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create faculties table
    op.create_table('faculties',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_faculties_id'), 'faculties', ['id'], unique=False)
    
    # Add faculty_id column to students table
    op.add_column('students', sa.Column('faculty_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'students', 'faculties', ['faculty_id'], ['id'])

def downgrade():
    # Remove foreign key and faculty_id column from students
    op.drop_constraint(None, 'students', type_='foreignkey')
    op.drop_column('students', 'faculty_id')
    
    # Drop faculties table
    op.drop_index(op.f('ix_faculties_id'), table_name='faculties')
    op.drop_table('faculties')
