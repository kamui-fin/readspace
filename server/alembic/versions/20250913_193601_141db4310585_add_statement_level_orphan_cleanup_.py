"""add_statement_level_orphan_cleanup_trigger

Revision ID: 141db4310585
Revises: b4978300fc68
Create Date: 2025-09-13 19:36:01.099534+00:00

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "141db4310585"
down_revision: str | None = "b4978300fc68"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""

    # Create statement-level trigger function for efficient bulk orphan cleanup
    op.execute("""
        CREATE OR REPLACE FUNCTION cleanup_orphaned_article_contents_stmt()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Delete any article_contents that no longer have references
            -- This runs once per statement, not per row, making it efficient for bulk operations
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

    # Create statement-level trigger on feed_articles
    op.execute("""
        CREATE TRIGGER trg_cleanup_article_contents_after_feed_delete
        AFTER DELETE ON feed_articles
        FOR EACH STATEMENT
        EXECUTE FUNCTION cleanup_orphaned_article_contents_stmt();
    """)

    # Create statement-level trigger on clipped_articles
    op.execute("""
        CREATE TRIGGER trg_cleanup_article_contents_after_clipped_delete
        AFTER DELETE ON clipped_articles
        FOR EACH STATEMENT
        EXECUTE FUNCTION cleanup_orphaned_article_contents_stmt();
    """)

    # Clean up any existing orphaned records
    op.execute("""
        DELETE FROM article_contents ac
        WHERE NOT EXISTS (
            SELECT 1 FROM feed_articles fa WHERE fa.content_id = ac.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM clipped_articles ca WHERE ca.content_id = ac.id
        );
    """)


def downgrade() -> None:
    """Downgrade schema."""

    # Drop triggers
    op.execute(
        "DROP TRIGGER IF EXISTS trg_cleanup_article_contents_after_feed_delete ON feed_articles;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS trg_cleanup_article_contents_after_clipped_delete ON clipped_articles;"
    )

    # Drop trigger function
    op.execute("DROP FUNCTION IF EXISTS cleanup_orphaned_article_contents_stmt();")
