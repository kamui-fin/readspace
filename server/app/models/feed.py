"""Feed and subscription model definitions."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as SQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base_class import Base
from app.models.enums import FeedCategory


class Feed(Base):
    """Global feed table - shared across all users."""

    __tablename__ = "feeds"

    id: Mapped[UUID] = mapped_column(SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    url: Mapped[str] = mapped_column(String(2048), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    # Reduced from TEXT to String(2000) - most feed descriptions are < 1000 chars
    # This improves query performance and reduces table bloat
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    link: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    language: Mapped[str | None] = mapped_column(String(50), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    # RSS dataset fields
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String()), nullable=True)
    top_level_category: Mapped[str | None] = mapped_column(SQLEnum(FeedCategory), nullable=True)
    popularity_score: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    subscriber_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # RSS-specific metadata
    ttl: Mapped[int | None] = mapped_column(Integer, nullable=True)
    skip_hours: Mapped[list[int] | None] = mapped_column(ARRAY(Integer), nullable=True)
    skip_days: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    # Feed fetching state
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_fetch_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    last_modified_header: Mapped[str | None] = mapped_column(String(255), nullable=True)
    etag_header: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_article_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Adaptive scheduling optimization
    adaptive_fetch_interval_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Error tracking
    # CHECK constraint ensures value is in valid range (0-999)
    fetch_error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error_message: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    subscriptions = relationship("FeedSubscription", back_populates="feed", cascade="all, delete-orphan")
    articles = relationship("FeedArticle", back_populates="feed", cascade="all, delete-orphan")


class FeedSubscription(Base):
    """User-specific feed subscription table."""

    __tablename__ = "feed_subscriptions"

    id: Mapped[UUID] = mapped_column(SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    feed_id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("feeds.id", ondelete="CASCADE"),
        nullable=False,
    )
    folder_id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=False,
    )

    # User-specific feed settings
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    custom_title: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Last read cutoff timestamp for efficient unread tracking
    # Articles published after this timestamp are considered unread (unless explicitly marked as read)
    # Used for "mark all read" functionality and initial subscription limiting
    last_read_cutoff: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    feed = relationship("Feed", back_populates="subscriptions")
    user = relationship("Profile", foreign_keys=[user_id])
    folder = relationship("Folder", foreign_keys=[folder_id])
