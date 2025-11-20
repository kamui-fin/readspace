"""remove_legacy_postgres_search_infrastructure

Revision ID: a3bbcf11a9ec
Revises: 5e1f38db7364
Create Date: 2025-11-19 22:48:43.387241+00:00

This migration removes legacy PostgreSQL-based search infrastructure now that
Meilisearch handles all feed search functionality:
- Drops tsvector columns (tsv_title_link, tsv_desc_tags) and related triggers
- Drops GIN indexes for full-text search
- Drops pgvector embedding column and HNSW index
- Removes pgvector extension (if not used elsewhere)

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a3bbcf11a9ec'
down_revision: Union[str, None] = '5e1f38db7364'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove legacy PostgreSQL search infrastructure."""

    print("Removing legacy PostgreSQL search infrastructure...")

    # 1. Drop tsvector trigger and function (if they still exist)
    op.execute("DROP TRIGGER IF EXISTS feeds_tsvectors_update_trigger ON feeds")
    op.execute("DROP FUNCTION IF EXISTS update_feed_tsvectors()")

    # 2. Drop GIN indexes for full-text search and tags
    op.execute("DROP INDEX IF EXISTS idx_feeds_tsv_title_link")
    op.execute("DROP INDEX IF EXISTS idx_feeds_tsv_desc_tags")
    op.execute("DROP INDEX IF EXISTS idx_feeds_tags")

    # 3. Drop B-tree indexes for filtering/sorting (now handled by Meilisearch)
    op.execute("DROP INDEX IF EXISTS idx_feeds_category")
    op.execute("DROP INDEX IF EXISTS idx_feeds_popularity_score")
    # Note: idx_feeds_subscriber_count is kept - used for feed refresh scheduling

    # 4. Drop tsvector columns
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'feeds' AND column_name = 'tsv_title_link'
            ) THEN
                ALTER TABLE feeds DROP COLUMN tsv_title_link;
            END IF;
        END $$;
    """)

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'feeds' AND column_name = 'tsv_desc_tags'
            ) THEN
                ALTER TABLE feeds DROP COLUMN tsv_desc_tags;
            END IF;
        END $$;
    """)

    # 5. Drop pgvector HNSW index
    op.execute("DROP INDEX IF EXISTS idx_feeds_embedding_hnsw")
    op.execute("DROP INDEX IF EXISTS idx_feeds_embedding")

    # 6. Drop embedding column
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'feeds' AND column_name = 'embedding'
            ) THEN
                ALTER TABLE feeds DROP COLUMN embedding;
            END IF;
        END $$;
    """)

    # 7. Drop pgvector extension (only if no other tables use it)
    # Note: This is commented out by default to be safe
    # Uncomment if you're certain no other tables use pgvector
    # op.execute("DROP EXTENSION IF EXISTS vector")

    print("Legacy PostgreSQL search infrastructure removed successfully!")


def downgrade() -> None:
    """Restore legacy PostgreSQL search infrastructure."""

    print("Restoring legacy PostgreSQL search infrastructure...")

    # Note: This downgrade is provided for safety but not recommended
    # Meilisearch is now the primary search mechanism

    # 1. Re-enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # 2. Add back embedding column
    op.execute("ALTER TABLE feeds ADD COLUMN IF NOT EXISTS embedding vector(768)")

    # 3. Add back tsvector columns
    op.add_column("feeds", sa.Column("tsv_title_link", postgresql.TSVECTOR(), nullable=True))
    op.add_column("feeds", sa.Column("tsv_desc_tags", postgresql.TSVECTOR(), nullable=True))

    # 4. Recreate GIN indexes for full-text search and tags
    op.create_index("idx_feeds_tsv_title_link", "feeds", ["tsv_title_link"], postgresql_using="gin")
    op.create_index("idx_feeds_tsv_desc_tags", "feeds", ["tsv_desc_tags"], postgresql_using="gin")
    op.create_index("idx_feeds_tags", "feeds", ["tags"], postgresql_using="gin")

    # 5. Recreate B-tree indexes for filtering/sorting
    op.create_index("idx_feeds_category", "feeds", ["top_level_category"])
    op.create_index("idx_feeds_popularity_score", "feeds", ["popularity_score"])
    # Note: idx_feeds_subscriber_count was not dropped, so no need to recreate

    # 6. Recreate HNSW index for vector search
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_feeds_embedding_hnsw
        ON feeds
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # 7. Recreate tsvector update trigger
    op.execute("""
    CREATE OR REPLACE FUNCTION update_feed_tsvectors() RETURNS trigger AS $$
    BEGIN
        NEW.tsv_title_link := to_tsvector('english',
            coalesce(NEW.title, '') || ' ' ||
            coalesce(NEW.link, '')
        );
        NEW.tsv_desc_tags := to_tsvector('english',
            coalesce(NEW.description, '') || ' ' ||
            coalesce(array_to_string(NEW.tags, ' '), '')
        );
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)

    op.execute("""
    CREATE TRIGGER feeds_tsvectors_update_trigger
        BEFORE INSERT OR UPDATE ON feeds
        FOR EACH ROW EXECUTE FUNCTION update_feed_tsvectors();
    """)

    # 8. Backfill tsvector columns
    op.execute("""
    UPDATE feeds SET
        tsv_title_link = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(link, '')),
        tsv_desc_tags = to_tsvector('english', coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))
    WHERE tsv_title_link IS NULL OR tsv_desc_tags IS NULL;
    """)

    print("Legacy PostgreSQL search infrastructure restored!")
