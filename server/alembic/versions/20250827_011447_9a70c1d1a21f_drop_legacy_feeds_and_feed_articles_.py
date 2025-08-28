"""drop legacy feeds and feed_articles tables

Revision ID: 9a70c1d1a21f
Revises: d9657003e235
Create Date: 2025-08-27 01:14:47.031125+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a70c1d1a21f'
down_revision: Union[str, None] = 'bf529e34a7d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop legacy feeds and feed_articles tables, rename new tables."""
    # Drop legacy feed_articles table
    op.drop_table('feed_articles')
    
    # Drop legacy feeds table and its association table
    op.drop_table('feed_tag_association')
    op.drop_table('feeds')
    
    # Rename new tables to remove "_new" suffix
    op.rename_table('feeds_new', 'feeds')
    op.rename_table('feed_articles_new', 'feed_articles')
    
    # Update index names to match new table names
    op.drop_index('idx_feeds_new_url', table_name='feeds')
    op.drop_index('idx_feeds_new_last_fetched', table_name='feeds')  
    op.drop_index('idx_feeds_new_error_count', table_name='feeds')
    
    op.create_index('idx_feeds_url', 'feeds', ['url'], unique=True)
    op.create_index('idx_feeds_last_fetched', 'feeds', ['last_fetched_at'])
    op.create_index('idx_feeds_error_count', 'feeds', ['fetch_error_count'])
    
    op.drop_index('idx_feed_articles_new_feed_guid', table_name='feed_articles')
    op.drop_index('idx_feed_articles_new_feed', table_name='feed_articles')
    op.drop_index('idx_feed_articles_new_guid', table_name='feed_articles')
    
    op.create_index('idx_feed_articles_feed_guid', 'feed_articles', ['feed_id', 'guid'], unique=True)
    op.create_index('idx_feed_articles_feed', 'feed_articles', ['feed_id'])
    op.create_index('idx_feed_articles_guid', 'feed_articles', ['guid'])


def downgrade() -> None:
    """Restore legacy table structure."""
    # This downgrade is not fully implemented as it would require
    # recreating the legacy schema and migrating data back.
    # In practice, this migration should be considered irreversible
    # since the new schema is a major improvement.
    raise NotImplementedError("This migration cannot be safely reversed. "
                             "The new schema is a significant improvement and "
                             "data migration back to legacy structure is complex.")
