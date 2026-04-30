"""course_purchases + subscriptions.nova_enabled

Revision ID: 0011_course_purchases
Revises: 0010_quiz_exam
Create Date: 2026-04-30

Adds `course_purchases` table for per-course one-time Stripe payments and
the `nova_enabled` boolean on `subscriptions` to gate the Nova voice AI
feature behind the Pro plan. Idempotent — uses CREATE TABLE IF NOT EXISTS
and ALTER TABLE ... ADD COLUMN IF NOT EXISTS so it is safe to re-run.
"""
from alembic import op


revision = "0011_course_purchases"
down_revision = "0010_quiz_exam"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS course_purchases (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            stripe_payment_intent_id TEXT,
            stripe_checkout_session_id TEXT,
            amount_cents INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_course_purchase_user_course UNIQUE (user_id, course_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_course_purchases_user_status "
        "ON course_purchases (user_id, status)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_course_purchases_session "
        "ON course_purchases (stripe_checkout_session_id)"
    )

    op.execute(
        "ALTER TABLE subscriptions "
        "ADD COLUMN IF NOT EXISTS nova_enabled BOOLEAN NOT NULL DEFAULT FALSE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE subscriptions DROP COLUMN IF EXISTS nova_enabled")
    op.execute("DROP INDEX IF EXISTS ix_course_purchases_session")
    op.execute("DROP INDEX IF EXISTS ix_course_purchases_user_status")
    op.execute("DROP TABLE IF EXISTS course_purchases")
