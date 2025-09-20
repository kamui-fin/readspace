"""add subscriber_count column to feeds table

Revision ID: 6a462ec22898
Revises: ac1be8d8c211
Create Date: 2025-09-05 23:11:08.264877+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6a462ec22898"
down_revision: str | None = "ac1be8d8c211"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add subscriber_count column and populate initial values."""
    # Add subscriber_count column with default value 0
    op.add_column(
        "feeds",
        sa.Column("subscriber_count", sa.Integer(), nullable=False, server_default="0"),
    )

    # Populate initial subscriber counts from existing subscriptions
    op.execute("""
        UPDATE feeds SET subscriber_count = (
            SELECT COUNT(*) 
            FROM feed_subscriptions 
            WHERE feed_subscriptions.feed_id = feeds.id
        )
    """)

    # Create triggers to automatically maintain subscriber_count
    # Trigger function
    op.execute("""
        CREATE OR REPLACE FUNCTION update_feed_subscriber_count()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                UPDATE feeds SET subscriber_count = subscriber_count + 1 
                WHERE id = NEW.feed_id;
                RETURN NEW;
            ELSIF TG_OP = 'DELETE' THEN
                UPDATE feeds SET subscriber_count = subscriber_count - 1 
                WHERE id = OLD.feed_id;
                RETURN OLD;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create triggers
    op.execute("""
        CREATE TRIGGER feed_subscription_insert_trigger
        AFTER INSERT ON feed_subscriptions
        FOR EACH ROW EXECUTE FUNCTION update_feed_subscriber_count();
    """)

    op.execute("""
        CREATE TRIGGER feed_subscription_delete_trigger
        AFTER DELETE ON feed_subscriptions
        FOR EACH ROW EXECUTE FUNCTION update_feed_subscriber_count();
    """)

    # Add index for efficient querying
    op.create_index("idx_feeds_subscriber_count", "feeds", ["subscriber_count"])


def downgrade() -> None:
    """Remove subscriber_count column and triggers."""
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS feed_subscription_insert_trigger ON feed_subscriptions;")
    op.execute("DROP TRIGGER IF EXISTS feed_subscription_delete_trigger ON feed_subscriptions;")
    op.execute("DROP FUNCTION IF EXISTS update_feed_subscriber_count();")

    # Drop index and column
    op.drop_index("idx_feeds_subscriber_count", table_name="feeds")
    op.drop_column("feeds", "subscriber_count")
