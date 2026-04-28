"""add transcript to lessons

Revision ID: 0003_lesson_transcript
Revises: 0002_media_fields
Create Date: 2026-04-28

"""
from alembic import op
import sqlalchemy as sa

revision = "0003_lesson_transcript"
down_revision = "0002_media_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lessons", sa.Column("transcript", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("lessons", "transcript")
