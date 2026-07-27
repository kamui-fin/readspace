"""add is_onboarded to profiles

Revision ID: a1b2c3d4e5f6
Revises: 20260614_022600_d236de8fdfdf_add_newsletter_token
Create Date: 2026-06-27 17:38:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "60a75bd16b34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("is_onboarded", sa.Boolean(), nullable=False, server_default=sa.text("false")))


def downgrade() -> None:
    op.drop_column("profiles", "is_onboarded")
