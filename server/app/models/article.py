"""Article and article content model definitions."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as SQLUUID
from sqlalchemy.orm import Mapped, deferred, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class ArticleContent(Base):
    """Shared content table for both RSS articles and clipped articles."""

    __tablename__ = "article_contents"

    id = Column(SQLUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Core article data
    # Reduced from String(1000) to String(500) - most article titles are < 200 chars
    # This saves ~800 bytes per article in storage
    title = Column(String(500))
    link = Column(String(2048), nullable=False)
    content_hash = Column(String(64), nullable=False, unique=True, index=True)
    # Defer large text fields to reduce bandwidth in list queries
    # Use undefer() or undefer_group('content_details') when full content is needed
    description = deferred(Column(Text), group="content_details")
    content = deferred(Column(Text), group="content_details")
    image_url = Column(String(2048))
    author = Column(String(500))

    estimated_read_time_minutes = Column(Integer)

    # Relationships
    feed_articles = relationship("FeedArticle", back_populates="content")
    user_entries = relationship("UserEntry", back_populates="content")


class FeedArticle(Base):
    """Feed articles table without user-specific fields."""

    __tablename__ = "feed_articles"

    id: Mapped[uuid.UUID] = mapped_column(
        SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    feed_id: Mapped[uuid.UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("feeds.id", ondelete="CASCADE"),
        nullable=False,
    )
    content_id: Mapped[uuid.UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("article_contents.id", ondelete="CASCADE"),
        nullable=False,
    )
    guid_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    feed = relationship("Feed", back_populates="articles")
    content = relationship("ArticleContent", foreign_keys=[content_id])
    user_entries = relationship("UserEntry", back_populates="feed_article")

    __table_args__ = (UniqueConstraint("feed_id", "guid_hash", name="uq_feed_articles_feed_guid_hash"),)


class UserEntry(Base):
    """Unified table for all user-article interactions (feed articles and clipped articles)."""

    __tablename__ = "user_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    content_id: Mapped[uuid.UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("article_contents.id", ondelete="CASCADE"),
        nullable=False,
    )
    feed_article_id: Mapped[uuid.UUID | None] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("feed_articles.id", ondelete="CASCADE"),
        nullable=True,
    )

    # State flags
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    is_read_later: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    priority: Mapped[str] = mapped_column(String(20), nullable=False, server_default="MEDIUM")

    # Metadata
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()  # Automatically updates timestamp on changes
    )

    # Relationships
    user = relationship("Profile", back_populates="entries")
    content = relationship("ArticleContent", back_populates="user_entries")
    feed_article = relationship("FeedArticle", back_populates="user_entries")

    __table_args__ = (UniqueConstraint("user_id", "content_id", name="uq_user_entry_content"),)
