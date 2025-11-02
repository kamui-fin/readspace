"""Add additional CHECK constraints for data integrity

Revision ID: 6af6f682f204
Revises: add_unique_constraints
Create Date: 2025-11-02 18:00:09.000000+00:00

This migration adds additional CHECK constraints and optimizations:
1. CHECK constraint on feeds.language for valid ISO 639-1 codes
2. CHECK constraint on feeds.adaptive_fetch_interval_minutes for valid range
3. CHECK constraint on clipped_articles.priority for valid values
4. UNIQUE constraint on profiles.email
5. CHECK constraint on profiles.role for valid user roles
6. Reduce feeds.last_error_message from TEXT to VARCHAR(2000)
7. Reduce article_contents.description from VARCHAR(5000) to VARCHAR(2000)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6af6f682f204"
down_revision: str | None = "add_unique_constraints"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add CHECK constraints and schema optimizations."""

    # ============================================================================
    # ADD CHECK CONSTRAINTS
    # ============================================================================

    # CHECK constraint on feeds.language for valid ISO 639-1 codes (2 letter codes)
    # Ensures language codes are properly normalized
    print("Adding CHECK constraint on feeds.language...")
    op.create_check_constraint(
        "ck_feed_language_format",
        "feeds",
        sa.text("language IS NULL OR (LENGTH(language) = 2 AND language ~ '^[a-z]{2}$')"),
    )

    # CHECK constraint on feeds.adaptive_fetch_interval_minutes for valid range
    # Prevents negative values and unreasonably short/long intervals
    # Typical range: 5 minutes to 7 days (10080 minutes)
    print("Adding CHECK constraint on feeds.adaptive_fetch_interval_minutes...")
    op.create_check_constraint(
        "ck_feed_adaptive_interval_range",
        "feeds",
        sa.text(
            "adaptive_fetch_interval_minutes IS NULL OR (adaptive_fetch_interval_minutes >= 5 AND adaptive_fetch_interval_minutes <= 10080)"
        ),
    )

    # CHECK constraint on clipped_articles.priority for valid values
    # Ensures priority is one of: low, medium, high
    print("Adding CHECK constraint on clipped_articles.priority...")
    op.create_check_constraint(
        "ck_clipped_article_priority",
        "clipped_articles",
        sa.text("priority IN ('low', 'medium', 'high')"),
    )

    # CHECK constraint on profiles.role for valid user roles
    # Ensures role is one of: basic, pro, admin
    print("Adding CHECK constraint on profiles.role...")
    op.create_check_constraint(
        "ck_profile_role",
        "profiles",
        sa.text("role IN ('basic', 'pro', 'admin')"),
    )

    # ============================================================================
    # ADD UNIQUE CONSTRAINT ON PROFILE EMAIL
    # ============================================================================

    # First, check for and handle duplicate emails
    print("Checking for duplicate profile emails...")

    # Find duplicates and keep the earliest created profile
    op.execute("""
        DELETE FROM profiles
        WHERE id IN (
            SELECT id
            FROM (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY LOWER(TRIM(email))
                        ORDER BY created_at ASC, id ASC
                    ) as row_num
                FROM profiles
            ) ranked
            WHERE row_num > 1
        )
    """)

    # Add UNIQUE constraint on profiles.email
    # This prevents duplicate accounts with the same email
    print("Adding UNIQUE constraint on profiles.email...")
    op.create_unique_constraint("uq_profile_email", "profiles", ["email"])

    # ============================================================================
    # SCHEMA OPTIMIZATIONS
    # ============================================================================

    # Reduce feeds.last_error_message from TEXT to VARCHAR(2000)
    # Error messages don't need to be unbounded, this improves query performance
    print("Reducing feeds.last_error_message column size to VARCHAR(2000)...")

    # First, truncate any error messages longer than 2000 chars
    op.execute("""
        UPDATE feeds
        SET last_error_message = LEFT(last_error_message, 1997) || '...'
        WHERE LENGTH(last_error_message) > 2000
    """)

    # Then alter the column type
    op.alter_column(
        "feeds",
        "last_error_message",
        type_=sa.String(2000),
        existing_type=sa.Text(),
        existing_nullable=True,
    )

    # Reduce article_contents.description from VARCHAR(5000) to VARCHAR(2000)
    # Most article descriptions are < 1000 chars, this saves storage
    print("Reducing article_contents.description column size to VARCHAR(2000)...")

    # First, truncate any descriptions longer than 2000 chars
    op.execute("""
        UPDATE article_contents
        SET description = LEFT(description, 1997) || '...'
        WHERE LENGTH(description) > 2000
    """)

    # Then alter the column type
    op.alter_column(
        "article_contents",
        "description",
        type_=sa.String(2000),
        existing_type=sa.String(5000),
        existing_nullable=True,
    )

    print("Migration completed successfully!")


def downgrade() -> None:
    """Remove CHECK constraints, UNIQUE constraint, and revert schema changes."""

    # ============================================================================
    # REVERT SCHEMA OPTIMIZATIONS
    # ============================================================================

    # Restore article_contents.description to VARCHAR(5000)
    op.alter_column(
        "article_contents",
        "description",
        type_=sa.String(5000),
        existing_type=sa.String(2000),
        existing_nullable=True,
    )

    # Restore feeds.last_error_message to TEXT
    op.alter_column(
        "feeds",
        "last_error_message",
        type_=sa.Text(),
        existing_type=sa.String(2000),
        existing_nullable=True,
    )

    # ============================================================================
    # REMOVE UNIQUE CONSTRAINT
    # ============================================================================

    # Drop UNIQUE constraint on profiles.email
    op.drop_constraint("uq_profile_email", "profiles", type_="unique")

    # ============================================================================
    # REMOVE CHECK CONSTRAINTS
    # ============================================================================

    # Drop CHECK constraints
    op.drop_constraint("ck_profile_role", "profiles", type_="check")
    op.drop_constraint("ck_clipped_article_priority", "clipped_articles", type_="check")
    op.drop_constraint("ck_feed_adaptive_interval_range", "feeds", type_="check")
    op.drop_constraint("ck_feed_language_format", "feeds", type_="check")
