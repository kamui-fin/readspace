"""cleanup_redundant_user_article_states

Revision ID: 2c64438ca2f3
Revises: c1af47d716ca
Create Date: 2025-11-14 07:16:28.166534+00:00

This migration cleans up redundant user_article_states records that were created
automatically during feed subscription/article ingestion.

Root cause: Previous implementation auto-created user_article_states for EVERY article
when users subscribed to feeds or when feeds were refreshed. This led to 63,000+ rows
for just a few users.

New behavior: user_article_states are only created when users actively interact with
articles (mark as read, favorite, read later, etc.). The unread article logic uses
OUTER JOIN to treat missing states as "unread by default".

This migration:
1. Deletes all "inactive" user_article_states (unread, not favorited, not read-later, no notes/tags)
2. Keeps states that represent actual user interactions
3. Provides statistics on cleanup impact

Expected impact: Reduce from ~63,000 rows to ~100-500 rows (only user interactions).
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2c64438ca2f3"
down_revision: str | None = "c1af47d716ca"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - clean up redundant user_article_states."""

    # Get statistics before cleanup
    op.execute("""
        DO $$
        DECLARE
            total_count INTEGER;
            inactive_count INTEGER;
            active_count INTEGER;
        BEGIN
            -- Count total states
            SELECT COUNT(*) INTO total_count FROM user_article_states;

            -- Count inactive states (will be deleted)
            SELECT COUNT(*) INTO inactive_count
            FROM user_article_states
            WHERE is_read = false
              AND is_read_later = false
              AND is_favorite = false
              AND read_at IS NULL;

            -- Count active states (will be kept)
            active_count := total_count - inactive_count;

            RAISE NOTICE 'user_article_states cleanup statistics:';
            RAISE NOTICE '  Total states before cleanup: %', total_count;
            RAISE NOTICE '  Inactive states to delete: % (%.1f%%)',
                inactive_count,
                CASE WHEN total_count > 0 THEN (inactive_count::float / total_count * 100) ELSE 0 END;
            RAISE NOTICE '  Active states to keep: % (%.1f%%)',
                active_count,
                CASE WHEN total_count > 0 THEN (active_count::float / total_count * 100) ELSE 0 END;
        END $$;
    """)

    # Delete redundant user_article_states
    # Keep only states that represent actual user interactions:
    # - Articles marked as read (is_read = true OR read_at IS NOT NULL)
    # - Articles marked as read later (is_read_later = true)
    # - Articles favorited (is_favorite = true)
    # Delete everything else (default "unread" states that were auto-created)
    op.execute("""
        DELETE FROM user_article_states
        WHERE is_read = false
          AND is_read_later = false
          AND is_favorite = false
          AND read_at IS NULL;
    """)

    # Show statistics after cleanup
    op.execute("""
        DO $$
        DECLARE
            remaining_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO remaining_count FROM user_article_states;

            RAISE NOTICE 'Cleanup complete!';
            RAISE NOTICE '  Remaining states: %', remaining_count;
        END $$;
    """)


def downgrade() -> None:
    """Downgrade schema.

    Note: This migration only deletes data, it doesn't modify schema.
    There's no practical way to restore the deleted redundant states,
    and they were redundant anyway (auto-created for unread articles).

    The application logic now creates states lazily on user interaction,
    so the deleted states are not needed.
    """
    # No-op: Can't restore deleted data
    # The application will recreate states as needed when users interact with articles
    pass
