"""add_performance_indexes

Revision ID: 39abb5356e48
Revises: 1fef245d6d85
Create Date: 2025-08-29 00:27:51.340054+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '39abb5356e48'
down_revision: Union[str, None] = '1fef245d6d85'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add index for user_article_states.user_id for faster user queries
    op.create_index('ix_user_article_states_user_id', 'user_article_states', ['user_id'])
    
    # Add index for feed_articles.content_id for faster content joins
    op.create_index('ix_feed_articles_content_id', 'feed_articles', ['content_id'])
    
    # Add index for clipped_articles.user_id for faster user queries
    op.create_index('ix_clipped_articles_user_id', 'clipped_articles', ['user_id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes in reverse order
    op.drop_index('ix_clipped_articles_user_id', table_name='clipped_articles')
    op.drop_index('ix_feed_articles_content_id', table_name='feed_articles')
    op.drop_index('ix_user_article_states_user_id', table_name='user_article_states')
