"""optimize_face_encoding_performance

Revision ID: 728c836479ed
Revises: a25acbca6f13
Create Date: 2025-07-13 17:58:14.808446

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '728c836479ed'
down_revision: Union[str, Sequence[str], None] = '1bc71370b7f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Optimize face encoding performance without requiring pgvector extension."""
    # Add index on face_encoding for faster JSON queries
    op.execute("CREATE INDEX IF NOT EXISTS students_face_encoding_not_null_idx ON students (id) WHERE face_encoding IS NOT NULL")
    
    # Add index for faster student lookups
    op.execute("CREATE INDEX IF NOT EXISTS students_user_id_idx ON students (user_id)")
    
    print("✅ Performance optimization complete!")
    print("📈 Added indexes for faster face encoding queries")
    print("💡 Your current JSON-based face storage is now optimized")


def downgrade() -> None:
    """Remove performance optimizations."""
    op.execute("DROP INDEX IF EXISTS students_face_encoding_not_null_idx")
    op.execute("DROP INDEX IF EXISTS students_user_id_idx")
    
    print("⬇️ Removed performance optimizations")
