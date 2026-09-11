"""codex_preferences: per-user digest knobs

Adds a ``codex_preferences`` table holding one row per user. For now it carries a single
knob - ``excluded_folder_ids``, the folders whose feeds the user does not want folded into
their daily digest. A user with no row uses the defaults (nothing excluded).

Revision ID: 6919b381a10d
Revises: c3d1e9f2a7b4
Create Date: 2026-09-10 14:00:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6919b381a10d"
down_revision: str | None = "c3d1e9f2a7b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "codex_preferences",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "excluded_folder_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="[]",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("codex_preferences")
