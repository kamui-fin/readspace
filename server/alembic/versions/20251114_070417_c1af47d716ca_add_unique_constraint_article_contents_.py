"""add_unique_constraint_article_contents_link_and_fix_orphans

Revision ID: c1af47d716ca
Revises: da3a4f3c26f5
Create Date: 2025-11-14 07:04:17.639104+00:00

This migration addresses the root cause of orphaned article_contents by:
1. Cleaning up existing orphaned article_contents rows
2. Deduplicating article_contents by link (keeping the oldest/most referenced)
3. Adding a UNIQUE constraint on article_contents.link to prevent future duplicates
4. Adding an index for performance

This ensures that:
- No duplicate article_contents can be created for the same link
- The ingestion pipeline will properly handle conflicts via upsert
- Orphan cleanup triggers will be more effective
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1af47d716ca"
down_revision: str | None = "da3a4f3c26f5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema.

    IMPORTANT: This migration may take hours on large databases.
    It sets a 3-hour timeout to handle millions of rows.
    """

    # Set long timeout for this migration (may delete millions of rows)
    # This must be set at the start before any operations
    op.execute("SET statement_timeout = '180min'")

    # STEP 1: Clean up existing orphaned article_contents
    # These are content rows with NO references from feed_articles OR clipped_articles
    op.execute("""
        DELETE FROM article_contents ac
        WHERE NOT EXISTS (
            SELECT 1 FROM feed_articles fa WHERE fa.content_id = ac.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM clipped_articles ca WHERE ca.content_id = ac.id
        )
    """)

    # STEP 2: Deduplicate article_contents by link
    # For duplicate links, we:
    # 1. Update feed_articles to point to the "canonical" content (most referenced)
    # 2. Delete the duplicate content rows
    # 3. Keep the content row that has the most references OR the oldest one

    # Create temp table
    op.execute("""
        CREATE TEMP TABLE content_canonical AS
        WITH content_with_refs AS (
            SELECT
                ac.id,
                ac.link,
                ac.created_at,
                COUNT(DISTINCT fa.id) as feed_article_count,
                COUNT(DISTINCT ca.id) as clipped_article_count,
                ROW_NUMBER() OVER (
                    PARTITION BY ac.link
                    ORDER BY
                        (COUNT(DISTINCT fa.id) + COUNT(DISTINCT ca.id)) DESC,
                        ac.created_at ASC
                ) as rn
            FROM article_contents ac
            LEFT JOIN feed_articles fa ON fa.content_id = ac.id
            LEFT JOIN clipped_articles ca ON ca.content_id = ac.id
            GROUP BY ac.id, ac.link, ac.created_at
        )
        SELECT
            link,
            id as canonical_id
        FROM content_with_refs
        WHERE rn = 1
    """)

    # Update feed_articles
    op.execute("""
        UPDATE feed_articles fa
        SET content_id = cc.canonical_id
        FROM content_canonical cc
        JOIN article_contents ac ON ac.link = cc.link
        WHERE fa.content_id = ac.id
          AND fa.content_id != cc.canonical_id
    """)

    # Update clipped_articles
    op.execute("""
        UPDATE clipped_articles ca
        SET content_id = cc.canonical_id
        FROM content_canonical cc
        JOIN article_contents ac ON ac.link = cc.link
        WHERE ca.content_id = ac.id
          AND ca.content_id != cc.canonical_id
    """)

    # Delete duplicates
    op.execute("""
        DELETE FROM article_contents ac
        WHERE EXISTS (
            SELECT 1
            FROM content_canonical cc
            WHERE cc.link = ac.link
              AND cc.canonical_id != ac.id
        )
    """)

    # Clean up
    op.execute("DROP TABLE content_canonical")

    # STEP 3: Add unique constraint on link
    # This is the key fix - prevents duplicate content rows for the same URL
    op.create_unique_constraint("uq_article_contents_link", "article_contents", ["link"])


def downgrade() -> None:
    """Downgrade schema."""

    # Drop the unique constraint
    op.drop_constraint("uq_article_contents_link", "article_contents", type_="unique")

    # Drop the index if it exists
    op.execute("""
        DROP INDEX IF EXISTS idx_article_contents_link_unique;
    """)
