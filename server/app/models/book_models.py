import uuid
from datetime import datetime
from enum import Enum as PyEnum

from app.db.base_class import Base
from app.models.user_models import Profile  # noqa: F401
from sqlalchemy import (
    ARRAY,
    JSON,
    BigInteger,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship


class BookFormat(PyEnum):
    EPUB = "EPUB"
    PDF = "PDF"


class HighlightColor(PyEnum):
    YELLOW = "yellow"
    GREEN = "green"
    BLUE = "blue"


class BookMetadata(Base):
    __tablename__ = "book_metadata"

    id = Column(PGUUID, primary_key=True, default=uuid.uuid4)
    title = Column(Text, nullable=False)
    author = Column(Text)
    description = Column(Text)
    cover_url = Column(Text)
    file_url = Column(Text, nullable=False)
    format = Column(Enum(BookFormat), nullable=False)
    num_pages = Column(Integer)
    file_size_bytes = Column(BigInteger)

    # EPUB/PDF structure
    epub_chapter_char_counts = Column(ARRAY(Integer))
    epub_page_char_counts = Column(ARRAY(Integer))
    pdf_toc = Column(JSON)

    created_at = Column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    # Relationships
    user_libraries = relationship(
        "UserBookLibrary", back_populates="book_metadata", cascade="all, delete-orphan"
    )


class UserBookLibrary(Base):
    __tablename__ = "user_book_library"

    id = Column(PGUUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(
        PGUUID, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    book_metadata_id = Column(
        PGUUID, ForeignKey("book_metadata.id", ondelete="CASCADE"), nullable=False
    )
    date_added = Column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    # User-specific progress
    epub_progress = Column(JSON)
    pdf_current_page = Column(Integer)

    # Relationships
    book_metadata = relationship("BookMetadata", back_populates="user_libraries")
    highlights = relationship(
        "Highlight", back_populates="user_book_library", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("user_id", "book_metadata_id", name="uix_user_book"),
    )


class Highlight(Base):
    __tablename__ = "highlights"

    id = Column(PGUUID, primary_key=True, default=uuid.uuid4)
    user_book_lib_id = Column(
        PGUUID, ForeignKey("user_book_library.id", ondelete="CASCADE"), nullable=False
    )
    color = Column(Enum(HighlightColor), nullable=False)
    original_text = Column(Text, nullable=False)
    note = Column(Text)
    
    # Location fields 
    chapter_idx = Column(Integer)
    chapter_href = Column(Text)
    chapter_title = Column(Text)
    page = Column(Integer)
    html_range = Column(JSON)
    pdf_rect_position = Column(JSON)

    # Relationships
    user_book_library = relationship("UserBookLibrary", back_populates="highlights")
