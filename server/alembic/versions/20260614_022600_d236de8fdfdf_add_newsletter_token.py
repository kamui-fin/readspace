"""add_newsletter_token

Revision ID: d236de8fdfdf
Revises: 8c0c3a86dd05
Create Date: 2026-06-14 02:26:00.052855+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd236de8fdfdf'
down_revision: Union[str, None] = '8c0c3a86dd05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('profiles', sa.Column('newsletter_token', sa.Text(), nullable=True))
    op.create_index(op.f('ix_profiles_newsletter_token'), 'profiles', ['newsletter_token'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_profiles_newsletter_token'), table_name='profiles')
    op.drop_column('profiles', 'newsletter_token')
