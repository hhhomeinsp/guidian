"""add learner_memories, teacher_sessions, subscriptions

Revision ID: 0007_teacher_billing
Revises: 0006_seed_opp_compliance
Create Date: 2026-04-28

"""
from alembic import op

revision = "0007_teacher_billing"
down_revision = "0006_seed_opp_compliance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS learner_memories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            profession VARCHAR(128),
            license_state VARCHAR(4),
            license_type VARCHAR(64),
            renewal_deadline TIMESTAMPTZ,
            long_term_summary TEXT,
            session_notes TEXT,
            strengths TEXT[] NOT NULL DEFAULT '{}',
            struggle_areas TEXT[] NOT NULL DEFAULT '{}',
            learning_goals TEXT,
            personality_notes TEXT,
            onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
            vark_style VARCHAR(16),
            total_sessions INTEGER NOT NULL DEFAULT 0,
            last_session_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_learner_memory_user UNIQUE (user_id)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS teacher_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            messages JSONB NOT NULL DEFAULT '[]',
            session_summary TEXT,
            session_type VARCHAR(32) NOT NULL DEFAULT 'chat',
            course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
            tokens_used INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            stripe_customer_id VARCHAR(128),
            stripe_subscription_id VARCHAR(128),
            plan VARCHAR(32) NOT NULL DEFAULT 'free',
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            current_period_end TIMESTAMPTZ,
            cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
            org_seat_count INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_subscription_user UNIQUE (user_id)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS subscriptions")
    op.execute("DROP TABLE IF EXISTS teacher_sessions")
    op.execute("DROP TABLE IF EXISTS learner_memories")
