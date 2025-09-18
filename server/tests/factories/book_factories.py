"""
Factory classes for book-related models
"""

import uuid
from datetime import datetime, timezone

import factory
from factory import SubFactory
from factory.alchemy import SQLAlchemyModelFactory

from app.models.book_models import (
    BookFormat,
    BookMetadata,
    Highlight,
    HighlightColor,
    UserBookLibrary,
)


class BookMetadataFactory(SQLAlchemyModelFactory):
    """Factory for BookMetadata model"""

    class Meta:
        model = BookMetadata
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid.uuid4)
    title = factory.Faker("sentence", nb_words=4)
    author = factory.Faker("name")
    description = factory.Faker("text", max_nb_chars=500)
    cover_url = factory.Faker("image_url")
    file_url = factory.Faker("url")
    format = factory.Faker("random_element", elements=[BookFormat.EPUB, BookFormat.PDF])
    num_pages = factory.Faker("random_int", min=50, max=500)
    file_size_bytes = factory.Faker("random_int", min=1024 * 1024, max=50 * 1024 * 1024)  # 1MB to 50MB
    epub_chapter_char_counts = factory.LazyAttribute(
        lambda obj: [2500 + (i * 200) for i in range(10)] if obj.format == BookFormat.EPUB else None
    )
    epub_page_char_counts = factory.LazyAttribute(
        lambda obj: [400 + (i % 100) for i in range(200)] if obj.format == BookFormat.EPUB else None
    )
    pdf_toc = factory.LazyAttribute(
        lambda obj: {"chapters": [{"title": f"Chapter {i}", "page": i * 10} for i in range(1, 6)]}
        if obj.format == BookFormat.PDF
        else None
    )
    created_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))


class UserBookLibraryFactory(SQLAlchemyModelFactory):
    """Factory for UserBookLibrary model"""

    class Meta:
        model = UserBookLibrary
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid.uuid4)
    # user_id must be provided when creating user book library entries
    book_metadata = SubFactory(BookMetadataFactory)
    book_metadata_id = factory.LazyAttribute(lambda obj: obj.book_metadata.id)
    date_added = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    epub_progress = factory.LazyAttribute(
        lambda obj: {
            "current_chapter": 0,
            "current_page": 0,
            "progress_percentage": 0.0,
        }
        if obj.book_metadata and obj.book_metadata.format == BookFormat.EPUB
        else None
    )
    pdf_current_page = factory.LazyAttribute(
        lambda obj: 1 if obj.book_metadata and obj.book_metadata.format == BookFormat.PDF else None
    )


class HighlightFactory(SQLAlchemyModelFactory):
    """Factory for Highlight model"""

    class Meta:
        model = Highlight
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid.uuid4)
    # user_book_lib_id should be provided when creating highlights
    color = factory.Faker(
        "random_element",
        elements=[HighlightColor.YELLOW, HighlightColor.GREEN, HighlightColor.BLUE],
    )
    original_text = factory.Faker("text", max_nb_chars=200)
    note = factory.Faker("text", max_nb_chars=100)
    chapter_idx = factory.Faker("random_int", min=0, max=20)
    chapter_href = factory.Faker("file_path", depth=2, extension="xhtml")
    chapter_title = factory.Faker("sentence", nb_words=3)
    page = factory.Faker("random_int", min=1, max=300)
    html_range = factory.LazyFunction(
        lambda: {
            "startContainer": "p[0]",
            "startOffset": 10,
            "endContainer": "p[0]",
            "endOffset": 50,
        }
    )
    pdf_rect_position = factory.LazyFunction(lambda: {"x": 100, "y": 200, "width": 300, "height": 20, "page": 1})
