"""schema_unification_and_optimization

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
down_revision: Union[str, None] = '449f9b660af6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Step 1: Prep & Cleanup ---
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    
    op.drop_index('ix_folders_user_id', table_name='folders', if_exists=True)
    op.drop_index('idx_ac_published_at_desc', table_name='article_contents', if_exists=True)
    op.drop_index('idx_feed_articles_feed_content', table_name='feed_articles', if_exists=True)
    
    # --- Step 2: Update Article Contents (Text Conversion + Hashing) ---
    print("Migrating article_contents...")
    
    # 2a. Add content_hash
    op.add_column('article_contents', sa.Column('content_hash', sa.CHAR(64), nullable=True))
    op.execute("""
        UPDATE article_contents 
        SET content_hash = encode(digest(lower(trim(link)), 'sha256'), 'hex')
    """)
    op.alter_column('article_contents', 'content_hash', nullable=False)
    
    # 2b. Convert to TEXT (Safety)
    op.alter_column('article_contents', 'title', existing_type=sa.VARCHAR(), type_=sa.Text())
    op.alter_column('article_contents', 'description', existing_type=sa.VARCHAR(), type_=sa.Text())
    op.alter_column('article_contents', 'content', existing_type=sa.VARCHAR(), type_=sa.Text())
    op.alter_column('article_contents', 'link', existing_type=sa.VARCHAR(), type_=sa.Text(), nullable=False)
    op.alter_column('article_contents', 'image_url', existing_type=sa.VARCHAR(), type_=sa.Text())
    op.alter_column('article_contents', 'author', existing_type=sa.VARCHAR(), type_=sa.Text())

    # 2c. Constraints
    try:
        op.drop_constraint('uq_article_contents_link', 'article_contents', type_='unique')
    except Exception:
        pass
    op.create_unique_constraint('uq_article_contents_hash', 'article_contents', ['content_hash'])

    # --- Step 3: Update Feed Articles (Add Date & Hash) ---
    print("Updating feed_articles...")
    op.add_column('feed_articles', sa.Column('published_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('feed_articles', sa.Column('guid_hash', sa.CHAR(64), nullable=True))
    
    # 3a. Populate published_at FROM article_contents (Before we drop it)
    op.execute("""
        UPDATE feed_articles fa
        SET published_at = ac.published_at
        FROM article_contents ac
        WHERE fa.content_id = ac.id
    """)
    
    # 3b. Populate guid_hash
    op.execute("""
        UPDATE feed_articles fa
        SET guid_hash = encode(digest(COALESCE(NULLIF(trim(fa.guid), ''), (SELECT link FROM article_contents WHERE id = fa.content_id)), 'sha256'), 'hex')
    """)
    
    # 3c. Finalize Columns
    op.alter_column('feed_articles', 'published_at', nullable=False)
    op.alter_column('feed_articles', 'guid_hash', nullable=False)
    
    op.drop_index('idx_feed_articles_feed_guid', table_name='feed_articles', if_exists=True)
    op.create_unique_constraint('uq_feed_articles_feed_guid_hash', 'feed_articles', ['feed_id', 'guid_hash'])
    op.create_index('idx_feed_articles_feed_published', 'feed_articles', ['feed_id', sa.text('published_at DESC')])
    
    op.drop_column('feed_articles', 'guid')
    op.drop_column('feed_articles', 'updated_at')
    
    # --- Step 4: Create User Entries ---
    print("Creating user_entries...")
    op.create_table(
        'user_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('feed_article_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_read', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('is_read_later', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('priority', sa.String(20), server_default='MEDIUM', nullable=False),
        sa.Column('read_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('user_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'content_id', name='uq_user_entry_content'),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['content_id'], ['article_contents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['feed_article_id'], ['feed_articles.id'], ondelete='CASCADE')
    )
    
    # --- Step 5: Data Migration ---
    print("Migrating user data...")
    op.execute("""
        INSERT INTO user_entries (
            user_id, content_id, feed_article_id, is_read, is_read_later, 
            read_at, user_note, created_at, updated_at
        )
        SELECT 
            uas.user_id, fa.content_id, uas.article_id, uas.is_read, uas.is_read_later,
            uas.read_at, uas.user_note, uas.created_at, uas.updated_at
        FROM user_article_states uas
        JOIN feed_articles fa ON uas.article_id = fa.id
        ON CONFLICT (user_id, content_id) DO NOTHING
    """)
    
    op.execute("""
        INSERT INTO user_entries (
            user_id, content_id, is_read, is_read_later, priority, 
            user_note, created_at, updated_at
        )
        SELECT 
            user_id, content_id, is_read, is_read_later, priority::text, 
            note, created_at, created_at
        FROM clipped_articles
        ON CONFLICT (user_id, content_id) DO UPDATE SET
            is_read_later = EXCLUDED.is_read_later OR user_entries.is_read_later,
            user_note = COALESCE(user_entries.user_note, EXCLUDED.user_note)
    """)
    
    # --- Step 6: Update Feeds Table ---
    print("Updating feeds...")
    op.add_column('feeds', sa.Column('next_fetch_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.create_index('ix_feeds_next_fetch_at', 'feeds', ['next_fetch_at'])
    
    op.alter_column('feeds', 'url', existing_type=sa.VARCHAR(), type_=sa.Text(), nullable=False)
    op.alter_column('feeds', 'title', existing_type=sa.VARCHAR(), type_=sa.Text(), nullable=False)
    op.alter_column('feeds', 'description', existing_type=sa.VARCHAR(), type_=sa.Text())
    op.alter_column('feeds', 'link', existing_type=sa.VARCHAR(), type_=sa.Text())
    op.alter_column('feeds', 'image_url', existing_type=sa.VARCHAR(), type_=sa.Text())
    
    op.drop_column('feeds', 'updated_at')

    # --- Step 7: Clean up ---
    print("Dropping legacy columns and tables...")
    op.drop_table('user_article_states')
    op.drop_table('clipped_articles')
    
    op.drop_column('article_contents', 'created_at')
    op.drop_column('article_contents', 'updated_at')
    op.drop_column('article_contents', 'published_at')
    op.drop_column('article_contents', 'custom_metadata')
    
    op.drop_column('feed_subscriptions', 'updated_at')
    op.execute("""
        CREATE OR REPLACE FUNCTION public.create_default_folder_for_user()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO public.folders (id, name, user_id, created_at)
            VALUES (
                gen_random_uuid(),
                'My Feeds',
                NEW.id,
                NOW()
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.drop_column('folders', 'updated_at')
    
    print("Migration complete!")


def downgrade() -> None:
    raise NotImplementedError("Downgrade not supported.")