"""add course_opportunities, state_requirements, compliance_submissions

Revision ID: 0005_opportunities_compliance
Revises: 0004_slide_audio_keys
Create Date: 2026-04-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005_opp_compliance"
down_revision = "0004_slide_audio_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Raw SQL with IF NOT EXISTS — fully idempotent, safe to re-run
    op.execute("""
        CREATE TABLE IF NOT EXISTS course_opportunities (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(255) NOT NULL,
            profession VARCHAR(128) NOT NULL,
            target_states TEXT[] NOT NULL DEFAULT '{}',
            ceu_hours FLOAT NOT NULL,
            estimated_license_holders INTEGER NOT NULL,
            renewal_frequency_years FLOAT NOT NULL,
            avg_price_per_hour FLOAT NOT NULL,
            competition_level VARCHAR(16) NOT NULL,
            content_reuse_score INTEGER NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pipeline',
            course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS state_requirements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            state_code VARCHAR(2) NOT NULL,
            profession VARCHAR(128) NOT NULL,
            regulatory_body VARCHAR(255) NOT NULL,
            regulatory_url VARCHAR(512) NOT NULL,
            provider_app_url VARCHAR(512),
            course_app_url VARCHAR(512),
            application_fee FLOAT,
            renewal_period_years FLOAT NOT NULL,
            online_allowed BOOLEAN NOT NULL DEFAULT TRUE,
            proctoring_required BOOLEAN NOT NULL DEFAULT FALSE,
            min_passing_score FLOAT NOT NULL DEFAULT 0.70,
            min_seat_time_minutes INTEGER,
            submission_format VARCHAR(32) NOT NULL,
            processing_days INTEGER NOT NULL,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_state_req_state_profession UNIQUE (state_code, profession)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS compliance_submissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            state_code VARCHAR(2) NOT NULL,
            profession VARCHAR(128) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'draft',
            submitted_at TIMESTAMPTZ,
            approved_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ,
            approval_number VARCHAR(128),
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS compliance_submissions")
    op.execute("DROP TABLE IF EXISTS state_requirements")
    op.execute("DROP TABLE IF EXISTS course_opportunities")
