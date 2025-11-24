"""optimize_unread_count_indexes

Revision ID: 449f9b660af6
Revises: a3bbcf11a9ec
Create Date: 2025-11-23 20:30:51.283253+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '449f9b660af6'
down_revision: Union[str, None] = 'a3bbcf11a9ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add descending index for published_at (optimizes "newest first" queries)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_ac_published_at_desc
        ON article_contents (published_at DESC)
    """)

    # Drop redundant ascending index (keeping ix_article_contents_published_at)
    op.execute("DROP INDEX IF EXISTS idx_article_contents_published")

    # Drop obsolete index (COALESCE fix makes this unnecessary)
    op.execute("DROP INDEX IF EXISTS idx_user_states_unread")


def downgrade() -> None:
    """Downgrade schema."""
    # Recreate the dropped indexes
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_article_content_published
        ON article_contents (published_at)
        WHERE published_at IS NOT NULL
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_states_unread
        ON user_article_states (user_id, article_id)
        WHERE (is_read = false OR is_read IS NULL)
    """)

    # Drop the new descending index
    op.execute("DROP INDEX IF EXISTS idx_ac_published_at_desc")
