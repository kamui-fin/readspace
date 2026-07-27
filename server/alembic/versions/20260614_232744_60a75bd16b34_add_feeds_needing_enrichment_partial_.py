"""add_feeds_needing_enrichment_partial_index

Revision ID: 60a75bd16b34
Revises: d236de8fdfdf
Create Date: 2026-06-14 23:27:44.648233+00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "60a75bd16b34"
down_revision: Union[str, None] = "d236de8fdfdf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index(
        "idx_feeds_needing_enrichment",
        "feeds",
        ["id"],
        postgresql_where=sa.text(
            "(tags IS NULL OR tags = '{}' OR content_type IS NULL) AND url NOT LIKE 'newsletter://%'"
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_feeds_needing_enrichment", table_name="feeds")
