"""drop unused tags and feed_tag_association tables

Revision ID: ac1be8d8c211
Revises: c9376f60543b
Create Date: 2025-09-05 19:34:50.781226+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ac1be8d8c211'
down_revision: Union[str, None] = 'c9376f60543b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Drop the feed_tag_association table first (due to foreign key constraints)
    op.drop_table('feed_tag_association')
    
    # Drop the tags table
    op.drop_table('tags')


def downgrade() -> None:
    """Downgrade schema."""
    # Recreate tags table
    op.create_table('tags',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', name='uq_tag_user_name')
    )
    op.create_index(op.f('ix_tags_name'), 'tags', ['name'], unique=False)
    op.create_index(op.f('ix_tags_user_id'), 'tags', ['user_id'], unique=False)
    
    # Recreate feed_tag_association table
    op.create_table('feed_tag_association',
        sa.Column('feed_id', sa.UUID(), nullable=False),
        sa.Column('tag_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['feed_id'], ['feeds.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('feed_id', 'tag_id')
    )
