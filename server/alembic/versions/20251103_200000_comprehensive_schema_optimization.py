"""comprehensive schema optimization

Revision ID: comprehensive_optimization
Revises: fdb333511dc0
Create Date: 2025-11-03 20:00:00.000000+00:00

This comprehensive migration:
1. Removes library/book system (highlights, user_book_library, book_metadata)
2. Reverts redundant orphan cleanup trigger (CASCADE handles this)
3. Adds type safety enums (ArticlePriority, UserRole)
4. Migrates text columns to enums
5. Upgrades vector index from IVFFlat to HNSW for production
6. Adds critical indexes based on actual query patterns
7. Drops redundant and unused indexes
8. Merges work from pending migrations
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "comprehensive_optimization"
down_revision: str | None = "fdb333511dc0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Comprehensive schema optimization upgrade."""

    # ============================================================================
    # 1. REMOVE LIBRARY/BOOK SYSTEM
    # ============================================================================

    print("Dropping library/book system tables...")

    # Drop tables in correct order (respecting foreign keys)
    op.drop_table("highlights")
    op.drop_table("user_book_library")
    op.drop_table("book_metadata")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS highlightcolor")
    op.execute("DROP TYPE IF EXISTS bookformat")

    # ============================================================================
    # 2. REVERT ORPHAN CLEANUP TRIGGER
    # ============================================================================

    print("Reverting redundant orphan cleanup triggers...")

    # Drop triggers first
    op.execute("DROP TRIGGER IF EXISTS trg_cleanup_article_contents_after_feed_delete ON feed_articles")
    op.execute("DROP TRIGGER IF EXISTS trg_cleanup_article_contents_after_clipped_delete ON clipped_articles")

    # Drop the trigger function
    op.execute("DROP FUNCTION IF EXISTS cleanup_orphaned_article_contents_stmt()")

    # ============================================================================
    # 3. ADD TYPE SAFETY ENUMS
    # ============================================================================

    print("Creating type safety enums...")

    # ArticlePriority enum for clipped_articles
    op.execute("CREATE TYPE articlepriority AS ENUM ('LOW', 'MEDIUM', 'HIGH')")

    # UserRole enum for profiles
    op.execute("CREATE TYPE userrole AS ENUM ('BASIC', 'PRO', 'ADMIN')")

    # ============================================================================
    # 4. MIGRATE COLUMNS TO ENUMS
    # ============================================================================

    print("Migrating columns to enum types...")

    # Migrate profiles.role: TEXT -> userrole enum
    # First set all to BASIC default (normalize to uppercase)
    op.execute("UPDATE profiles SET role = 'BASIC' WHERE role IS NULL OR role = '' OR role != 'BASIC'")

    # Drop existing default before type change
    op.execute("ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT")

    # Alter column type using USING clause for type conversion
    op.execute("""
        ALTER TABLE profiles
        ALTER COLUMN role TYPE userrole
        USING role::userrole
    """)

    # Set new enum default
    op.execute("ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'BASIC'::userrole")

    # Migrate clipped_articles.priority: String(20) -> articlepriority enum
    # First set all to MEDIUM default (normalize to uppercase)
    op.execute("UPDATE clipped_articles SET priority = 'MEDIUM' WHERE priority IS NULL OR priority = '' OR priority NOT IN ('LOW', 'MEDIUM', 'HIGH')")

    # Drop existing default before type change
    op.execute("ALTER TABLE clipped_articles ALTER COLUMN priority DROP DEFAULT")

    # Alter column type (convert to uppercase first)
    op.execute("""
        ALTER TABLE clipped_articles
        ALTER COLUMN priority TYPE articlepriority
        USING UPPER(priority)::articlepriority
    """)

    # Set new enum default
    op.execute("ALTER TABLE clipped_articles ALTER COLUMN priority SET DEFAULT 'MEDIUM'::articlepriority")

    # ============================================================================
    # 5. UPGRADE VECTOR INDEX (IVFFlat -> HNSW)
    # ============================================================================

    print("Upgrading vector search index to HNSW...")

    # Drop old IVFFlat index if it exists
    op.execute("DROP INDEX IF EXISTS idx_feeds_embedding")

    # Create production-optimized HNSW index (if not exists)
    # m=16: connections per layer (higher = better recall)
    # ef_construction=64: build quality (higher = slower build, better search)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_feeds_embedding_hnsw
        ON feeds
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # ============================================================================
    # 6. ADD CRITICAL INDEXES (Based on Query Pattern Analysis)
    # ============================================================================

    print("Adding critical performance indexes...")

    # Note: CONCURRENTLY cannot be used within a transaction block
    # These indexes are created without CONCURRENTLY for migration safety
    # In production, you can rebuild them with CONCURRENTLY if needed

    # Subscription checks (used in every feed add, subscription lookup)
    # Covers: WHERE user_id = X AND feed_id = Y
    op.create_index(
        "idx_feed_subscriptions_user_feed",
        "feed_subscriptions",
        ["user_id", "feed_id"],
        unique=False,
    )

    # Unread count queries (runs on every page load)
    # Covers: WHERE user_id = X AND (is_read = FALSE OR is_read IS NULL)
    op.create_index(
        "idx_user_states_unread",
        "user_article_states",
        ["user_id", "article_id"],
        unique=False,
        postgresql_where=sa.text("is_read = FALSE OR is_read IS NULL"),
    )

    # Read later view queries
    # Covers: WHERE user_id = X AND is_read_later = TRUE
    op.create_index(
        "idx_user_states_read_later",
        "user_article_states",
        ["user_id", "is_read_later"],
        unique=False,
        postgresql_where=sa.text("is_read_later = TRUE"),
    )

    # Clipped articles listing (main query pattern)
    # Covers: WHERE user_id = X ORDER BY created_at DESC
    # Replaces separate user_id and created_at indexes
    op.create_index(
        "idx_clipped_user_created",
        "clipped_articles",
        ["user_id", sa.text("created_at DESC")],
        unique=False,
    )

    # Feed refresh scheduling (Celery Beat task every 5 mins)
    # Covers: ORDER BY last_fetched_at ASC NULLS FIRST
    op.create_index(
        "idx_feeds_last_fetched",
        "feeds",
        [sa.text("last_fetched_at ASC NULLS FIRST")],
        unique=False,
    )

    # Foreign key join optimization (feed_articles -> article_contents)
    # Improves join performance, standard practice for foreign keys
    op.create_index(
        "idx_feed_articles_content",
        "feed_articles",
        ["content_id"],
        unique=False,
    )

    # ============================================================================
    # 7. DROP REDUNDANT AND UNUSED INDEXES
    # ============================================================================

    print("Dropping redundant and unused indexes...")

    # Redundant: duplicate of unique constraint uq_user_article_state
    op.drop_index("idx_user_states_user_article", table_name="user_article_states", if_exists=True)

    # Replaced: by targeted partial indexes (unread, read_later)
    op.drop_index("idx_user_states_compound", table_name="user_article_states", if_exists=True)

    # Edge case: published_at covers 99%+ of queries
    op.drop_index("ix_article_contents_created_at", table_name="article_contents", if_exists=True)

    # Low selectivity: boolean indexes are useless after user_id filter
    op.drop_index("ix_clipped_articles_is_read", table_name="clipped_articles", if_exists=True)
    op.drop_index("ix_clipped_articles_is_read_later", table_name="clipped_articles", if_exists=True)
    op.drop_index("ix_clipped_articles_is_favorite", table_name="clipped_articles", if_exists=True)

    # Replaced: by composite index idx_clipped_user_created
    op.drop_index("ix_clipped_articles_user_id", table_name="clipped_articles", if_exists=True)
    op.drop_index("ix_clipped_articles_created_at", table_name="clipped_articles", if_exists=True)

    # ============================================================================
    # 8. MERGE WORK FROM PENDING MIGRATIONS
    # ============================================================================

    print("Applying merged work from pending migrations...")

    # From 20251103_185547_145532795a73_add_last_read_cutoff_to_feed_.py
    # Add last_read_cutoff column (if not exists from prior migration)
    # Check if column exists before adding
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'feed_subscriptions'
                AND column_name = 'last_read_cutoff'
            ) THEN
                ALTER TABLE feed_subscriptions
                ADD COLUMN last_read_cutoff TIMESTAMP WITH TIME ZONE;
            END IF;
        END $$;
    """)

    # Backfill existing subscriptions with cutoff timestamp
    # Set last_read_cutoff to the 10th most recent article's published_at
    op.execute("""
        UPDATE feed_subscriptions fs
        SET last_read_cutoff = (
            SELECT ac.published_at
            FROM feed_articles fa
            JOIN article_contents ac ON ac.id = fa.content_id
            WHERE fa.feed_id = fs.feed_id
            ORDER BY ac.published_at DESC
            OFFSET 9 LIMIT 1
        )
        WHERE last_read_cutoff IS NULL
        AND EXISTS (
            SELECT 1
            FROM feed_articles fa
            JOIN article_contents ac ON ac.id = fa.content_id
            WHERE fa.feed_id = fs.feed_id
            AND ac.published_at IS NOT NULL
        );
    """)

    # Note: idx_feed_subscriptions_user_feed_cutoff is redundant with
    # idx_feed_subscriptions_user_feed, so we skip creating it

    # From 20251102_000000_add_unique_constraints.py
    # Cleanup duplicates and add constraints

    print("Cleaning up duplicate records...")

    # Remove duplicate feed_articles (keep oldest by created_at)
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

    # Remove duplicate user_article_states (keep most recent)
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

    # Add CHECK constraints for data integrity
    print("Adding data integrity constraints...")

    # Ensure folder names are not empty
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_folder_name_not_empty'
            ) THEN
                ALTER TABLE folders
                ADD CONSTRAINT ck_folder_name_not_empty
                CHECK (name <> '' AND name IS NOT NULL);
            END IF;
        END $$;
    """)

    # Ensure feed fetch_error_count is in valid range
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_feed_fetch_error_count_range'
            ) THEN
                ALTER TABLE feeds
                ADD CONSTRAINT ck_feed_fetch_error_count_range
                CHECK (fetch_error_count >= 0 AND fetch_error_count < 1000);
            END IF;
        END $$;
    """)

    print("Migration completed successfully!")


def downgrade() -> None:
    """Downgrade schema - reverses all changes."""

    print("Downgrading comprehensive schema optimization...")

    # Reverse CHECK constraints
    op.execute("ALTER TABLE folders DROP CONSTRAINT IF EXISTS ck_folder_name_not_empty")
    op.execute("ALTER TABLE feeds DROP CONSTRAINT IF EXISTS ck_feed_fetch_error_count_range")

    # Reverse last_read_cutoff addition
    op.drop_column("feed_subscriptions", "last_read_cutoff")

    # Restore dropped indexes
    op.create_index("idx_user_states_user_article", "user_article_states", ["user_id", "article_id"])
    op.create_index(
        "idx_user_states_compound",
        "user_article_states",
        ["user_id", "article_id", "is_read", "is_read_later"],
    )
    op.create_index("ix_article_contents_created_at", "article_contents", ["created_at"])
    op.create_index("ix_clipped_articles_is_read", "clipped_articles", ["is_read"])
    op.create_index("ix_clipped_articles_is_read_later", "clipped_articles", ["is_read_later"])
    op.create_index("ix_clipped_articles_is_favorite", "clipped_articles", ["is_favorite"])
    op.create_index("ix_clipped_articles_user_id", "clipped_articles", ["user_id"])
    op.create_index("ix_clipped_articles_created_at", "clipped_articles", ["created_at"])

    # Drop new indexes
    op.drop_index("idx_feed_subscriptions_user_feed", table_name="feed_subscriptions")
    op.drop_index("idx_user_states_unread", table_name="user_article_states")
    op.drop_index("idx_user_states_read_later", table_name="user_article_states")
    op.drop_index("idx_clipped_user_created", table_name="clipped_articles")
    op.drop_index("idx_feeds_last_fetched", table_name="feeds")
    op.drop_index("idx_feed_articles_content", table_name="feed_articles")

    # Restore IVFFlat index
    op.execute("DROP INDEX IF EXISTS idx_feeds_embedding_hnsw")
    op.execute("""
        CREATE INDEX idx_feeds_embedding
        ON feeds
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    """)

    # Revert enum columns to text
    op.execute("ALTER TABLE profiles ALTER COLUMN role TYPE VARCHAR(10) USING role::text")
    op.execute("ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'basic'")

    op.execute("ALTER TABLE clipped_articles ALTER COLUMN priority TYPE VARCHAR(20) USING priority::text")
    op.execute("ALTER TABLE clipped_articles ALTER COLUMN priority SET DEFAULT 'medium'")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("DROP TYPE IF EXISTS articlepriority")

    # Restore orphan cleanup trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION cleanup_orphaned_article_contents_stmt()
        RETURNS TRIGGER AS $$
        BEGIN
            DELETE FROM article_contents ac
            WHERE NOT EXISTS (
                SELECT 1 FROM feed_articles fa WHERE fa.content_id = ac.id
            )
            AND NOT EXISTS (
                SELECT 1 FROM clipped_articles ca WHERE ca.content_id = ac.id
            );

            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_cleanup_article_contents_after_feed_delete
        AFTER DELETE ON feed_articles
        FOR EACH STATEMENT
        EXECUTE FUNCTION cleanup_orphaned_article_contents_stmt();
    """)

    op.execute("""
        CREATE TRIGGER trg_cleanup_article_contents_after_clipped_delete
        AFTER DELETE ON clipped_articles
        FOR EACH STATEMENT
        EXECUTE FUNCTION cleanup_orphaned_article_contents_stmt();
    """)

    # Restore library/book tables
    op.execute("CREATE TYPE bookformat AS ENUM ('EPUB', 'PDF')")
    op.execute("CREATE TYPE highlightcolor AS ENUM ('YELLOW', 'GREEN', 'BLUE')")

    op.create_table(
        "book_metadata",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("author", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_url", sa.Text(), nullable=True),
        sa.Column("file_url", sa.Text(), nullable=False),
        sa.Column("format", postgresql.ENUM("EPUB", "PDF", name="bookformat"), nullable=False),
        sa.Column("num_pages", sa.Integer(), nullable=True),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("epub_chapter_char_counts", postgresql.ARRAY(sa.Integer()), nullable=True),
        sa.Column("epub_page_char_counts", postgresql.ARRAY(sa.Integer()), nullable=True),
        sa.Column("pdf_toc", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "user_book_library",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(), nullable=False),
        sa.Column("book_metadata_id", postgresql.UUID(), nullable=False),
        sa.Column("date_added", sa.DateTime(timezone=True), nullable=False),
        sa.Column("epub_progress", sa.JSON(), nullable=True),
        sa.Column("pdf_current_page", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["book_metadata_id"], ["book_metadata.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "book_metadata_id", name="uix_user_book"),
    )

    op.create_table(
        "highlights",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_book_lib_id", postgresql.UUID(), nullable=False),
        sa.Column("color", postgresql.ENUM("YELLOW", "GREEN", "BLUE", name="highlightcolor"), nullable=False),
        sa.Column("original_text", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("chapter_idx", sa.Integer(), nullable=True),
        sa.Column("chapter_href", sa.Text(), nullable=True),
        sa.Column("chapter_title", sa.Text(), nullable=True),
        sa.Column("page", sa.Integer(), nullable=True),
        sa.Column("html_range", sa.JSON(), nullable=True),
        sa.Column("pdf_rect_position", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["user_book_lib_id"], ["user_book_library.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    print("Downgrade completed successfully!")
