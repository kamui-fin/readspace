"""create new feeds subscriptions schema

Revision ID: b6d1d1e5c8ff
Revises: b502917bde7d
Create Date: 2025-08-26 22:07:27.035744+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b6d1d1e5c8ff'
down_revision: Union[str, None] = 'b502917bde7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create new global feeds table
    op.create_table('feeds_new',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('url', sa.VARCHAR(length=2048), nullable=False),
        sa.Column('title', sa.VARCHAR(length=500), nullable=True),
        sa.Column('description', sa.TEXT(), nullable=True),
        sa.Column('link', sa.VARCHAR(length=2048), nullable=True),
        sa.Column('language', sa.VARCHAR(length=50), nullable=True),
        sa.Column('image_url', sa.VARCHAR(length=2048), nullable=True),
        sa.Column('ttl', sa.INTEGER(), nullable=True),
        sa.Column('skip_hours', sa.ARRAY(sa.INTEGER()), nullable=True),
        sa.Column('skip_days', sa.ARRAY(sa.VARCHAR()), nullable=True),
        sa.Column('last_fetched_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('last_modified_header', sa.VARCHAR(length=255), nullable=True),
        sa.Column('etag_header', sa.VARCHAR(length=255), nullable=True),
        sa.Column('last_article_published_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('fetch_error_count', sa.INTEGER(), nullable=False, server_default=sa.text('0')),
        sa.Column('last_error_message', sa.TEXT(), nullable=True),
        sa.Column('subscriber_count', sa.INTEGER(), nullable=False, server_default=sa.text('0')),
        sa.Column('average_update_frequency', postgresql.INTERVAL(), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create unique index on URL for global feeds
    op.create_index('idx_feeds_new_url', 'feeds_new', ['url'], unique=True)
    op.create_index('idx_feeds_new_last_fetched', 'feeds_new', ['last_fetched_at'])
    op.create_index('idx_feeds_new_error_count', 'feeds_new', ['fetch_error_count'])
    
    # Create feed subscriptions table
    op.create_table('feed_subscriptions',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('feed_id', sa.UUID(), nullable=False),
        sa.Column('folder_id', sa.UUID(), nullable=False),
        sa.Column('is_favorite', sa.BOOLEAN(), nullable=False, server_default=sa.text('false')),
        sa.Column('custom_title', sa.VARCHAR(length=500), nullable=True),
        sa.Column('is_paused', sa.BOOLEAN(), nullable=False, server_default=sa.text('false')),
        sa.Column('custom_ttl', sa.INTEGER(), nullable=True),
        sa.Column('custom_skip_hours', sa.ARRAY(sa.INTEGER()), nullable=True),
        sa.Column('custom_skip_days', sa.ARRAY(sa.VARCHAR()), nullable=True),
        sa.Column('subscribed_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('last_viewed_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['feed_id'], ['feeds_new.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['folder_id'], ['folders.id'], ondelete='CASCADE')
    )
    
    # Create indexes for feed subscriptions
    op.create_index('idx_subscriptions_user_feed', 'feed_subscriptions', ['user_id', 'feed_id'], unique=True)
    op.create_index('idx_subscriptions_user', 'feed_subscriptions', ['user_id'])
    op.create_index('idx_subscriptions_feed', 'feed_subscriptions', ['feed_id'])
    op.create_index('idx_subscriptions_folder', 'feed_subscriptions', ['folder_id'])
    
    # Create new feed articles table (without user_id, without user-specific fields)
    op.create_table('feed_articles_new',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('feed_id', sa.UUID(), nullable=False),
        sa.Column('content_id', sa.UUID(), nullable=False),
        sa.Column('guid', sa.VARCHAR(length=1024), nullable=False),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['feed_id'], ['feeds_new.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['content_id'], ['article_contents.id'], ondelete='CASCADE')
    )
    
    # Create indexes for new feed articles
    op.create_index('idx_feed_articles_new_feed_guid', 'feed_articles_new', ['feed_id', 'guid'], unique=True)
    op.create_index('idx_feed_articles_new_feed', 'feed_articles_new', ['feed_id'])
    op.create_index('idx_feed_articles_new_guid', 'feed_articles_new', ['guid'])
    
    # Create user article states table
    op.create_table('user_article_states',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('article_id', sa.UUID(), nullable=False),
        sa.Column('is_read', sa.BOOLEAN(), nullable=False, server_default=sa.text('false')),
        sa.Column('read_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('is_read_later', sa.BOOLEAN(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_favorite', sa.BOOLEAN(), nullable=False, server_default=sa.text('false')),
        sa.Column('user_note', sa.TEXT(), nullable=True),
        sa.Column('user_tags', sa.ARRAY(sa.VARCHAR()), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['article_id'], ['feed_articles_new.id'], ondelete='CASCADE')
    )
    
    # Create indexes for user article states
    op.create_index('idx_user_states_user_article', 'user_article_states', ['user_id', 'article_id'], unique=True)
    op.create_index('idx_user_states_user', 'user_article_states', ['user_id'])
    op.create_index('idx_user_states_article', 'user_article_states', ['article_id'])
    op.create_index('idx_user_states_read', 'user_article_states', ['user_id', 'is_read'])
    op.create_index('idx_user_states_read_later', 'user_article_states', ['user_id', 'is_read_later'])
    op.create_index('idx_user_states_favorite', 'user_article_states', ['user_id', 'is_favorite'])
    
    # Fix clipped_articles server default
    op.alter_column('clipped_articles', 'is_read_later',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop new tables in reverse order
    op.drop_table('user_article_states')
    op.drop_table('feed_articles_new')
    op.drop_table('feed_subscriptions')
    op.drop_table('feeds_new')
    
    # Restore clipped_articles server default
    op.alter_column('clipped_articles', 'is_read_later',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('true'),
               existing_nullable=False)
