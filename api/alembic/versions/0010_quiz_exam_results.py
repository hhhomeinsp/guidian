"""quiz attempt_number + exam_attempts

Revision ID: 0010_quiz_exam
Revises: 0009_lesson_progress
Create Date: 2026-04-30

Adds `attempt_number` to `quiz_attempts` and creates `exam_attempts` for
final-exam scoring. Idempotent — uses CREATE TABLE IF NOT EXISTS / ALTER
ADD COLUMN IF NOT EXISTS so it is safe to re-run on environments where
the prior schema already exists.
"""
from alembic import op


revision = "0010_quiz_exam"
down_revision = "0009_lesson_progress"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- quiz_attempts: add attempt_number ---
    op.execute(
        "ALTER TABLE quiz_attempts "
        "ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_quiz_attempts_user_lesson "
        "ON quiz_attempts (user_id, lesson_id)"
    )

    # --- exam_attempts ---
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS exam_attempts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            score_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            answers JSONB NOT NULL DEFAULT '{}'::jsonb,
            questions JSONB NOT NULL DEFAULT '[]'::jsonb,
            passed BOOLEAN NOT NULL DEFAULT FALSE,
            attempt_number INTEGER NOT NULL DEFAULT 1,
            time_spent_ms BIGINT NOT NULL DEFAULT 0,
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_exam_attempts_user_course "
        "ON exam_attempts (user_id, course_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_exam_attempts_user_course")
    op.execute("DROP TABLE IF EXISTS exam_attempts")
    op.execute("DROP INDEX IF EXISTS ix_quiz_attempts_user_lesson")
    op.execute("ALTER TABLE quiz_attempts DROP COLUMN IF EXISTS attempt_number")
