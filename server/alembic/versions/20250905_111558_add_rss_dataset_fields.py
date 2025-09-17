"""add rss dataset fields and indexes

Revision ID: add_rss_dataset_fields
Revises: 1fef245d6d85
Create Date: 2025-09-05 11:15:58.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# Import the enum for proper type creation
from app.models.rss_models import FeedCategory

# revision identifiers, used by Alembic.
revision: str = "add_rss_dataset_fields"
down_revision: str | None = "644d0f774254"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add RSS dataset fields and indexes."""

    # Create the feed category enum type
    feed_category_enum = postgresql.ENUM(FeedCategory, name="feedcategory")
    feed_category_enum.create(op.get_bind())

    # Add new columns to feeds table for RSS dataset integration
    op.add_column(
        "feeds", sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=True)
    )
    op.add_column(
        "feeds", sa.Column("top_level_category", feed_category_enum, nullable=True)
    )
    op.add_column(
        "feeds", sa.Column("popularity_score", sa.Float(), nullable=True, default=0.0)
    )

    # Add search helper columns for full-text search
    op.add_column(
        "feeds", sa.Column("tsv_title_link", postgresql.TSVECTOR(), nullable=True)
    )
    op.add_column(
        "feeds", sa.Column("tsv_desc_tags", postgresql.TSVECTOR(), nullable=True)
    )

    # Add embedding column for vector similarity search (768 dimensions)
    # Note: Requires pgvector extension to be enabled
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("ALTER TABLE feeds ADD COLUMN embedding vector(768)")

    # Create GIN indexes for full-text search
    op.create_index(
        "idx_feeds_tsv_title_link", "feeds", ["tsv_title_link"], postgresql_using="gin"
    )
    op.create_index(
        "idx_feeds_tsv_desc_tags", "feeds", ["tsv_desc_tags"], postgresql_using="gin"
    )

    # Create index for vector similarity search (using pgvector)
    op.execute(
        "CREATE INDEX idx_feeds_embedding ON feeds USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )

    # Create additional indexes for filtering
    op.create_index("idx_feeds_category", "feeds", ["top_level_category"])
    op.create_index("idx_feeds_popularity_score", "feeds", ["popularity_score"])

    # Create GIN index for tags array
    op.create_index("idx_feeds_tags", "feeds", ["tags"], postgresql_using="gin")

    # Create function to update tsvectors automatically (using existing link field)
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

    # Create trigger to automatically update tsvectors on insert/update
    op.execute("""
    CREATE TRIGGER feeds_tsvectors_update_trigger 
        BEFORE INSERT OR UPDATE ON feeds
        FOR EACH ROW EXECUTE FUNCTION update_feed_tsvectors();
    """)

    # Update existing feeds to populate tsvectors
    op.execute("""
    UPDATE feeds SET 
        tsv_title_link = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(link, '')),
        tsv_desc_tags = to_tsvector('english', coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))
    WHERE tsv_title_link IS NULL OR tsv_desc_tags IS NULL;
    """)


def downgrade() -> None:
    """Remove RSS dataset fields and indexes."""

    # Drop trigger and function
    op.execute("DROP TRIGGER IF EXISTS feeds_tsvectors_update_trigger ON feeds;")
    op.execute("DROP FUNCTION IF EXISTS update_feed_tsvectors();")

    # Drop indexes
    op.drop_index("idx_feeds_popularity_score", table_name="feeds")
    op.drop_index("idx_feeds_category", table_name="feeds")
    op.drop_index("idx_feeds_tags", table_name="feeds")

    op.execute("DROP INDEX IF EXISTS idx_feeds_embedding;")

    op.drop_index("idx_feeds_tsv_desc_tags", table_name="feeds")
    op.drop_index("idx_feeds_tsv_title_link", table_name="feeds")

    # Drop columns
    op.drop_column("feeds", "embedding")
    op.drop_column("feeds", "tsv_desc_tags")
    op.drop_column("feeds", "tsv_title_link")
    op.drop_column("feeds", "popularity_score")
    op.drop_column("feeds", "top_level_category")
    op.drop_column("feeds", "tags")

    # Drop the enum type
    op.execute("DROP TYPE IF EXISTS feedcategory")
