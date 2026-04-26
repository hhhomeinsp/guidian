"""add image_url to lessons

Revision ID: 0002_media_fields
Revises: 0001_initial
Create Date: 2026-04-26

"""
from alembic import op
import sqlalchemy as sa

revision = "0002_media_fields"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lessons", sa.Column("image_url", sa.String(1024), nullable=True))


def downgrade() -> None:
    op.drop_column("lessons", "image_url")
