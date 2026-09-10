"""codex_digests: per-day editions + local digest_date

Adds an ``edition`` column so a user can hold more than one digest per calendar day
(Pro gets 2 "editions", Basic 1). ``digest_date`` now means the *client's local*
calendar day, not UTC - the client sends it on generate, so quota resets at the
user's own midnight without storing a timezone.

Revision ID: c3d1e9f2a7b4
Revises: bd5be628e52e
Create Date: 2026-09-10 12:00:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d1e9f2a7b4"
down_revision: str | None = "bd5be628e52e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "codex_digests",
        sa.Column("edition", sa.SmallInteger(), server_default="1", nullable=False),
    )
    op.drop_constraint("uq_codex_digest_user_date", "codex_digests", type_="unique")
    op.create_unique_constraint(
        "uq_codex_digest_user_date_edition",
        "codex_digests",
        ["user_id", "digest_date", "edition"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_codex_digest_user_date_edition", "codex_digests", type_="unique")
    # Collapsing back to one row per day: keep only the highest edition per (user, day).
    op.execute(
        """
        DELETE FROM codex_digests a
        USING codex_digests b
        WHERE a.user_id = b.user_id
          AND a.digest_date = b.digest_date
          AND a.edition < b.edition
        """
    )
    op.create_unique_constraint(
        "uq_codex_digest_user_date",
        "codex_digests",
        ["user_id", "digest_date"],
    )
    op.drop_column("codex_digests", "edition")
