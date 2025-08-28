"""migrate data to new feeds subscriptions schema

Revision ID: bf529e34a7d6
Revises: b6d1d1e5c8ff
Create Date: 2025-08-26 22:09:13.458300+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'bf529e34a7d6'
down_revision: Union[str, None] = 'b6d1d1e5c8ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Migrate data to new feeds subscriptions schema."""
    # Get database connection
    connection = op.get_bind()
    
    # Step 1: Create shared feeds (deduplicate by URL)
    print("Creating shared feeds from existing feeds...")
    connection.execute(sa.text("""
        INSERT INTO feeds_new (url, title, description, link, language, image_url, ttl, skip_hours, skip_days, 
                              last_fetched_at, last_modified_header, etag_header, last_article_published_at, 
                              fetch_error_count, last_error_message, created_at, updated_at)
        SELECT DISTINCT ON (url) 
            url, title, description, link, language, image_url, ttl, skip_hours, skip_days,
            last_fetched_at, last_modified_header, etag_header, last_article_published_at,
            COALESCE(fetch_error_count, 0), last_error_message, created_at, updated_at
        FROM feeds
        ORDER BY url, created_at
    """))
    
    # Step 2: Update subscriber counts for new feeds
    print("Updating subscriber counts...")
    connection.execute(sa.text("""
        UPDATE feeds_new SET subscriber_count = (
            SELECT COUNT(*) 
            FROM feeds 
            WHERE feeds.url = feeds_new.url
        )
    """))
    
    # Step 3: Create subscriptions from current feeds
    print("Creating subscriptions from existing feeds...")
    connection.execute(sa.text("""
        INSERT INTO feed_subscriptions (user_id, feed_id, folder_id, is_favorite, subscribed_at, created_at, updated_at)
        SELECT 
            fo.user_id,
            f.id as feed_id,
            fo.folder_id,
            COALESCE(fo.is_favorite, false),
            fo.created_at,
            fo.created_at,
            fo.updated_at
        FROM feeds fo
        JOIN feeds_new f ON f.url = fo.url
    """))
    
    # Step 4: Create new feed articles with stable GUIDs
    print("Migrating feed articles with stable GUID generation...")
    connection.execute(sa.text("""
        INSERT INTO feed_articles_new (feed_id, content_id, guid, created_at, updated_at)
        SELECT 
            fn.id as feed_id,
            fa.content_id,
            CASE 
                WHEN fa.guid IS NOT NULL AND fa.guid != '' THEN fa.guid
                WHEN ac.link IS NOT NULL AND ac.link != '' THEN ac.link
                ELSE 'hash:' || encode(sha256((COALESCE(ac.title, '') || '|' || COALESCE(ac.published_at::text, '') || '|' || COALESCE(substring(ac.content, 1, 1000), ''))::bytea), 'hex')
            END as guid,
            fa.created_at,
            fa.updated_at
        FROM feed_articles fa
        JOIN feeds fo ON fa.feed_id = fo.id
        JOIN feeds_new fn ON fn.url = fo.url
        JOIN article_contents ac ON fa.content_id = ac.id
        WHERE fa.user_id = (
            -- Use the earliest user for each feed to avoid duplicates
            SELECT f2.user_id
            FROM feeds f2 
            WHERE f2.url = fo.url
            ORDER BY f2.created_at ASC
            LIMIT 1
        )
        ON CONFLICT (feed_id, guid) DO NOTHING
    """))
    
    # Step 5: Create user article states from existing feed articles
    print("Creating user article states...")
    connection.execute(sa.text("""
        INSERT INTO user_article_states (user_id, article_id, is_read, read_at, is_read_later, is_favorite, created_at, updated_at)
        SELECT DISTINCT
            fa.user_id,
            fan.id as article_id,
            COALESCE(fa.is_read, false),
            fa.read_at,
            COALESCE(fa.is_read_later, false),
            COALESCE(fa.is_favorite, false),
            fa.created_at,
            fa.updated_at
        FROM feed_articles fa
        JOIN feeds fo ON fa.feed_id = fo.id
        JOIN feeds_new fn ON fn.url = fo.url
        JOIN feed_articles_new fan ON fan.feed_id = fn.id
        JOIN article_contents ac ON fa.content_id = ac.id AND fan.content_id = ac.id
        WHERE fan.guid = CASE 
            WHEN fa.guid IS NOT NULL AND fa.guid != '' THEN fa.guid
            WHEN ac.link IS NOT NULL AND ac.link != '' THEN ac.link
            ELSE 'hash:' || encode(sha256((COALESCE(ac.title, '') || '|' || COALESCE(ac.published_at::text, '') || '|' || COALESCE(substring(ac.content, 1, 1000), ''))::bytea), 'hex')
        END
        ON CONFLICT (user_id, article_id) DO NOTHING
    """))
    
    print("Data migration completed successfully!")


def downgrade() -> None:
    """Downgrade schema - clear migrated data."""
    # Clear migrated data from new tables
    connection = op.get_bind()
    print("Clearing migrated data from new tables...")
    connection.execute(sa.text("DELETE FROM user_article_states"))
    connection.execute(sa.text("DELETE FROM feed_articles_new"))
    connection.execute(sa.text("DELETE FROM feed_subscriptions"))
    connection.execute(sa.text("DELETE FROM feeds_new"))
    print("Data migration rollback completed.")
