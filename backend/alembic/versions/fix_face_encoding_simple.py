"""fix face encoding column type to json

Revision ID: fix_face_encoding_simple
Revises: 1bc71370b7f7
Create Date: 2025-07-14 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'fix_face_encoding_simple'
down_revision = '1bc71370b7f7'
branch_labels = None
depends_on = None

def upgrade():
    """Fix face_encoding column to be JSON type"""
    # Drop the existing column and recreate it as JSON
    op.drop_column('students', 'face_encoding')
    op.add_column('students', sa.Column('face_encoding', sa.JSON(), nullable=True))

def downgrade():
    """Revert face_encoding column back to BYTEA"""
    op.alter_column('students', 'face_encoding',
                   existing_type=sa.JSON(),
                   type_=sa.LargeBinary(),
                   existing_nullable=True)
