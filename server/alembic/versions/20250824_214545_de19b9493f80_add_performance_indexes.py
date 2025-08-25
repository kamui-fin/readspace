"""add_performance_indexes

Revision ID: de19b9493f80
Revises: b502917bde7d
Create Date: 2025-08-24 21:45:45.218407+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'de19b9493f80'
down_revision: Union[str, None] = 'b502917bde7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Critical performance indexes
    
    # For article queries by user and date range
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_user_published 
        ON articles(user_id, published_at DESC) 
        WHERE published_at IS NOT NULL;
    """)
    
    # For feed refresh queries  
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feeds_refresh_priority 
        ON feeds(last_fetched_at ASC NULLS FIRST, fetch_error_count DESC);
    """)
    
    # For article duplicate checks during import (critical for bulk operations)
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_feed_guid 
        ON articles(feed_id, guid);
    """)
    
    # For folder-based article queries
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_folder_user 
        ON articles(user_id) 
        WHERE folder_id IS NOT NULL;
    """)
    
    # For feed articles table (new architecture)
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feed_articles_user_published 
        ON feed_articles(user_id, published_at DESC) 
        WHERE published_at IS NOT NULL;
    """)
    
    # For feed articles duplicate checks
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feed_articles_feed_guid 
        ON feed_articles(feed_id, guid);
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop the indexes
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_articles_user_published;")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_feeds_refresh_priority;")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_articles_feed_guid;")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_articles_folder_user;")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_feed_articles_user_published;")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_feed_articles_feed_guid;")
