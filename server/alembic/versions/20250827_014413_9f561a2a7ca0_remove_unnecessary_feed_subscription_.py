"""remove unnecessary feed subscription fields

Revision ID: 9f561a2a7ca0
Revises: 358ff34989f3
Create Date: 2025-08-27 01:44:13.608638+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '9f561a2a7ca0'
down_revision: Union[str, None] = 'f69b03d2ec4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy import text
    
    # Get connection to check for existing objects
    connection = op.get_bind()
    
    # Helper function to safely drop column if table and column exist
    def safe_drop_column(table_name, column_name):
        # Check if table exists
        table_result = connection.execute(text(
            "SELECT 1 FROM information_schema.tables WHERE table_name = :table_name"
        ), {"table_name": table_name})
        
        if table_result.fetchone():
            # Check if column exists
            column_result = connection.execute(text(
                "SELECT 1 FROM information_schema.columns WHERE table_name = :table_name AND column_name = :column_name"
            ), {"table_name": table_name, "column_name": column_name})
            
            if column_result.fetchone():
                op.drop_column(table_name, column_name)
    
    # Helper function to safely create table if it doesn't exist
    def safe_create_table(table_name, *args, **kwargs):
        result = connection.execute(text(
            "SELECT 1 FROM information_schema.tables WHERE table_name = :table_name"
        ), {"table_name": table_name})
        
        if not result.fetchone():
            op.create_table(table_name, *args, **kwargs)
    
    # Remove unnecessary fields from feed_subscriptions table (if it exists)
    safe_drop_column('feed_subscriptions', 'is_paused')
    safe_drop_column('feed_subscriptions', 'custom_ttl')
    safe_drop_column('feed_subscriptions', 'custom_skip_hours')
    safe_drop_column('feed_subscriptions', 'custom_skip_days')
    safe_drop_column('feed_subscriptions', 'last_viewed_at')
    safe_drop_column('feed_subscriptions', 'subscribed_at')
    
    # Create feed_tag_association table (tags table already exists)
    safe_create_table('feed_tag_association',
        sa.Column('feed_id', sa.UUID(), nullable=False),
        sa.Column('tag_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['feed_id'], ['feeds.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('feed_id', 'tag_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Restore removed columns
    op.add_column('feed_subscriptions', sa.Column('is_paused', sa.BOOLEAN(), nullable=False, server_default=sa.text('false')))
    op.add_column('feed_subscriptions', sa.Column('custom_ttl', sa.INTEGER(), nullable=True))
    op.add_column('feed_subscriptions', sa.Column('custom_skip_hours', postgresql.ARRAY(sa.INTEGER()), nullable=True))
    op.add_column('feed_subscriptions', sa.Column('custom_skip_days', postgresql.ARRAY(sa.VARCHAR()), nullable=True))
    op.add_column('feed_subscriptions', sa.Column('last_viewed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('feed_subscriptions', sa.Column('subscribed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    
    # Remove tag association table (keep tags table as it existed before)
    op.drop_table('feed_tag_association')
