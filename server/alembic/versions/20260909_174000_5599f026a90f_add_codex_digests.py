"""add codex_digests

Revision ID: 5599f026a90f
Revises: 247c62c35ef5
Create Date: 2026-09-09 17:40:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5599f026a90f"
down_revision: str | None = "247c62c35ef5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "codex_digests",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("digest_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("model", sa.String(length=100), nullable=True),
        sa.Column("window_hours", sa.Integer(), nullable=True),
        sa.Column("input_article_count", sa.Integer(), nullable=True),
        sa.Column("input_source_count", sa.Integer(), nullable=True),
        sa.Column("clusters_found", sa.Integer(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "digest_date", name="uq_codex_digest_user_date"),
    )
    op.create_index(op.f("ix_codex_digests_user_id"), "codex_digests", ["user_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_codex_digests_user_id"), table_name="codex_digests")
    op.drop_table("codex_digests")
