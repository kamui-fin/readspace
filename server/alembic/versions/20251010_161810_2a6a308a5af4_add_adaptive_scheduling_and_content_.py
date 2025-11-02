"""Add adaptive scheduling and content hash fields

Revision ID: 2a6a308a5af4
Revises: 141db4310585
Create Date: 2025-10-10 16:18:10.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2a6a308a5af4"
down_revision: str | None = "141db4310585"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add adaptive scheduling and content hash optimization fields."""
    # Add adaptive_fetch_interval_minutes - stores learned optimal interval per feed
    op.add_column("feeds", sa.Column("adaptive_fetch_interval_minutes", sa.Integer(), nullable=True))

    # Add content_hash - enables skip processing when feed content unchanged
    op.add_column("feeds", sa.Column("content_hash", sa.String(length=64), nullable=True))


def downgrade() -> None:
    """Remove adaptive scheduling and content hash fields."""
    op.drop_column("feeds", "content_hash")
    op.drop_column("feeds", "adaptive_fetch_interval_minutes")
