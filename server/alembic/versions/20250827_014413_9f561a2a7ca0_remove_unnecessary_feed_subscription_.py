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
    # Remove unnecessary fields from feed_subscriptions table
    op.drop_column('feed_subscriptions', 'is_paused')
    op.drop_column('feed_subscriptions', 'custom_ttl')
    op.drop_column('feed_subscriptions', 'custom_skip_hours')
    op.drop_column('feed_subscriptions', 'custom_skip_days')
    op.drop_column('feed_subscriptions', 'last_viewed_at')
    op.drop_column('feed_subscriptions', 'subscribed_at')
    
    # Create feed_tag_association table (tags table already exists)
    op.create_table('feed_tag_association',
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
