"""init books & highlights schema

Revision ID: 2c975cea25e6
Revises: 
Create Date: 2025-05-15 19:15:54.719003+00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '2c975cea25e6'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create profiles table
    op.create_table('profiles',
        sa.Column('id', postgresql.UUID(), nullable=False),
        sa.Column('email', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create trigger function
    op.execute("""
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger AS $$
    BEGIN
        INSERT INTO public.profiles (id, email, created_at, updated_at)
        VALUES (new.id, new.email, new.created_at, new.updated_at);
        RETURN new;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    # Create trigger
    op.execute("""
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    """)

    # Create book_metadata table
    op.create_table('book_metadata',
        sa.Column('id', postgresql.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('author', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover_url', sa.Text(), nullable=True),
        sa.Column('file_url', sa.Text(), nullable=True),
        sa.Column('format', postgresql.ENUM('epub', 'pdf', name='bookformat'), nullable=False),
        sa.Column('num_pages', sa.Integer(), nullable=True),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=True),
        sa.Column('epub_chapter_char_counts', postgresql.ARRAY(sa.Integer()), nullable=True),
        sa.Column('epub_page_char_counts', postgresql.ARRAY(sa.Integer()), nullable=True),
        sa.Column('pdf_toc', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create user_book_library table
    op.create_table('user_book_library',
        sa.Column('id', postgresql.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(), nullable=False),
        sa.Column('book_metadata_id', postgresql.UUID(), nullable=False),
        sa.Column('date_added', sa.DateTime(timezone=True), nullable=False),
        sa.Column('epub_progress', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('pdf_current_page', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['book_metadata_id'], ['book_metadata.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'book_metadata_id', name='uix_user_book')
    )

    # Create highlights table
    op.create_table('highlights',
        sa.Column('id', postgresql.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_book_lib_id', postgresql.UUID(), nullable=False),
        sa.Column('color', postgresql.ENUM('yellow', 'green', 'blue', name='highlightcolor'), nullable=False),
        sa.Column('original_text', sa.Text(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_book_lib_id'], ['user_book_library.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create highlight_locations table
    op.create_table('highlight_locations',
        sa.Column('id', postgresql.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('highlight_id', postgresql.UUID(), nullable=False),
        sa.Column('chapter_idx', sa.Integer(), nullable=True),
        sa.Column('chapter_href', sa.Text(), nullable=True),
        sa.Column('chapter_title', sa.Text(), nullable=True),
        sa.Column('page', sa.Integer(), nullable=True),
        sa.Column('html_range', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('pdf_rect_position', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['highlight_id'], ['highlights.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('highlight_locations')
    op.drop_table('highlights')
    op.drop_table('user_book_library')
    op.drop_table('book_metadata')
    
    # Drop trigger and function
    op.execute('DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;')
    op.execute('DROP FUNCTION IF EXISTS public.handle_new_user();')
    
    # Drop profiles table
    op.drop_table('profiles')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS highlightcolor;')
    op.execute('DROP TYPE IF EXISTS bookformat;') 