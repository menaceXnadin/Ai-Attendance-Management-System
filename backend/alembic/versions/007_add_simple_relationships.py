"""Add simple relationships and new tables

Revision ID: 007_add_simple_relationships
Revises: 006_remove_redundant_fields
Create Date: 2025-07-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '007_add_simple_relationships'
down_revision: Union[str, Sequence[str], None] = '006_remove_redundant_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add new tables and simple relationships."""
    
    # Create notifications table (skipped, already exists)
    # op.create_table('notifications',
    #     sa.Column('id', sa.Integer(), nullable=False),
    #     sa.Column('user_id', sa.Integer(), nullable=False),
    #     sa.Column('title', sa.String(), nullable=False),
    #     sa.Column('message', sa.Text(), nullable=False),
    #     sa.Column('type', sa.String(), nullable=False),
    #     sa.Column('is_read', sa.Boolean(), nullable=True, default=False),
    #     sa.Column('action_url', sa.String(), nullable=True),
    #     sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    #     sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    #     sa.PrimaryKeyConstraint('id')
    # )
    # op.create_index(op.f('ix_notifications_id'), 'notifications', ['id'], unique=False)
    
    # Create marks table
    op.create_table('marks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('subject_id', sa.Integer(), nullable=False),
        sa.Column('exam_type', sa.String(), nullable=False),
        sa.Column('marks_obtained', sa.Float(), nullable=False),
        sa.Column('total_marks', sa.Float(), nullable=False),
        sa.Column('grade', sa.String(), nullable=True),
        sa.Column('exam_date', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_marks_id'), 'marks', ['id'], unique=False)
    
    # Add admin_id to admins table
    op.add_column('admins', sa.Column('admin_id', sa.String(), nullable=True))
    op.execute("UPDATE admins SET admin_id = 'ADMIN' || LPAD(id::text, 4, '0')")
    op.alter_column('admins', 'admin_id', nullable=False)
    op.create_index(op.f('ix_admins_admin_id'), 'admins', ['admin_id'], unique=True)
    
    # Add subject_id to attendance_records (optional relationship)
    op.add_column('attendance_records', sa.Column('subject_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_attendance_subject', 'attendance_records', 'subjects', ['subject_id'], ['id'])
    
    # Add updated_at to subjects table
    op.add_column('subjects', sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True))
    
    # Ensure proper foreign key constraints are in place
    # These might already exist, but adding them ensures consistency
    try:
        op.create_foreign_key('fk_students_user', 'students', 'users', ['user_id'], ['id'])
    except:
        pass  # FK might already exist
        
    try:
        op.create_foreign_key('fk_admins_user', 'admins', 'users', ['user_id'], ['id'])
    except:
        pass  # FK might already exist


def downgrade() -> None:
    """Downgrade schema."""
    
    # Remove foreign keys
    op.drop_constraint('fk_attendance_subject', 'attendance_records', type_='foreignkey')
    op.drop_constraint('fk_students_user', 'students', type_='foreignkey')
    op.drop_constraint('fk_admins_user', 'admins', type_='foreignkey')
    
    # Remove added columns
    op.drop_column('attendance_records', 'subject_id')
    op.drop_column('subjects', 'updated_at')
    op.drop_index(op.f('ix_admins_admin_id'), table_name='admins')
    op.drop_column('admins', 'admin_id')
    
    # Drop new tables
    op.drop_index(op.f('ix_marks_id'), table_name='marks')
    op.drop_table('marks')
    op.drop_index(op.f('ix_notifications_id'), table_name='notifications')
    op.drop_table('notifications')
