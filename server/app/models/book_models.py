from datetime import datetime
from typing import List, Optional
from uuid import UUID

from sqlalchemy import Column, ForeignKey, Integer, String, Text, DateTime, BigInteger, JSON, ARRAY, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base

class BookFormat(str, Enum):
    EPUB = "epub"
    PDF = "pdf"

class HighlightColor(str, Enum):
    YELLOW = "yellow"
    GREEN = "green"
    BLUE = "blue"

class BookMetadata(Base):
    __tablename__ = "book_metadata"

    id = Column(PGUUID, primary_key=True, server_default="gen_random_uuid()")
    title = Column(Text, nullable=False)
    author = Column(Text)
    description = Column(Text)
    cover_url = Column(Text)
    file_url = Column(Text)
    format = Column(Enum(BookFormat), nullable=False)
    num_pages = Column(Integer)
    file_size_bytes = Column(BigInteger)
    
    # EPUB/PDF structure
    epub_chapter_char_counts = Column(ARRAY(Integer))
    epub_page_char_counts = Column(ARRAY(Integer))
    pdf_toc = Column(JSON)
    
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user_libraries = relationship("UserBookLibrary", back_populates="book_metadata", cascade="all, delete-orphan")

class UserBookLibrary(Base):
    __tablename__ = "user_book_library"

    id = Column(PGUUID, primary_key=True, server_default="gen_random_uuid()")
    user_id = Column(PGUUID, ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    book_metadata_id = Column(PGUUID, ForeignKey("book_metadata.id", ondelete="CASCADE"), nullable=False)
    date_added = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    
    # User-specific progress
    epub_progress = Column(JSON)
    pdf_current_page = Column(Integer)

    # Relationships
    book_metadata = relationship("BookMetadata", back_populates="user_libraries")
    highlights = relationship("Highlight", back_populates="user_book_library", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('user_id', 'book_metadata_id', name='uix_user_book'),
    )

class Highlight(Base):
    __tablename__ = "highlights"

    id = Column(PGUUID, primary_key=True, server_default="gen_random_uuid()")
    user_book_lib_id = Column(PGUUID, ForeignKey("user_book_library.id", ondelete="CASCADE"), nullable=False)
    color = Column(Enum(HighlightColor), nullable=False)
    original_text = Column(Text, nullable=False)
    note = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user_book_library = relationship("UserBookLibrary", back_populates="highlights")
    locations = relationship("HighlightLocation", back_populates="highlight", cascade="all, delete-orphan")

class HighlightLocation(Base):
    __tablename__ = "highlight_locations"

    id = Column(PGUUID, primary_key=True, server_default="gen_random_uuid()")
    highlight_id = Column(PGUUID, ForeignKey("highlights.id", ondelete="CASCADE"), nullable=False)
    chapter_idx = Column(Integer)
    chapter_href = Column(Text)
    chapter_title = Column(Text)
    page = Column(Integer)
    html_range = Column(JSON)
    pdf_rect_position = Column(JSON)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    highlight = relationship("Highlight", back_populates="locations") 