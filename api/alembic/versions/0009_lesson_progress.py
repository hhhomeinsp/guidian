"""compliance timer fields on lesson_progress

Revision ID: 0009_lesson_progress
Revises: 0007_teacher_billing
Create Date: 2026-04-30

Adds slide-level compliance tracking columns to lesson_progress.
The base table was created in 0001_initial; here we ensure the
columns required by the slide-gating timer exist. Idempotent — safe
to re-run.
"""
from alembic import op


revision = "0009_lesson_progress"
down_revision = "0007_teacher_billing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS lesson_progress (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
            slides_visited JSONB NOT NULL DEFAULT '[]'::jsonb,
            time_spent_ms BIGINT NOT NULL DEFAULT 0,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_lesson_progress_user_lesson UNIQUE (user_id, lesson_id)
        )
        """
    )

    op.execute(
        "ALTER TABLE lesson_progress "
        "ADD COLUMN IF NOT EXISTS slides_visited JSONB NOT NULL DEFAULT '[]'::jsonb"
    )
    op.execute(
        "ALTER TABLE lesson_progress "
        "ADD COLUMN IF NOT EXISTS time_spent_ms BIGINT NOT NULL DEFAULT 0"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_lesson_progress_user_lesson "
        "ON lesson_progress (user_id, lesson_id)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE lesson_progress DROP COLUMN IF EXISTS time_spent_ms")
    op.execute("ALTER TABLE lesson_progress DROP COLUMN IF EXISTS slides_visited")
    op.execute("DROP INDEX IF EXISTS ix_lesson_progress_user_lesson")
