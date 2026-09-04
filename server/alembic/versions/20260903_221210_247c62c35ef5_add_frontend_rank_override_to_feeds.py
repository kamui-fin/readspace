"""add frontend_rank_override to feeds

Revision ID: 247c62c35ef5
Revises: a1b2c3d4e5f6
Create Date: 2026-09-03 22:12:10.387794+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '247c62c35ef5'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "feeds",
        sa.Column("frontend_rank_override", sa.Integer(), nullable=False, server_default="9999"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("feeds", "frontend_rank_override")
