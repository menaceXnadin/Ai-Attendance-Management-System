"""add_academic_calendar_config

Revision ID: academic_calendar_override
Revises: 
Create Date: 2025-01-31

Adds academic_calendar_config table for admin override of semester boundary dates.
Enables emergency date adjustments for scenarios like COVID-19, natural disasters, etc.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'academic_calendar_override'
down_revision = '7abf5bd23b6a'  # Latest migration: add_event_sessions_tables
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create academic_calendar_config table
    op.create_table(
        'academic_calendar_config',
        sa.Column('id', sa.Integer(), nullable=False),
        
        # Date Boundaries
        sa.Column('fall_start_month', sa.Integer(), nullable=False),
        sa.Column('fall_start_day', sa.Integer(), nullable=False),
        sa.Column('fall_end_month', sa.Integer(), nullable=False),
        sa.Column('fall_end_day', sa.Integer(), nullable=False),
        sa.Column('spring_start_month', sa.Integer(), nullable=False),
        sa.Column('spring_start_day', sa.Integer(), nullable=False),
        sa.Column('spring_end_month', sa.Integer(), nullable=False),
        sa.Column('spring_end_day', sa.Integer(), nullable=False),
        
        # Override Control
        sa.Column('is_override_active', sa.Boolean(), nullable=False, server_default='false'),
        
        # Metadata
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('effective_from', sa.Date(), nullable=False),
        sa.Column('effective_until', sa.Date(), nullable=True),
        
        # Audit Trail
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        
        # Emergency Flag
        sa.Column('is_emergency_override', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('emergency_contact_email', sa.String(255), nullable=True),
        
        # Primary Key
        sa.PrimaryKeyConstraint('id'),
        
        # Foreign Keys
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
        
        # Check Constraints
        sa.CheckConstraint('fall_start_month BETWEEN 1 AND 12', name='valid_fall_start_month'),
        sa.CheckConstraint('fall_end_month BETWEEN 1 AND 12', name='valid_fall_end_month'),
        sa.CheckConstraint('spring_start_month BETWEEN 1 AND 12', name='valid_spring_start_month'),
        sa.CheckConstraint('spring_end_month BETWEEN 1 AND 12', name='valid_spring_end_month'),
        sa.CheckConstraint('fall_start_day BETWEEN 1 AND 31', name='valid_fall_start_day'),
        sa.CheckConstraint('fall_end_day BETWEEN 1 AND 31', name='valid_fall_end_day'),
        sa.CheckConstraint('spring_start_day BETWEEN 1 AND 31', name='valid_spring_start_day'),
        sa.CheckConstraint('spring_end_day BETWEEN 1 AND 31', name='valid_spring_end_day'),
        sa.CheckConstraint('effective_until IS NULL OR effective_until >= effective_from', name='valid_effective_range'),
    )
    
    # Create index on is_override_active for fast lookup
    op.create_index('idx_calendar_override_active', 'academic_calendar_config', ['is_override_active'])
    
    # Create partial unique index to ensure only one active override at a time
    # Note: This uses PostgreSQL-specific syntax
    op.execute("""
        CREATE UNIQUE INDEX idx_single_active_override 
        ON academic_calendar_config (is_override_active) 
        WHERE is_override_active = TRUE
    """)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_single_active_override', table_name='academic_calendar_config')
    op.drop_index('idx_calendar_override_active', table_name='academic_calendar_config')
    
    # Drop table
    op.drop_table('academic_calendar_config')
