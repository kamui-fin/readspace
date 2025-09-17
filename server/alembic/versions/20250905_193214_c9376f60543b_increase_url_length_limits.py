"""increase url length limits

Revision ID: c9376f60543b
Revises: add_rss_dataset_fields
Create Date: 2025-09-05 19:32:14.263646+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c9376f60543b"
down_revision: str | None = "add_rss_dataset_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Increase URL field lengths from 2048 to 4096 characters
    # This addresses issues with very long RSS feed URLs and article links

    # Update feeds table URL fields
    op.alter_column("feeds", "url", type_=sa.String(length=4096))
    op.alter_column("feeds", "link", type_=sa.String(length=4096))
    op.alter_column("feeds", "image_url", type_=sa.String(length=4096))

    # Update article_contents table URL fields
    op.alter_column("article_contents", "link", type_=sa.String(length=4096))
    op.alter_column("article_contents", "image_url", type_=sa.String(length=4096))


def downgrade() -> None:
    """Downgrade schema."""
    # Revert URL field lengths back to 2048 characters

    # Revert feeds table URL fields
    op.alter_column("feeds", "url", type_=sa.String(length=2048))
    op.alter_column("feeds", "link", type_=sa.String(length=2048))
    op.alter_column("feeds", "image_url", type_=sa.String(length=2048))

    # Revert article_contents table URL fields
    op.alter_column("article_contents", "link", type_=sa.String(length=2048))
    op.alter_column("article_contents", "image_url", type_=sa.String(length=2048))
