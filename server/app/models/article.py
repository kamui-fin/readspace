"""Article and article content model definitions."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as SQLUUID
from sqlalchemy.orm import Mapped, deferred, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base_class import Base
from app.models.enums import ArticlePriority


class ArticleContent(Base):
    """Shared content table for both RSS articles and clipped articles."""

    __tablename__ = "article_contents"

    id = Column(SQLUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Core article data
    # Reduced from String(1000) to String(500) - most article titles are < 200 chars
    # This saves ~800 bytes per article in storage
    title = Column(String(500))
    link = Column(String(2048), nullable=False)
    # Defer large text fields to reduce bandwidth in list queries
    # Use undefer() or undefer_group('content_details') when full content is needed
    description = deferred(Column(String(5000)), group="content_details")
    content = deferred(Column(Text), group="content_details")
    image_url = Column(String(2048))
    author = Column(String(500))

    published_at = Column(DateTime(timezone=True), index=True)
    estimated_read_time_minutes = Column(Integer)

    # Metadata
    custom_metadata = Column(JSONB)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    feed_articles = relationship("FeedArticle", back_populates="content")
    clipped_articles = relationship("ClippedArticle", back_populates="content")


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
    guid: Mapped[str] = mapped_column(String(1024), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    feed = relationship("Feed", back_populates="articles")
    content = relationship("ArticleContent", foreign_keys=[content_id])
    user_states = relationship("UserArticleState", back_populates="article", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("feed_id", "guid", name="uq_feed_article_feed_guid"),)


class UserArticleState(Base):
    """User-specific article interaction states."""

    __tablename__ = "user_article_states"

    id: Mapped[uuid.UUID] = mapped_column(
        SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    article_id: Mapped[uuid.UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("feed_articles.id", ondelete="CASCADE"),
        nullable=False,
    )

    # User interaction states
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_read_later: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # User-specific metadata
    user_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_tags: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    user = relationship("Profile", foreign_keys=[user_id])
    article = relationship("FeedArticle", back_populates="user_states")

    __table_args__ = (UniqueConstraint("user_id", "article_id", name="uq_user_article_state"),)


class ClippedArticle(Base):
    """Manually saved web articles - not from RSS feeds."""

    __tablename__ = "clipped_articles"

    id = Column(SQLUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_id = Column(
        SQLUUID(as_uuid=True),
        ForeignKey("article_contents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        SQLUUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        # Note: user_id index replaced by composite idx_clipped_user_created (user_id, created_at DESC)
    )

    # Clipped article specific fields
    priority = Column(SQLEnum(ArticlePriority, name="articlepriority"), nullable=False, default=ArticlePriority.MEDIUM)
    note = Column(String(2000))

    # User interaction state
    # Note: is_read, is_read_later, is_favorite no longer indexed individually
    # Queries filter by user_id first, making boolean indexes ineffective
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime(timezone=True))
    is_read_later = Column(Boolean, default=True, nullable=False)
    is_favorite = Column(Boolean, default=False, nullable=False)

    # Note: created_at index replaced by composite idx_clipped_user_created (user_id, created_at DESC)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    content = relationship("ArticleContent", back_populates="clipped_articles")

    __table_args__ = (UniqueConstraint("user_id", "content_id", name="uq_clipped_article_user_content"),)
