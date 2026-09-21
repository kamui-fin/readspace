"""Enable row level security on all public tables

No client reads tables through PostgREST, and the backend (table owner) and the
service-role webhooks bypass RLS, so enabling RLS with no policies denies
``anon``/``authenticated`` access without affecting the app. ``profiles`` gets a
SELECT-own-row policy; there is deliberately no UPDATE policy, since users must
not be able to edit their own ``role``.

Revision ID: 9b2e4d6f1a37
Revises: f4a7c2e91b83
Create Date: 2026-09-21 12:00:00.000000+00:00

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9b2e4d6f1a37"
down_revision: str | None = "f4a7c2e91b83"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RLS_TABLES = (
    "profiles",
    "folders",
    "feeds",
    "feed_subscriptions",
    "article_contents",
    "feed_articles",
    "user_entries",
    "codex_digests",
    "codex_preferences",
)


def upgrade() -> None:
    for table in RLS_TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY profiles_select_own ON public.profiles "
        "FOR SELECT USING (id = (SELECT auth.uid()))"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS profiles_select_own ON public.profiles")
    for table in reversed(RLS_TABLES):
        op.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY")
