"""refactor_articles_to_content_structure

Revision ID: 4b2f51f7de01
Revises: e433329eadcb
Create Date: 2025-06-08 23:30:36.541776+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '4b2f51f7de01'
down_revision: Union[str, None] = 'e433329eadcb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema and migrate data."""
    
    # Create new tables first
    op.create_table('article_contents',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('title', sa.Text(), nullable=True),
    sa.Column('link', sa.String(length=2048), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('content', sa.Text(), nullable=True),
    sa.Column('image_url', sa.String(length=2048), nullable=True),
    sa.Column('author', sa.String(length=500), nullable=True),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('estimated_read_time_minutes', sa.Integer(), nullable=True),
    sa.Column('custom_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_article_contents_created_at'), 'article_contents', ['created_at'], unique=False)
    op.create_index(op.f('ix_article_contents_published_at'), 'article_contents', ['published_at'], unique=False)
    
    op.create_table('clipped_articles',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('content_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('folder_id', sa.UUID(), nullable=True),
    sa.Column('priority', sa.String(length=20), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('is_read', sa.Boolean(), nullable=False),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('is_read_later', sa.Boolean(), nullable=False),
    sa.Column('is_favorite', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['content_id'], ['article_contents.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['folder_id'], ['folders.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'content_id', name='uq_clipped_article_user_content')
    )
    op.create_index(op.f('ix_clipped_articles_content_id'), 'clipped_articles', ['content_id'], unique=False)
    op.create_index(op.f('ix_clipped_articles_created_at'), 'clipped_articles', ['created_at'], unique=False)
    op.create_index(op.f('ix_clipped_articles_folder_id'), 'clipped_articles', ['folder_id'], unique=False)
    op.create_index(op.f('ix_clipped_articles_is_favorite'), 'clipped_articles', ['is_favorite'], unique=False)
    op.create_index(op.f('ix_clipped_articles_is_read'), 'clipped_articles', ['is_read'], unique=False)
    op.create_index(op.f('ix_clipped_articles_is_read_later'), 'clipped_articles', ['is_read_later'], unique=False)
    op.create_index(op.f('ix_clipped_articles_user_id'), 'clipped_articles', ['user_id'], unique=False)
    
    op.create_table('feed_articles',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('feed_id', sa.UUID(), nullable=False),
    sa.Column('content_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('guid', sa.String(length=1024), nullable=False),
    sa.Column('is_read', sa.Boolean(), nullable=False),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('is_read_later', sa.Boolean(), nullable=False),
    sa.Column('is_favorite', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['content_id'], ['article_contents.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['feed_id'], ['feeds.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('feed_id', 'guid', name='uq_feed_article_feed_guid')
    )
    op.create_index(op.f('ix_feed_articles_content_id'), 'feed_articles', ['content_id'], unique=False)
    op.create_index(op.f('ix_feed_articles_created_at'), 'feed_articles', ['created_at'], unique=False)
    op.create_index(op.f('ix_feed_articles_feed_id'), 'feed_articles', ['feed_id'], unique=False)
    op.create_index(op.f('ix_feed_articles_guid'), 'feed_articles', ['guid'], unique=False)
    op.create_index(op.f('ix_feed_articles_is_favorite'), 'feed_articles', ['is_favorite'], unique=False)
    op.create_index(op.f('ix_feed_articles_is_read'), 'feed_articles', ['is_read'], unique=False)
    op.create_index(op.f('ix_feed_articles_is_read_later'), 'feed_articles', ['is_read_later'], unique=False)
    op.create_index(op.f('ix_feed_articles_user_id'), 'feed_articles', ['user_id'], unique=False)
    
    # Migrate existing articles data
    connection = op.get_bind()
    
    # Check if articles table exists and has data
    result = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'articles'
        );
    """))
    articles_table_exists = result.scalar()
    
    if articles_table_exists:
        # Get existing articles
        articles = connection.execute(sa.text("""
            SELECT id, feed_id, user_id, guid, title, link, description, content, 
                   image_url, published_at, estimated_read_time_minutes, is_read, 
                   read_at, is_read_later, is_favorite, custom_metadata, 
                   created_at, updated_at
            FROM articles
        """)).fetchall()
        
        # Migrate each article
        for article in articles:
            # First, insert into article_contents
            content_id = connection.execute(sa.text("""
                INSERT INTO article_contents (
                    id, title, link, description, content, image_url, 
                    published_at, estimated_read_time_minutes, custom_metadata,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), :title, :link, :description, :content, :image_url,
                    :published_at, :estimated_read_time_minutes, :custom_metadata,
                    :created_at, :updated_at
                ) RETURNING id
            """), {
                'title': article.title,
                'link': article.link,
                'description': article.description,
                'content': article.content,
                'image_url': article.image_url,
                'published_at': article.published_at,
                'estimated_read_time_minutes': article.estimated_read_time_minutes,
                'custom_metadata': article.custom_metadata,
                'created_at': article.created_at,
                'updated_at': article.updated_at
            }).scalar()
            
            # Then, insert into feed_articles with the same original ID to preserve references
            connection.execute(sa.text("""
                INSERT INTO feed_articles (
                    id, feed_id, content_id, user_id, guid, is_read, read_at,
                    is_read_later, is_favorite, created_at, updated_at
                ) VALUES (
                    :id, :feed_id, :content_id, :user_id, :guid, :is_read, :read_at,
                    :is_read_later, :is_favorite, :created_at, :updated_at
                )
            """), {
                'id': article.id,
                'feed_id': article.feed_id,
                'content_id': content_id,
                'user_id': article.user_id,
                'guid': article.guid,
                'is_read': article.is_read,
                'read_at': article.read_at,
                'is_read_later': article.is_read_later,
                'is_favorite': article.is_favorite,
                'created_at': article.created_at,
                'updated_at': article.updated_at
            })
    
    # Drop old articles table
    op.drop_index('ix_articles_created_at', table_name='articles')
    op.drop_index('ix_articles_feed_id', table_name='articles')
    op.drop_index('ix_articles_guid', table_name='articles')
    op.drop_index('ix_articles_is_favorite', table_name='articles')
    op.drop_index('ix_articles_is_read', table_name='articles')
    op.drop_index('ix_articles_is_read_later', table_name='articles')
    op.drop_index('ix_articles_published_at', table_name='articles')
    op.drop_index('ix_articles_user_id', table_name='articles')
    op.drop_table('articles')


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('articles',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('feed_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('user_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('guid', sa.VARCHAR(length=1024), autoincrement=False, nullable=False),
    sa.Column('title', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('link', sa.VARCHAR(length=2048), autoincrement=False, nullable=False),
    sa.Column('description', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('content', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('image_url', sa.VARCHAR(length=2048), autoincrement=False, nullable=True),
    sa.Column('published_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('estimated_read_time_minutes', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('is_read', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('read_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('is_read_later', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('is_favorite', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('custom_metadata', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['feed_id'], ['feeds.id'], name='articles_feed_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], name='articles_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='articles_pkey'),
    sa.UniqueConstraint('feed_id', 'guid', name='uq_article_feed_guid', postgresql_include=[], postgresql_nulls_not_distinct=False)
    )
    op.create_index('ix_articles_user_id', 'articles', ['user_id'], unique=False)
    op.create_index('ix_articles_published_at', 'articles', ['published_at'], unique=False)
    op.create_index('ix_articles_is_read_later', 'articles', ['is_read_later'], unique=False)
    op.create_index('ix_articles_is_read', 'articles', ['is_read'], unique=False)
    op.create_index('ix_articles_is_favorite', 'articles', ['is_favorite'], unique=False)
    op.create_index('ix_articles_guid', 'articles', ['guid'], unique=False)
    op.create_index('ix_articles_feed_id', 'articles', ['feed_id'], unique=False)
    op.create_index('ix_articles_created_at', 'articles', ['created_at'], unique=False)
    op.drop_index(op.f('ix_feed_articles_user_id'), table_name='feed_articles')
    op.drop_index(op.f('ix_feed_articles_is_read_later'), table_name='feed_articles')
    op.drop_index(op.f('ix_feed_articles_is_read'), table_name='feed_articles')
    op.drop_index(op.f('ix_feed_articles_is_favorite'), table_name='feed_articles')
    op.drop_index(op.f('ix_feed_articles_guid'), table_name='feed_articles')
    op.drop_index(op.f('ix_feed_articles_feed_id'), table_name='feed_articles')
    op.drop_index(op.f('ix_feed_articles_created_at'), table_name='feed_articles')
    op.drop_index(op.f('ix_feed_articles_content_id'), table_name='feed_articles')
    op.drop_table('feed_articles')
    op.drop_index(op.f('ix_clipped_articles_user_id'), table_name='clipped_articles')
    op.drop_index(op.f('ix_clipped_articles_is_read_later'), table_name='clipped_articles')
    op.drop_index(op.f('ix_clipped_articles_is_read'), table_name='clipped_articles')
    op.drop_index(op.f('ix_clipped_articles_is_favorite'), table_name='clipped_articles')
    op.drop_index(op.f('ix_clipped_articles_folder_id'), table_name='clipped_articles')
    op.drop_index(op.f('ix_clipped_articles_created_at'), table_name='clipped_articles')
    op.drop_index(op.f('ix_clipped_articles_content_id'), table_name='clipped_articles')
    op.drop_table('clipped_articles')
    op.drop_index(op.f('ix_article_contents_published_at'), table_name='article_contents')
    op.drop_index(op.f('ix_article_contents_created_at'), table_name='article_contents')
    op.drop_table('article_contents')
    # ### end Alembic commands ###
