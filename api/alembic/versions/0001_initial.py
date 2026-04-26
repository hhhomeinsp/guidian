"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.execute("""
        DO $$$ BEGIN
            CREATE TYPE user_role AS ENUM ('learner', 'instructor', 'admin', 'org_admin');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$$;
    """)
    user_role = postgresql.ENUM("learner", "instructor", "admin", "org_admin", name="user_role", create_type=False)

    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(64), nullable=False, unique=True),
        sa.Column("settings", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True, index=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255)),
        sa.Column("role", user_role, nullable=False, server_default="learner"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "learner_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("vark_scores", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("style_vector", Vector(16)),
        sa.Column("preferences", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "courses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE")),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False, index=True),
        sa.Column("description", sa.Text),
        sa.Column("topic_prompt", sa.Text),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("ceu_hours", sa.Float, nullable=False, server_default="0"),
        sa.Column("ceu_rules", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("accrediting_body", sa.String(255)),
        sa.Column("state_approvals", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("organization_id", "slug", name="uq_course_org_slug"),
    )

    op.create_table(
        "modules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("order_index", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "lessons",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("module_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("order_index", sa.Integer, nullable=False),
        sa.Column("objectives", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("mdx_content", sa.Text, nullable=False, server_default=""),
        sa.Column("audio_url", sa.String(1024)),
        sa.Column("diagrams", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("quiz", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("style_tags", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("clock_minutes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("requires_completion", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "enrollments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("progress_pct", sa.Float, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "course_id", name="uq_enrollment_user_course"),
    )

    op.create_table(
        "lesson_progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seconds_spent", sa.Integer, nullable=False, server_default="0"),
        sa.Column("variant_served", sa.String(32)),
        sa.Column("completed", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("behavioral_signals", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "lesson_id", name="uq_lesson_progress_user_lesson"),
    )

    op.create_table(
        "quiz_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Float, nullable=False),
        sa.Column("passed", sa.Boolean, nullable=False),
        sa.Column("answers", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "compliance_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("subject_user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("course_id", postgresql.UUID(as_uuid=True)),
        sa.Column("event_type", sa.String(64), nullable=False, index=True),
        sa.Column("payload", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("prev_hash", sa.String(128)),
        sa.Column("entry_hash", sa.String(128)),
    )

    # Append-only enforcement: block UPDATE and DELETE at the DB layer.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION compliance_audit_log_append_only()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'compliance_audit_log is append-only: % blocked', TG_OP;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER compliance_audit_log_no_update
        BEFORE UPDATE ON compliance_audit_log
        FOR EACH ROW EXECUTE FUNCTION compliance_audit_log_append_only();
        """
    )
    op.execute(
        """
        CREATE TRIGGER compliance_audit_log_no_delete
        BEFORE DELETE ON compliance_audit_log
        FOR EACH ROW EXECUTE FUNCTION compliance_audit_log_append_only();
        """
    )

    op.create_table(
        "certificates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pdf_url", sa.String(1024)),
        sa.Column("ceu_hours", sa.Float, nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("verification_code", sa.String(64), nullable=False, unique=True),
        sa.Column("metadata", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "ceu_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("total_ceu_hours", sa.Float, nullable=False),
        sa.Column("min_passing_score", sa.Float, nullable=False, server_default="0.7"),
        sa.Column("requires_proctoring", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("requires_identity_verification", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("state_approvals", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("accrediting_body", sa.String(255)),
        sa.Column("min_clock_minutes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("certificate_valid_days", sa.Integer),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "xapi_statements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("stored_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column("actor", postgresql.JSONB, nullable=False),
        sa.Column("verb", postgresql.JSONB, nullable=False),
        sa.Column("object", postgresql.JSONB, nullable=False),
        sa.Column("result", postgresql.JSONB),
        sa.Column("context", postgresql.JSONB),
        sa.Column("raw", postgresql.JSONB, nullable=False),
    )

    op.create_table(
        "ai_generation_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending", index=True),
        sa.Column("prompt", sa.Text, nullable=False),
        sa.Column("params", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("result", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("error", sa.Text),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("celery_task_id", sa.String(128)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("attempts >= 0", name="ck_ai_job_attempts"),
    )


def downgrade() -> None:
    op.drop_table("ai_generation_jobs")
    op.drop_table("xapi_statements")
    op.drop_table("ceu_rules")
    op.drop_table("certificates")
    op.execute("DROP TRIGGER IF EXISTS compliance_audit_log_no_delete ON compliance_audit_log")
    op.execute("DROP TRIGGER IF EXISTS compliance_audit_log_no_update ON compliance_audit_log")
    op.execute("DROP FUNCTION IF EXISTS compliance_audit_log_append_only()")
    op.drop_table("compliance_audit_log")
    op.drop_table("quiz_attempts")
    op.drop_table("lesson_progress")
    op.drop_table("enrollments")
    op.drop_table("lessons")
    op.drop_table("modules")
    op.drop_table("courses")
    op.drop_table("learner_profiles")
    op.drop_table("users")
    op.drop_table("organizations")
    op.execute("DROP TYPE IF EXISTS user_role")
