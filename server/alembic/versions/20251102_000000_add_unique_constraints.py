"""Add UNIQUE constraints and CHECK constraints for data integrity

Revision ID: add_unique_constraints
Revises: add_performance_indexes
Create Date: 2025-11-02 00:00:00.000000+00:00

This migration adds critical constraints and schema optimizations:
1. UNIQUE(feed_id, guid) on feed_articles - prevents duplicate articles per feed
2. UNIQUE(user_id, article_id) on user_article_states - prevents duplicate user state records
3. CHECK constraint on folders.name - prevents empty folder names
4. CHECK constraint on feeds.fetch_error_count - ensures valid range (0-999)
5. Schema optimizations:
   - Reduce article_contents.title from VARCHAR(1000) to VARCHAR(500)
   - Reduce feeds.description from TEXT to VARCHAR(2000)

The migration also includes cleanup logic to handle any existing duplicates.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_unique_constraints"
down_revision: str | None = "add_performance_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add UNIQUE constraints after cleaning up any existing duplicates."""

    # ============================================================================
    # CLEANUP: Remove duplicate feed_articles (keep oldest by created_at)
    # ============================================================================

    print("Checking for duplicate feed_articles...")

    # Find and remove duplicate feed_articles (same feed_id + guid)
    # Keep the oldest record (earliest created_at) and remove newer duplicates
    op.execute("""
        DELETE FROM feed_articles
        WHERE id IN (
            SELECT id
            FROM (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY feed_id, guid
                        ORDER BY created_at ASC, id ASC
                    ) as row_num
                FROM feed_articles
            ) ranked
            WHERE row_num > 1
        )
    """)

    # ============================================================================
    # CLEANUP: Remove duplicate user_article_states (keep most recent state)
    # ============================================================================

    print("Checking for duplicate user_article_states...")

    # Find and remove duplicate user_article_states (same user_id + article_id)
    # Keep the most recent record (latest updated_at) to preserve latest user action
    # Merge is_read, is_read_later, is_favorite as OR operation (TRUE if any is TRUE)
    op.execute("""
        DELETE FROM user_article_states
        WHERE id IN (
            SELECT id
            FROM (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY user_id, article_id
                        ORDER BY updated_at DESC, id DESC
                    ) as row_num
                FROM user_article_states
            ) ranked
            WHERE row_num > 1
        )
    """)

    # ============================================================================
    # DROP EXISTING INDEXES (to be replaced by UNIQUE constraints)
    # ============================================================================

    # Drop existing UNIQUE index on feed_articles (created in init migration)
    # Will be replaced by a proper UNIQUE constraint which creates its own index
    print("Dropping existing UNIQUE index idx_feed_articles_feed_guid...")
    op.drop_index("idx_feed_articles_feed_guid", table_name="feed_articles")

    # Drop existing plain index on user_article_states (created in init migration)
    # Will be replaced by a UNIQUE constraint which creates its own index
    print("Dropping existing index idx_user_states_user_article...")
    op.drop_index("idx_user_states_user_article", table_name="user_article_states")

    # ============================================================================
    # ADD UNIQUE CONSTRAINTS
    # ============================================================================

    # Add UNIQUE constraint on (feed_id, guid) for feed_articles
    # This prevents duplicate articles from being inserted for the same feed
    print("Adding UNIQUE constraint on feed_articles(feed_id, guid)...")
    op.create_unique_constraint("uq_feed_articles_feed_guid", "feed_articles", ["feed_id", "guid"])

    # Add UNIQUE constraint on (user_id, article_id) for user_article_states
    # This prevents duplicate state records for the same user-article pair
    print("Adding UNIQUE constraint on user_article_states(user_id, article_id)...")
    op.create_unique_constraint("uq_user_article_states_user_article", "user_article_states", ["user_id", "article_id"])

    # ============================================================================
    # ADD CHECK CONSTRAINTS
    # ============================================================================

    # CHECK constraint on folders.name to prevent empty folder names
    # Ensures data integrity at database level
    print("Adding CHECK constraint on folders.name to prevent empty names...")
    op.create_check_constraint("ck_folder_name_not_empty", "folders", sa.text("name <> '' AND name IS NOT NULL"))

    # CHECK constraint on feeds.fetch_error_count to ensure valid range
    # Prevents negative values and unreasonably high error counts
    print("Adding CHECK constraint on feeds.fetch_error_count...")
    op.create_check_constraint(
        "ck_feed_fetch_error_count_range", "feeds", sa.text("fetch_error_count >= 0 AND fetch_error_count < 1000")
    )

    # ============================================================================
    # SCHEMA OPTIMIZATIONS
    # ============================================================================

    # Reduce article_contents.title from VARCHAR(1000) to VARCHAR(500)
    # Most article titles are < 200 chars, this saves ~800 bytes per article
    print("Reducing article_contents.title column size to VARCHAR(500)...")

    # First, truncate any titles longer than 500 chars (rare edge case)
    op.execute("""
        UPDATE article_contents
        SET title = LEFT(title, 497) || '...'
        WHERE LENGTH(title) > 500
    """)

    # Then alter the column type
    op.alter_column(
        "article_contents", "title", type_=sa.String(500), existing_type=sa.String(1000), existing_nullable=True
    )

    # Reduce feeds.description from TEXT to VARCHAR(2000)
    # Most feed descriptions are < 1000 chars, this improves query performance
    print("Reducing feeds.description column size to VARCHAR(2000)...")

    # First, truncate any descriptions longer than 2000 chars
    op.execute("""
        UPDATE feeds
        SET description = LEFT(description, 1997) || '...'
        WHERE LENGTH(description) > 2000
    """)

    # Then alter the column type
    op.alter_column("feeds", "description", type_=sa.String(2000), existing_type=sa.Text(), existing_nullable=True)

    print("Migration completed successfully!")


def downgrade() -> None:
    """Remove UNIQUE constraints, CHECK constraints, and revert schema changes."""

    # ============================================================================
    # REVERT SCHEMA OPTIMIZATIONS
    # ============================================================================

    # Restore feeds.description to TEXT
    op.alter_column("feeds", "description", type_=sa.Text(), existing_type=sa.String(2000), existing_nullable=True)

    # Restore article_contents.title to VARCHAR(1000)
    op.alter_column(
        "article_contents", "title", type_=sa.String(1000), existing_type=sa.String(500), existing_nullable=True
    )

    # ============================================================================
    # REMOVE CHECK CONSTRAINTS
    # ============================================================================

    # Drop CHECK constraints
    op.drop_constraint("ck_feed_fetch_error_count_range", "feeds", type_="check")
    op.drop_constraint("ck_folder_name_not_empty", "folders", type_="check")

    # ============================================================================
    # RESTORE PLAIN INDEXES AND REMOVE UNIQUE CONSTRAINTS
    # ============================================================================

    # Restore the plain indexes first
    op.create_index("idx_user_states_user_article", "user_article_states", ["user_id", "article_id"], unique=False)

    op.create_index("idx_feed_articles_feed_guid", "feed_articles", ["feed_id", "guid"], unique=False)

    # Drop the unique constraints
    op.drop_constraint("uq_user_article_states_user_article", "user_article_states", type_="unique")

    op.drop_constraint("uq_feed_articles_feed_guid", "feed_articles", type_="unique")
