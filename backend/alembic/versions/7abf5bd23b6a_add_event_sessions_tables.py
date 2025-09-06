"""add_event_sessions_tables

Revision ID: 7abf5bd23b6a
Revises: 62c94b0a8ac1
Create Date: 2025-09-03 15:39:45.700095

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7abf5bd23b6a'
down_revision: Union[str, Sequence[str], None] = '62c94b0a8ac1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create event_sessions table
    op.create_table(
        'event_sessions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('parent_event_id', sa.Integer(), sa.ForeignKey('academic_events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('start_time', sa.String(5), nullable=False),  # HH:MM format
        sa.Column('end_time', sa.String(5), nullable=False),    # HH:MM format
        sa.Column('session_type', sa.String(50), nullable=True),
        sa.Column('presenter', sa.String(100), nullable=True),
        sa.Column('location', sa.String(100), nullable=True),
        sa.Column('color_code', sa.String(7), nullable=True),
        sa.Column('display_order', sa.Integer(), default=0),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('attendance_required', sa.Boolean(), default=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    
    # Create session_attendance table
    op.create_table(
        'session_attendance',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('event_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.String(20), default='pending'),  # pending, present, absent, excused
        sa.Column('participation_score', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('marked_at', sa.DateTime(), nullable=True),
        sa.Column('marked_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.UniqueConstraint('session_id', 'student_id', name='uq_session_student_attendance'),
    )
    
    # Create indices for better performance
    op.create_index('idx_event_sessions_parent_event', 'event_sessions', ['parent_event_id'])
    op.create_index('idx_event_sessions_active', 'event_sessions', ['is_active'])
    op.create_index('idx_session_attendance_session', 'session_attendance', ['session_id'])
    op.create_index('idx_session_attendance_student', 'session_attendance', ['student_id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indices
    op.drop_index('idx_session_attendance_student', 'session_attendance')
    op.drop_index('idx_session_attendance_session', 'session_attendance')
    op.drop_index('idx_event_sessions_active', 'event_sessions')
    op.drop_index('idx_event_sessions_parent_event', 'event_sessions')
    
    # Drop tables
    op.drop_table('session_attendance')
    op.drop_table('event_sessions')
