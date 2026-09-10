"""add codex_digests progress_phase

Revision ID: bd5be628e52e
Revises: 5599f026a90f
Create Date: 2026-09-09 18:11:30.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bd5be628e52e"
down_revision: str | None = "5599f026a90f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "codex_digests",
        sa.Column("progress_phase", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("codex_digests", "progress_phase")
