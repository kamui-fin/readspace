"""article_contents: persist extracted full text

Full-text extraction was previously recomputed on every article open and never stored,
so each read paid a blocking scrape and burned a daily scrape-quota unit. These columns
cache the result against the shared content row (keyed by article URL), making the scrape
a once-per-article cost rather than once-per-open.

``extracted_at`` is stamped even when extraction yields nothing usable, so articles behind
a paywall or cookie wall are not retried on every open.

Revision ID: f4a7c2e91b83
Revises: 6919b381a10d
Create Date: 2026-09-14 12:00:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f4a7c2e91b83"
down_revision: str | None = "6919b381a10d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("article_contents", sa.Column("extracted_content", sa.Text(), nullable=True))
    op.add_column("article_contents", sa.Column("extracted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("article_contents", "extracted_at")
    op.drop_column("article_contents", "extracted_content")
