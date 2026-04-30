"""waitlist_entries

Revision ID: 0012_waitlist
Revises: 0011_course_purchases
Create Date: 2026-04-30

Adds the `waitlist_entries` table backing the home inspector state
eligibility checker. Idempotent — uses CREATE TABLE IF NOT EXISTS so it
is safe to re-run.
"""
from alembic import op


revision = "0012_waitlist"
down_revision = "0011_course_purchases"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS waitlist_entries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(320) NOT NULL,
            state_code VARCHAR(2) NOT NULL,
            course_slug VARCHAR(128) NOT NULL,
            notified_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_waitlist_email_state_course UNIQUE (email, state_code, course_slug)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_waitlist_email "
        "ON waitlist_entries (email)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_waitlist_state_course "
        "ON waitlist_entries (state_code, course_slug)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_waitlist_state_course")
    op.execute("DROP INDEX IF EXISTS ix_waitlist_email")
    op.execute("DROP TABLE IF EXISTS waitlist_entries")
