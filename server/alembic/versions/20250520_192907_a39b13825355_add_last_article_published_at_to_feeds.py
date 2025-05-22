"""add_last_article_published_at_to_feeds

Revision ID: a39b13825355
Revises: 347c54dbb383
Create Date: 2025-05-20 19:29:07.947835+00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a39b13825355'
down_revision: Union[str, None] = '347c54dbb383'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('feeds', sa.Column('last_article_published_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('feeds', 'last_article_published_at')
