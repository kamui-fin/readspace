"""merge heads

Revision ID: 1eae79755f88
Revises: d9657003e235, 9a70c1d1a21f
Create Date: 2025-08-27 01:23:42.938746+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1eae79755f88'
down_revision: Union[str, None] = ('d9657003e235', '9a70c1d1a21f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
