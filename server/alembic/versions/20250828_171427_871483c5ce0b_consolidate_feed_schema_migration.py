"""consolidate feed schema migration

This migration consolidates the schema changes from the problematic migrations:
- d9657003e235: drop legacy feeds and feed_articles tables  
- 9a70c1d1a21f: drop legacy feeds and feed_articles tables
- 1eae79755f88: merge heads
- f69b03d2ec4c: remove unnecessary columns from feeds table
- 9f561a2a7ca0: remove unnecessary feed subscription fields

Revision ID: 871483c5ce0b
Revises: bf529e34a7d6
Create Date: 2025-08-28 17:14:27.840037+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '871483c5ce0b'
down_revision: Union[str, None] = 'bf529e34a7d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Consolidate all feed schema changes."""
    # This migration consolidates the problematic migrations that were causing
    # deployment failures. Since production deployments were failing before
    # these changes could be applied, this migration is essentially a no-op
    # for fresh installations, but handles cleanup for any partial states.
    
    from sqlalchemy import text
    
    # Get connection to check for existing objects
    connection = op.get_bind()
    
    # Helper function to safely drop table if it exists
    def safe_drop_table(table_name, cascade=False):
        result = connection.execute(text(
            "SELECT 1 FROM information_schema.tables WHERE table_name = :table_name"
        ), {"table_name": table_name})
        if result.fetchone():
            if cascade:
                connection.execute(text(f"DROP TABLE {table_name} CASCADE"))
            else:
                op.drop_table(table_name)
    
    # Helper function to safely drop index if it exists
    def safe_drop_index(index_name, table_name):
        result = connection.execute(text(
            "SELECT 1 FROM pg_indexes WHERE indexname = :index_name"
        ), {"index_name": index_name})
        if result.fetchone():
            op.drop_index(index_name, table_name=table_name)
    
    # Helper function to safely drop column if table and column exist
    def safe_drop_column(table_name, column_name):
        # Check if table exists
        table_result = connection.execute(text(
            "SELECT 1 FROM information_schema.tables WHERE table_name = :table_name"
        ), {"table_name": table_name})
        
        if table_result.fetchone():
            # Check if column exists
            column_result = connection.execute(text(
                "SELECT 1 FROM information_schema.columns WHERE table_name = :table_name AND column_name = :column_name"
            ), {"table_name": table_name, "column_name": column_name})
            
            if column_result.fetchone():
                op.drop_column(table_name, column_name)
    
    # Clean up any orphaned tables/indexes that may exist from partial migrations
    # IMPORTANT: Drop dependent tables first to avoid foreign key constraint errors
    
    # Drop any temporary user article states if they exist (dependent on feed_articles_new)
    safe_drop_index('idx_user_states_article', 'user_article_states')
    safe_drop_index('idx_user_states_favorite', 'user_article_states')
    safe_drop_index('idx_user_states_read', 'user_article_states')
    safe_drop_index('idx_user_states_read_later', 'user_article_states')
    safe_drop_index('idx_user_states_user', 'user_article_states')
    safe_drop_index('idx_user_states_user_article', 'user_article_states')
    safe_drop_table('user_article_states')
    
    # Now drop any temporary feed tables if they exist
    safe_drop_index('idx_feed_articles_new_feed', 'feed_articles_new')
    safe_drop_index('idx_feed_articles_new_feed_guid', 'feed_articles_new')
    safe_drop_index('idx_feed_articles_new_guid', 'feed_articles_new')
    safe_drop_table('feed_articles_new')
    
    safe_drop_index('idx_feeds_new_error_count', 'feeds_new')
    safe_drop_index('idx_feeds_new_last_fetched', 'feeds_new')
    safe_drop_index('idx_feeds_new_url', 'feeds_new')
    safe_drop_table('feeds_new')
    
    # Remove unnecessary columns from feeds table if they exist
    columns_to_drop_from_feeds = [
        'fetch_error_count',
        'last_error_message', 
        'subscriber_count',
        'average_update_frequency'
    ]
    
    for column in columns_to_drop_from_feeds:
        safe_drop_column('feeds', column)
    
    # Remove unnecessary fields from feed_subscriptions if they exist
    safe_drop_column('feed_subscriptions', 'is_paused')
    safe_drop_column('feed_subscriptions', 'custom_ttl')
    safe_drop_column('feed_subscriptions', 'custom_skip_hours')
    safe_drop_column('feed_subscriptions', 'custom_skip_days')
    safe_drop_column('feed_subscriptions', 'last_viewed_at')
    safe_drop_column('feed_subscriptions', 'subscribed_at')
    
    # Create feed_tag_association table if it doesn't exist and tags table exists
    tags_exists = connection.execute(text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'tags'"
    )).fetchone()
    
    feeds_exists = connection.execute(text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'feeds'"
    )).fetchone()
    
    assoc_exists = connection.execute(text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'feed_tag_association'"
    )).fetchone()
    
    if tags_exists and feeds_exists and not assoc_exists:
        op.create_table('feed_tag_association',
            sa.Column('feed_id', sa.UUID(), nullable=False),
            sa.Column('tag_id', sa.UUID(), nullable=False),
            sa.ForeignKeyConstraint(['feed_id'], ['feeds.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('feed_id', 'tag_id')
        )


def downgrade() -> None:
    """Downgrade schema."""
    # This downgrade is not implemented as it would be complex to reverse
    # the consolidated changes and the new schema is a significant improvement
    raise NotImplementedError("This consolidated migration cannot be safely reversed. "
                             "The new schema is a significant improvement and "
                             "data migration back to legacy structure is complex.")
