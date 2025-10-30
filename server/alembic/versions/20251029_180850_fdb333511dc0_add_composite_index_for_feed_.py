"""Add composite index for feed subscriptions bulk operations

Revision ID: fdb333511dc0
Revises: 2a6a308a5af4
Create Date: 2025-10-29 18:08:50.278130+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fdb333511dc0'
down_revision: Union[str, None] = '2a6a308a5af4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add composite index for user_id and folder_id on feed_subscriptions
    # This significantly speeds up folder-based bulk operations
    op.create_index(
        'idx_feed_subscriptions_user_folder',
        'feed_subscriptions',
        ['user_id', 'folder_id'],
        unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop the composite index
    op.drop_index(
        'idx_feed_subscriptions_user_folder',
        table_name='feed_subscriptions'
    )
