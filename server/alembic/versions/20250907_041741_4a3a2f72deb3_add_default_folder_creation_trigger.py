"""add_default_folder_creation_trigger

Revision ID: 4a3a2f72deb3
Revises: 6a462ec22898
Create Date: 2025-09-07 04:17:41.518054+00:00

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4a3a2f72deb3"
down_revision: str | None = "6a462ec22898"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add function and trigger to automatically create default folder for new users."""

    # Create function to automatically create default folder
    op.execute("""
        CREATE OR REPLACE FUNCTION create_default_folder_for_user()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO public.folders (id, name, user_id, created_at, updated_at)
            VALUES (
                gen_random_uuid(),
                'My Feeds',
                NEW.id,
                NOW(),
                NOW()
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create trigger to call function when new user is created
    op.execute("""
        CREATE TRIGGER trigger_create_default_folder
        AFTER INSERT ON profiles
        FOR EACH ROW
        EXECUTE FUNCTION create_default_folder_for_user();
    """)


def downgrade() -> None:
    """Remove the trigger and function."""
    op.execute("DROP TRIGGER IF EXISTS trigger_create_default_folder ON profiles;")
    op.execute("DROP FUNCTION IF EXISTS create_default_folder_for_user();")
