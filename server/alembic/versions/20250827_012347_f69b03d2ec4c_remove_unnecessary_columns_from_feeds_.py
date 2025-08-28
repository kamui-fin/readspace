"""remove unnecessary columns from feeds table

Revision ID: f69b03d2ec4c
Revises: 1eae79755f88
Create Date: 2025-08-27 01:23:47.787783+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f69b03d2ec4c'
down_revision: Union[str, None] = '1eae79755f88'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove unnecessary columns from feeds table."""
    # Get database connection
    connection = op.get_bind()
    
    # Check which columns exist before dropping them
    columns_to_drop = [
        'fetch_error_count',
        'last_error_message', 
        'subscriber_count',
        'average_update_frequency'
    ]
    
    for column in columns_to_drop:
        result = connection.execute(sa.text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'feeds' AND column_name = :column
        """), {"column": column})
        
        if result.fetchone():
            op.drop_column('feeds', column)
    
    # Drop index if it exists
    result = connection.execute(sa.text("""
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'feeds' AND indexname = 'idx_feeds_error_count'
    """))
    
    if result.fetchone():
        op.drop_index('idx_feeds_error_count', table_name='feeds')


def downgrade() -> None:
    """Re-add the removed columns."""
    # Re-add columns (for completeness, though these may not be needed)
    op.add_column('feeds', sa.Column('fetch_error_count', sa.INTEGER(), nullable=False, server_default=sa.text('0')))
    op.add_column('feeds', sa.Column('last_error_message', sa.TEXT(), nullable=True))
    op.add_column('feeds', sa.Column('subscriber_count', sa.INTEGER(), nullable=False, server_default=sa.text('0')))
    op.add_column('feeds', sa.Column('average_update_frequency', sa.dialects.postgresql.INTERVAL(), nullable=True))
    
    # Re-create the index
    op.create_index('idx_feeds_error_count', 'feeds', ['fetch_error_count'])
