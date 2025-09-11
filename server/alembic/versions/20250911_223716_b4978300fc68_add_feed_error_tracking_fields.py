"""add_feed_error_tracking_fields

Revision ID: b4978300fc68
Revises: 4a3a2f72deb3
Create Date: 2025-09-11 22:37:16.338101+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b4978300fc68'
down_revision: Union[str, None] = '4a3a2f72deb3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add error tracking fields to feeds table
    op.add_column('feeds', sa.Column('fetch_error_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('feeds', sa.Column('last_error_message', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove error tracking fields from feeds table
    op.drop_column('feeds', 'last_error_message')
    op.drop_column('feeds', 'fetch_error_count')
