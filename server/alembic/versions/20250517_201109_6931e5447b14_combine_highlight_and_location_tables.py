"""combine highlight and location tables

Revision ID: 6931e5447b14
Revises: 2c975cea25e6
Create Date: 2025-05-17 20:11:09.693

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '6931e5447b14'
down_revision: Union[str, None] = '2c975cea25e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to highlights table
    op.add_column('highlights', sa.Column('chapter_idx', sa.Integer(), nullable=True))
    op.add_column('highlights', sa.Column('chapter_href', sa.Text(), nullable=True))
    op.add_column('highlights', sa.Column('chapter_title', sa.Text(), nullable=True))
    op.add_column('highlights', sa.Column('page', sa.Integer(), nullable=True))
    op.add_column('highlights', sa.Column('html_range', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('highlights', sa.Column('pdf_rect_position', postgresql.JSON(astext_type=sa.Text()), nullable=True))

    # Migrate data from highlight_locations to highlights
    op.execute("""
        UPDATE highlights h
        SET 
            chapter_idx = hl.chapter_idx,
            chapter_href = hl.chapter_href,
            chapter_title = hl.chapter_title,
            page = hl.page,
            html_range = hl.html_range,
            pdf_rect_position = hl.pdf_rect_position
        FROM highlight_locations hl
        WHERE hl.highlight_id = h.id
    """)

    # Drop the highlight_locations table
    op.drop_table('highlight_locations')

    # Remove timestamp columns from highlights
    op.drop_column('highlights', 'created_at')
    op.drop_column('highlights', 'updated_at')
    op.drop_column('book_metadata', 'updated_at')


def downgrade() -> None:
    # Recreate highlight_locations table
    op.create_table('highlight_locations',
        sa.Column('id', postgresql.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('highlight_id', postgresql.UUID(), nullable=False),
        sa.Column('chapter_idx', sa.Integer(), nullable=True),
        sa.Column('chapter_href', sa.Text(), nullable=True),
        sa.Column('chapter_title', sa.Text(), nullable=True),
        sa.Column('page', sa.Integer(), nullable=True),
        sa.Column('html_range', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('pdf_rect_position', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['highlight_id'], ['highlights.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Migrate data back to highlight_locations
    op.execute("""
        INSERT INTO highlight_locations (
            highlight_id, chapter_idx, chapter_href, chapter_title,
            page, html_range, pdf_rect_position, created_at
        )
        SELECT 
            id, chapter_idx, chapter_href, chapter_title,
            page, html_range, pdf_rect_position, NOW()
        FROM highlights
        WHERE chapter_idx IS NOT NULL
    """)

    # Remove location columns from highlights
    op.drop_column('highlights', 'chapter_idx')
    op.drop_column('highlights', 'chapter_href')
    op.drop_column('highlights', 'chapter_title')
    op.drop_column('highlights', 'page')
    op.drop_column('highlights', 'html_range')
    op.drop_column('highlights', 'pdf_rect_position')

    # Add back timestamp columns
    op.add_column('highlights', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('highlights', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('book_metadata', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
