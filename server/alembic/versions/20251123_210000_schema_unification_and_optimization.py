"""schema_unification_and_optimization

This migration implements the complete schema refactoring:
1. Unifies clipped_articles and user_article_states into user_entries
2. Denormalizes published_at to feed_articles for performance
3. Uses SHA-256 hashes for content and GUID uniqueness
4. Removes updated_at from immutable tables

Revision ID: 7f8a9b1c2d3e
Revises: 449f9b660af6
Create Date: 2025-11-23 21:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7f8a9b1c2d3e'
down_revision: Union[str, None] = '449f9b660af6'  # Replace with your actual previous revision ID
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with unified user_entries and hash-based deduplication."""
    
    # Step 1: Enable pgcrypto extension for SHA-256 hashing
    # We use execute to ensure it runs even if user doesn't have superuser (if extension exists)
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    
    # Step 1.5: Drop redundant indexes before schema changes
    print("Dropping redundant indexes...")
    
    # Drop existing indexes if they exist to prevent conflicts
    op.drop_index('ix_folders_user_id', table_name='folders', if_exists=True)
    op.drop_index('idx_ac_published_at_desc', table_name='article_contents', if_exists=True)
    op.drop_index('idx_feed_articles_feed_content', table_name='feed_articles', if_exists=True)
    
    # Step 2: Alter article_contents - Add content_hash
    print("Adding content_hash to article_contents...")
    op.add_column('article_contents', 
                  sa.Column('content_hash', sa.CHAR(64), nullable=True))
    
    # Populate content_hash with SHA-256 of normalized link
    op.execute("""
        UPDATE article_contents 
        SET content_hash = encode(digest(lower(trim(link)), 'sha256'), 'hex')
    """)
    
    # Make content_hash NOT NULL
    op.alter_column('article_contents', 'content_hash', nullable=False)
    
    # Drop old unique constraint on link and add new one on hash
    # Note: Using generic name or the specific one from your dump if known
    try:
        op.drop_constraint('uq_article_contents_link', 'article_contents', type_='unique')
    except Exception:
        print("Warning: Could not drop uq_article_contents_link, might not exist or diff name")

    op.create_unique_constraint('uq_article_contents_hash', 'article_contents', ['content_hash'])
    
    # Step 3: Alter feed_articles - Add published_at and guid_hash
    print("Adding published_at and guid_hash to feed_articles...")
    op.add_column('feed_articles',
                  sa.Column('published_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('feed_articles',
                  sa.Column('guid_hash', sa.CHAR(64), nullable=True))
    
    # Populate published_at from article_contents
    op.execute("""
        UPDATE feed_articles fa
        SET published_at = ac.published_at
        FROM article_contents ac
        WHERE fa.content_id = ac.id
    """)
    
    # Populate guid_hash (use guid if exists, fallback to link if guid is null/empty)
    # The subquery gets the link from article_contents if the guid is missing
    op.execute("""
        UPDATE feed_articles fa
        SET guid_hash = encode(
            digest(
                COALESCE(
                    NULLIF(trim(fa.guid), ''),
                    (SELECT link FROM article_contents WHERE id = fa.content_id)
                ),
                'sha256'
            ),
            'hex'
        )
    """)
    
    # Make columns NOT NULL
    op.alter_column('feed_articles', 'published_at', nullable=False)
    op.alter_column('feed_articles', 'guid_hash', nullable=False)
    
    # Drop old unique index/constraint on (feed_id, guid)
    # Based on your dump, this was likely an index "idx_feed_articles_feed_guid" or constraint
    op.drop_index('idx_feed_articles_feed_guid', table_name='feed_articles', if_exists=True)
    
    # Add unique constraint for (feed_id, guid_hash)
    op.create_unique_constraint('uq_feed_articles_feed_guid_hash', 
                               'feed_articles', ['feed_id', 'guid_hash'])
    
    # Drop guid column (no longer needed)
    op.drop_column('feed_articles', 'guid')
    
    # Add performance index for feed listing (Composite Index)
    op.create_index('idx_feed_articles_feed_published',
                   'feed_articles', ['feed_id', sa.text('published_at DESC')])
    
    # Step 4: Create user_entries table
    print("Creating user_entries table...")
    op.create_table(
        'user_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), 
                 server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('feed_article_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # State flags
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_read_later', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_favorite', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'),
        # Kept priority as requested, though optional
        sa.Column('priority', sa.String(20), nullable=False, server_default='MEDIUM'),
        
        # Metadata
        sa.Column('read_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('user_note', sa.Text(), nullable=True),
        sa.Column('user_tags', postgresql.ARRAY(sa.String()), nullable=True),
        
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), 
                 server_default=sa.text('now()'), nullable=False),
        # Crucial: updated_at kept for state tables
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), 
                 server_default=sa.text('now()'), nullable=False),
        
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'content_id', name='uq_user_entry_content'),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['content_id'], ['article_contents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['feed_article_id'], ['feed_articles.id'], ondelete='CASCADE')
    )
    
    # Create partial index for "Read Later" view
    op.create_index('idx_user_entries_read_later',
                   'user_entries', ['user_id', sa.text('created_at DESC')],
                   postgresql_where=sa.text('is_read_later = true'))
    
    # Step 5: Migrate data from user_article_states
    print("Migrating data from user_article_states...")
    # Using explicit columns to map old schema to new schema
    op.execute("""
        INSERT INTO user_entries (
            user_id, content_id, feed_article_id, 
            is_read, is_read_later, is_favorite,
            read_at, user_note, user_tags, created_at, updated_at
        )
        SELECT 
            uas.user_id,
            fa.content_id,
            uas.article_id,
            uas.is_read,
            uas.is_read_later,
            uas.is_favorite,
            uas.read_at,
            uas.user_note,
            uas.user_tags,
            uas.created_at,
            uas.updated_at
        FROM user_article_states uas
        JOIN feed_articles fa ON uas.article_id = fa.id
        ON CONFLICT (user_id, content_id) DO NOTHING
    """)
    
    # Step 6: Migrate data from clipped_articles
    print("Migrating data from clipped_articles...")
    # clipped_articles already has content_id, so direct map is easy.
    # We use DO UPDATE to merge flags if an entry already exists from step 5.
    op.execute("""
        INSERT INTO user_entries (
            user_id, content_id,
            is_read, is_read_later, is_favorite, priority,
            user_note, created_at, updated_at
        )
        SELECT 
            user_id,
            content_id,
            is_read,
            is_read_later,
            is_favorite,
            priority::text, -- Cast enum to text/string if needed
            note,
            created_at,
            created_at -- clipped_articles didn't have updated_at, use created_at
        FROM clipped_articles
        ON CONFLICT (user_id, content_id) 
        DO UPDATE SET
            is_read_later = EXCLUDED.is_read_later OR user_entries.is_read_later,
            is_favorite = EXCLUDED.is_favorite OR user_entries.is_favorite,
            user_note = COALESCE(user_entries.user_note, EXCLUDED.user_note)
    """)
    
    # Step 7: Drop old tables
    print("Dropping legacy tables...")
    op.drop_table('user_article_states')
    op.drop_table('clipped_articles')
    
    # Step 8: Remove updated_at from immutable/heavy tables
    print("Removing updated_at from immutable tables...")
    op.drop_column('feed_articles', 'updated_at')
    
    # Removing created_at and updated_at from article_contents
    op.drop_column('article_contents', 'created_at')
    op.drop_column('article_contents', 'updated_at')
    
    print("Migration complete!")


def downgrade() -> None:
    """Downgrade schema (Not implemented for this complex refactor)."""
    # NOTE: Downgrading a destructive merge like this is extremely complex 
    # and risks data loss. It is recommended to restore from backup if this fails.
    raise NotImplementedError("Downgrade not supported for schema unification.")