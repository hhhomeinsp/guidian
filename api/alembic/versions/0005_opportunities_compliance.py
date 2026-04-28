"""add course_opportunities, state_requirements, compliance_submissions

Revision ID: 0005_opportunities_compliance
Revises: 0004_slide_audio_keys
Create Date: 2026-04-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005_opportunities_compliance"
down_revision = "0004_slide_audio_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "course_opportunities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("profession", sa.String(128), nullable=False),
        sa.Column("target_states", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("ceu_hours", sa.Float(), nullable=False),
        sa.Column("estimated_license_holders", sa.Integer(), nullable=False),
        sa.Column("renewal_frequency_years", sa.Float(), nullable=False),
        sa.Column("avg_price_per_hour", sa.Float(), nullable=False),
        sa.Column("competition_level", sa.String(16), nullable=False),
        sa.Column("content_reuse_score", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pipeline"),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "state_requirements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("state_code", sa.String(2), nullable=False),
        sa.Column("profession", sa.String(128), nullable=False),
        sa.Column("regulatory_body", sa.String(255), nullable=False),
        sa.Column("regulatory_url", sa.String(512), nullable=False),
        sa.Column("provider_app_url", sa.String(512), nullable=True),
        sa.Column("course_app_url", sa.String(512), nullable=True),
        sa.Column("application_fee", sa.Float(), nullable=True),
        sa.Column("renewal_period_years", sa.Float(), nullable=False),
        sa.Column("online_allowed", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("proctoring_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("min_passing_score", sa.Float(), nullable=False, server_default="0.70"),
        sa.Column("min_seat_time_minutes", sa.Integer(), nullable=True),
        sa.Column("submission_format", sa.String(32), nullable=False),
        sa.Column("processing_days", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("state_code", "profession", name="uq_state_req_state_profession"),
    )

    op.create_table(
        "compliance_submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("state_code", sa.String(2), nullable=False),
        sa.Column("profession", sa.String(128), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approval_number", sa.String(128), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("compliance_submissions")
    op.drop_table("state_requirements")
    op.drop_table("course_opportunities")
