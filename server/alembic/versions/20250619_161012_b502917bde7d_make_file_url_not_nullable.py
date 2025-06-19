"""make_file_url_not_nullable

Revision ID: b502917bde7d
Revises: 2fe4797a0f90
Create Date: 2025-06-19 16:10:12.063659+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b502917bde7d'
down_revision: Union[str, None] = '2fe4797a0f90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # First, update any existing NULL file_url values to empty string
    op.execute("UPDATE book_metadata SET file_url = '' WHERE file_url IS NULL")
    
    # Now make the column not nullable
    op.alter_column('book_metadata', 'file_url', nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Make the column nullable again
    op.alter_column('book_metadata', 'file_url', nullable=True)
