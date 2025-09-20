"""add role column to profiles

Revision ID: 644d0f774254
Revises: 1fef245d6d85
Create Date: 2025-08-31 21:55:59.695922+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "644d0f774254"
down_revision: str | None = "1fef245d6d85"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "profiles",
        sa.Column("role", sa.String(length=10), nullable=False, server_default="basic"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("profiles", "role")
