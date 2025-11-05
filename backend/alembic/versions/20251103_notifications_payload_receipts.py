"""
Add payload JSONB to enhanced_notifications; add dismissed_at and unique constraint to notification_read_receipts; add helpful indexes

Revision ID: 20251103_notifications_payload_receipts
Revises: da1b1f0407a1
Create Date: 2025-11-03 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'n20251103_payload_receipts'
down_revision = 'da1b1f0407a1'
branch_labels = None
depends_on = None


def upgrade():
    # Add payload JSONB to enhanced_notifications
    op.add_column('enhanced_notifications', sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # Add dismissed_at to notification_read_receipts
    op.add_column('notification_read_receipts', sa.Column('dismissed_at', sa.DateTime(), nullable=True))

    # Add unique constraint on (notification_id, user_id)
    op.create_unique_constraint('uq_notification_receipt_user', 'notification_read_receipts', ['notification_id', 'user_id'])

    # Indexes to speed queries
    op.create_index('ix_enhanced_notifications_sender_created', 'enhanced_notifications', ['sender_id', 'created_at'], unique=False)
    op.create_index('ix_enhanced_notifications_scope_created', 'enhanced_notifications', ['scope', 'created_at'], unique=False)
    op.create_index('ix_enhanced_notifications_faculty_created', 'enhanced_notifications', ['target_faculty_id', 'created_at'], unique=False)

    # Partial index for active (not dismissed) receipts by user
    op.execute("""
    CREATE INDEX IF NOT EXISTS ix_receipts_user_active
    ON notification_read_receipts (user_id)
    WHERE dismissed_at IS NULL;
    """)

    # Useful composite index for joins/filters
    op.create_index('ix_receipts_user_notification', 'notification_read_receipts', ['user_id', 'notification_id'], unique=False)


def downgrade():
    # Drop composite index
    op.drop_index('ix_receipts_user_notification', table_name='notification_read_receipts')

    # Drop partial index
    op.execute("""
    DROP INDEX IF EXISTS ix_receipts_user_active;
    """)

    # Drop created indexes on notifications
    op.drop_index('ix_enhanced_notifications_faculty_created', table_name='enhanced_notifications')
    op.drop_index('ix_enhanced_notifications_scope_created', table_name='enhanced_notifications')
    op.drop_index('ix_enhanced_notifications_sender_created', table_name='enhanced_notifications')

    # Drop unique constraint
    op.drop_constraint('uq_notification_receipt_user', 'notification_read_receipts', type_='unique')

    # Drop columns
    op.drop_column('notification_read_receipts', 'dismissed_at')
    op.drop_column('enhanced_notifications', 'payload')
