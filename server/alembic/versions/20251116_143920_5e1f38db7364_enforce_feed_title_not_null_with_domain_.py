"""enforce_feed_title_not_null_with_domain_fallback

Revision ID: 5e1f38db7364
Revises: 2c64438ca2f3
Create Date: 2025-11-16 14:39:20.453060+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5e1f38db7364'
down_revision: Union[str, None] = '2c64438ca2f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Backfill NULL or empty title values using domain extraction from URL or link
    # This SQL function extracts the domain from a URL (removes protocol, www, port, and path)
    op.execute("""
        UPDATE feeds
        SET title = CASE
            -- If link exists and is not empty, use it
            WHEN link IS NOT NULL AND link != '' THEN
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        REGEXP_REPLACE(
                            CASE
                                WHEN link LIKE '%://%' THEN SPLIT_PART(link, '://', 2)
                                ELSE link
                            END,
                            '^www\\.', ''  -- Remove www. prefix
                        ),
                        ':[0-9]+',  ''  -- Remove port number
                    ),
                    '/.*$', ''  -- Remove path and everything after
                )
            -- Otherwise use url
            ELSE
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        REGEXP_REPLACE(
                            CASE
                                WHEN url LIKE '%://%' THEN SPLIT_PART(url, '://', 2)
                                ELSE url
                            END,
                            '^www\\.', ''  -- Remove www. prefix
                        ),
                        ':[0-9]+', ''  -- Remove port number
                    ),
                    '/.*$', ''  -- Remove path and everything after
                )
        END
        WHERE title IS NULL OR title = ''
    """)

    # 2. Enforce NOT NULL constraint on title column
    op.alter_column('feeds', 'title',
                    existing_type=sa.String(length=500),
                    nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Remove NOT NULL constraint
    op.alter_column('feeds', 'title',
                    existing_type=sa.String(length=500),
                    nullable=True)
