"""Add performance indexes for query optimization

Revision ID: add_performance_indexes
Revises: fdb333511dc0
Create Date: 2025-11-01 00:00:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_performance_indexes"
down_revision: str | None = "fdb333511dc0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add performance indexes for critical query patterns."""

    # ============================================================================
    # USER ARTICLE STATES INDEXES
    # ============================================================================

    # NOTE: UNIQUE constraint on (user_id, article_id) is created in the
    # add_unique_constraints migration to keep constraint management separate
    # from performance indexes

    # Composite index for unread article queries (most common filter)
    # Covers: unread counts and article filtering by read status
    op.create_index(
        "idx_user_states_unread_lookup",
        "user_article_states",
        ["user_id", "is_read"],
        unique=False,
        postgresql_where=sa.text("is_read = FALSE OR is_read IS NULL"),
    )

    # Index for read_later queries
    # Covers: "Read Later" view and counts
    op.create_index(
        "idx_user_states_read_later",
        "user_article_states",
        ["user_id", "is_read_later"],
        unique=False,
        postgresql_where=sa.text("is_read_later = TRUE"),
    )

    # Index for favorite queries
    # Covers: favorites view and filtering
    op.create_index(
        "idx_user_states_favorites",
        "user_article_states",
        ["user_id", "is_favorite"],
        unique=False,
        postgresql_where=sa.text("is_favorite = TRUE"),
    )

    # Index for recently read articles queries
    # Covers: recent reading history and sorting by read_at
    op.create_index(
        "idx_user_states_read_at",
        "user_article_states",
        ["user_id", sa.text("read_at DESC NULLS LAST")],
        unique=False,
        postgresql_where=sa.text("read_at IS NOT NULL"),
    )

    # ============================================================================
    # FEED SUBSCRIPTIONS INDEXES
    # ============================================================================

    # Index for user's feeds (critical for article queries with subscription join)
    # Covers: feed listing and article filtering by user
    # NOTE: idx_feed_subscriptions_user_folder already exists from previous migration
    op.create_index("idx_feed_subs_user_feed", "feed_subscriptions", ["user_id", "feed_id"], unique=False)

    # Index for favorite feeds filtering
    # Covers: favorite feed filtering in article queries
    op.create_index(
        "idx_feed_subs_favorites",
        "feed_subscriptions",
        ["user_id", "is_favorite"],
        unique=False,
        postgresql_where=sa.text("is_favorite = TRUE"),
    )

    # ============================================================================
    # FEED ARTICLES INDEXES
    # ============================================================================

    # NOTE: UNIQUE constraint on (feed_id, guid) is created in the
    # add_unique_constraints migration to keep constraint management separate
    # from performance indexes

    # NOTE: UNIQUE constraint on (feed_id, guid) is created in the
    # add_unique_constraints migration, which automatically creates an index

    # Index for standalone article_id lookups (many queries filter by article_id first)
    # Covers: direct article lookups, user state queries by article_id
    op.create_index("idx_feed_articles_article_id", "feed_articles", ["id"], unique=False)

    # Index for article content joins (most common join pattern)
    # Covers: content_id joins in article queries
    op.create_index("idx_feed_articles_content", "feed_articles", ["content_id"], unique=False)

    # Index for feed-specific article queries ordered by date
    # Covers: feed articles sorted by published date
    op.create_index(
        "idx_feed_articles_feed_date", "feed_articles", ["feed_id", sa.text("created_at DESC")], unique=False
    )

    # ============================================================================
    # ARTICLE CONTENT INDEXES
    # ============================================================================

    # NOTE: Full-text search index NOT created because queries use ILIKE instead of to_tsvector.
    # If FTS is needed in the future, update search queries to use to_tsvector and add:
    # CREATE INDEX idx_article_content_fts ON article_contents USING gin(
    #     to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
    # )

    # Index for URL deduplication (checking if article already exists)
    # Covers: link lookups when saving new articles
    op.create_index("idx_article_content_link", "article_contents", ["link"], unique=False)

    # Composite index for URL deduplication with published date sorting
    # Covers: dedup queries that also sort by published_at
    op.create_index(
        "idx_article_content_link_published",
        "article_contents",
        ["link", sa.text("published_at DESC NULLS LAST")],
        unique=False,
    )

    # Index for recent articles sorted by published date
    # Covers: article queries sorted by published_at DESC
    op.create_index(
        "idx_article_content_published", "article_contents", [sa.text("published_at DESC NULLS LAST")], unique=False
    )

    # ============================================================================
    # FEEDS INDEXES
    # ============================================================================

    # Index for feed refresh scheduling by last fetch time
    # Covers: queries filtering feeds needing refresh based on last_fetched_at
    op.create_index("idx_feeds_last_fetched", "feeds", ["last_fetched_at"], unique=False)

    # Composite index for feed refresh prioritization
    # Covers: refresh scheduling that considers both last_fetched_at and subscriber_count
    op.create_index(
        "idx_feeds_refresh_priority",
        "feeds",
        ["last_fetched_at", "subscriber_count"],
        unique=False,
        postgresql_where=sa.text("subscriber_count > 0"),
    )

    # Index for feed refresh prioritization by subscriber count alone
    # Covers: sorting feeds by subscriber_count for refresh scheduling
    op.create_index(
        "idx_feeds_subscriber_count",
        "feeds",
        ["subscriber_count"],
        unique=False,
        postgresql_where=sa.text("subscriber_count > 0"),
    )

    # ============================================================================
    # VECTOR SEARCH OPTIMIZATION
    # ============================================================================

    # Replace IVFFlat index with HNSW for better vector search performance
    # HNSW provides better recall and faster query times than IVFFlat
    # Drop old IVFFlat index
    op.execute("DROP INDEX IF EXISTS idx_feeds_embedding")

    # Create HNSW index for vector similarity search (pgvector)
    # m=16 (connections per layer), ef_construction=64 (build quality)
    op.execute("""
        CREATE INDEX idx_feeds_embedding_hnsw
        ON feeds
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)


def downgrade() -> None:
    """Remove performance indexes."""

    # Restore IVFFlat index
    op.execute("DROP INDEX IF EXISTS idx_feeds_embedding_hnsw")
    op.execute("""
        CREATE INDEX idx_feeds_embedding
        ON feeds
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    """)

    # Drop in reverse order
    op.drop_index("idx_feeds_subscriber_count", table_name="feeds")
    op.drop_index("idx_feeds_refresh_priority", table_name="feeds")
    op.drop_index("idx_feeds_last_fetched", table_name="feeds")

    op.drop_index("idx_article_content_published", table_name="article_contents")
    op.drop_index("idx_article_content_link_published", table_name="article_contents")
    op.drop_index("idx_article_content_link", table_name="article_contents")

    op.drop_index("idx_feed_articles_feed_date", table_name="feed_articles")
    op.drop_index("idx_feed_articles_content", table_name="feed_articles")
    op.drop_index("idx_feed_articles_article_id", table_name="feed_articles")

    op.drop_index("idx_feed_subs_favorites", table_name="feed_subscriptions")
    op.drop_index("idx_feed_subs_user_feed", table_name="feed_subscriptions")

    op.drop_index("idx_user_states_read_at", table_name="user_article_states")
    op.drop_index("idx_user_states_favorites", table_name="user_article_states")
    op.drop_index("idx_user_states_read_later", table_name="user_article_states")
    op.drop_index("idx_user_states_unread_lookup", table_name="user_article_states")
