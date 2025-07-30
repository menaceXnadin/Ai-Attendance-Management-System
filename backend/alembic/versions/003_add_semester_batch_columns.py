"""Add semester and batch columns to students table

Revision ID: 003_add_semester_batch_columns
Revises: 002_add_subjects_table
Create Date: 2025-01-13 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '003_add_semester_batch_columns'
down_revision = '002'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add new columns
    op.add_column('students', sa.Column('semester', sa.Integer(), nullable=True, default=1))
    op.add_column('students', sa.Column('batch', sa.Integer(), nullable=True))
    
    # Update existing records with default values
    # Set semester = year * 2 - 1 (convert existing year to semester)
    # Set batch = current year - year + 2025 (estimate based on current year)
    current_year = datetime.now().year
    op.execute(f"""
        UPDATE students 
        SET semester = CASE 
            WHEN year = 1 THEN 1
            WHEN year = 2 THEN 3
            WHEN year = 3 THEN 5
            WHEN year = 4 THEN 7
            ELSE 1
        END,
        batch = {current_year} - year + 1
        WHERE semester IS NULL OR batch IS NULL
    """)
    
    # Make columns non-nullable after setting default values
    op.alter_column('students', 'semester', nullable=False)
    op.alter_column('students', 'batch', nullable=False)

def downgrade() -> None:
    # Remove the new columns
    op.drop_column('students', 'batch')
    op.drop_column('students', 'semester')
