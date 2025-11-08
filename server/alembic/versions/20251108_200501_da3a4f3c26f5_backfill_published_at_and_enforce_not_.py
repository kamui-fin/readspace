"""backfill_published_at_and_enforce_not_null

Revision ID: da3a4f3c26f5
Revises: comprehensive_optimization
Create Date: 2025-11-08 20:05:01.269587+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da3a4f3c26f5'
down_revision: Union[str, None] = 'comprehensive_optimization'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Backfill NULL published_at values using created_at
    op.execute("""
        UPDATE article_contents
        SET published_at = created_at
        WHERE published_at IS NULL
    """)
    
    # 2. Enforce NOT NULL constraint
    op.alter_column('article_contents', 'published_at',
                    existing_type=sa.DateTime(timezone=True),
                    nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Remove NOT NULL constraint
    op.alter_column('article_contents', 'published_at',
                    existing_type=sa.DateTime(timezone=True),
                    nullable=True)
