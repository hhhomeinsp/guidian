"""add slide_audio_keys to lessons

Revision ID: 0004_slide_audio_keys
Revises: 0003_lesson_transcript
Create Date: 2026-04-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_slide_audio_keys"
down_revision = "0003_lesson_transcript"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lessons",
        sa.Column("slide_audio_keys", postgresql.ARRAY(sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("lessons", "slide_audio_keys")
