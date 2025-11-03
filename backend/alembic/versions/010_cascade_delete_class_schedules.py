"""Add CASCADE DELETE to class_schedules foreign keys

Revision ID: 010_cascade_delete
Revises: 009_conf_score_fix
Create Date: 2025-11-02 14:30:00.000000

This migration ensures that when a faculty or subject is deleted,
all associated class schedules are automatically deleted (CASCADE)
instead of trying to set the FK to NULL (which would violate NOT NULL).

Also adds missing columns to ai_insights table:
- confidence (DOUBLE PRECISION)
- is_active (BOOLEAN)

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '010_cascade_delete'
down_revision = '009_conf_score_fix'
branch_labels = None
depends_on = None


def upgrade():
    """
    1. Update class_schedules FK constraints to CASCADE on delete
    2. Add missing ai_insights columns (if not already present)
    """
    
    # First, handle class_schedules constraints
    # We need to use execute() to run raw SQL because Alembic doesn't have
    # a clean way to modify existing FK cascade behavior
    
    conn = op.get_bind()
    
    # Drop and recreate FK to faculties with CASCADE
    conn.execute(sa.text("""
        DO $$
        DECLARE
            conname_var text;
        BEGIN
            SELECT con.conname INTO conname_var
            FROM pg_constraint con
            WHERE conrelid = 'class_schedules'::regclass
              AND confrelid = 'faculties'::regclass
              AND contype = 'f';

            IF conname_var IS NOT NULL THEN
                EXECUTE format('ALTER TABLE class_schedules DROP CONSTRAINT %I', conname_var);
            END IF;

            EXECUTE 'ALTER TABLE class_schedules
                     ADD CONSTRAINT fk_class_schedules_faculty
                     FOREIGN KEY (faculty_id)
                     REFERENCES faculties(id)
                     ON DELETE CASCADE';
        END $$;
    """))
    
    # Drop and recreate FK to subjects with CASCADE
    conn.execute(sa.text("""
        DO $$
        DECLARE
            conname_var text;
        BEGIN
            SELECT con.conname INTO conname_var
            FROM pg_constraint con
            WHERE conrelid = 'class_schedules'::regclass
              AND confrelid = 'subjects'::regclass
              AND contype = 'f';

            IF conname_var IS NOT NULL THEN
                EXECUTE format('ALTER TABLE class_schedules DROP CONSTRAINT %I', conname_var);
            END IF;

            EXECUTE 'ALTER TABLE class_schedules
                     ADD CONSTRAINT fk_class_schedules_subject
                     FOREIGN KEY (subject_id)
                     REFERENCES subjects(id)
                     ON DELETE CASCADE';
        END $$;
    """))
    
    # Add missing ai_insights columns if they don't exist
    conn.execute(sa.text("""
        DO $$
        BEGIN
            -- Add confidence column if missing
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'ai_insights' AND column_name = 'confidence'
            ) THEN
                ALTER TABLE ai_insights ADD COLUMN confidence DOUBLE PRECISION;
            END IF;
            
            -- Add is_active column if missing
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'ai_insights' AND column_name = 'is_active'
            ) THEN
                ALTER TABLE ai_insights ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
            END IF;
        END $$;
    """))


def downgrade():
    """
    Revert CASCADE behavior back to default (RESTRICT/NO ACTION)
    and remove added ai_insights columns
    """
    
    conn = op.get_bind()
    
    # Revert class_schedules FK to faculties (remove CASCADE)
    conn.execute(sa.text("""
        DO $$
        DECLARE
            conname_var text;
        BEGIN
            SELECT con.conname INTO conname_var
            FROM pg_constraint con
            WHERE conrelid = 'class_schedules'::regclass
              AND confrelid = 'faculties'::regclass
              AND contype = 'f';

            IF conname_var IS NOT NULL THEN
                EXECUTE format('ALTER TABLE class_schedules DROP CONSTRAINT %I', conname_var);
            END IF;

            EXECUTE 'ALTER TABLE class_schedules
                     ADD CONSTRAINT class_schedules_faculty_id_fkey
                     FOREIGN KEY (faculty_id)
                     REFERENCES faculties(id)';
        END $$;
    """))
    
    # Revert class_schedules FK to subjects (remove CASCADE)
    conn.execute(sa.text("""
        DO $$
        DECLARE
            conname_var text;
        BEGIN
            SELECT con.conname INTO conname_var
            FROM pg_constraint con
            WHERE conrelid = 'class_schedules'::regclass
              AND confrelid = 'subjects'::regclass
              AND contype = 'f';

            IF conname_var IS NOT NULL THEN
                EXECUTE format('ALTER TABLE class_schedules DROP CONSTRAINT %I', conname_var);
            END IF;

            EXECUTE 'ALTER TABLE class_schedules
                     ADD CONSTRAINT class_schedules_subject_id_fkey
                     FOREIGN KEY (subject_id)
                     REFERENCES subjects(id)';
        END $$;
    """))
    
    # Drop ai_insights columns
    conn.execute(sa.text("""
        DO $$
        BEGIN
            -- Drop confidence column if exists
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'ai_insights' AND column_name = 'confidence'
            ) THEN
                ALTER TABLE ai_insights DROP COLUMN confidence;
            END IF;
            
            -- Drop is_active column if exists
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'ai_insights' AND column_name = 'is_active'
            ) THEN
                ALTER TABLE ai_insights DROP COLUMN is_active;
            END IF;
        END $$;
    """))
