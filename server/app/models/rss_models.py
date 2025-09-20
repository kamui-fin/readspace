"""New feed models for the subscription-based architecture."""

import uuid
from datetime import datetime, timezone
from enum import Enum
from uuid import UUID

from pgvector.sqlalchemy import Vector  # type: ignore
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as SQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class FeedCategory(Enum):
    """Feed categories from RSS dataset."""

    TECHNOLOGY_PROGRAMMING = "Technology & Programming"
    CULTURE_ARTS = "Culture & Arts"
    LIFESTYLE_PERSONAL = "Lifestyle & Personal"
    MISCELLANEOUS = "Miscellaneous"
    DESIGN_CREATIVITY = "Design & Creativity"
    SCIENCE_RESEARCH = "Science & Research"
    NEWS_POLITICS = "News & Politics"
    GAMING_ENTERTAINMENT = "Gaming & Entertainment"
    BUSINESS_FINANCE = "Business & Finance"
    ARTIFICIAL_INTELLIGENCE = "Artificial Intelligence"
    SECURITY_PRIVACY = "Security & Privacy"
    EDUCATION_LEARNING = "Education & Learning"


class ArticleContent(Base):
    """Shared content table for both RSS articles and clipped articles"""

    __tablename__ = "article_contents"

    id = Column(SQLUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Core article data
    title = Column(String(1000))  # Conservative limit for titles
    link = Column(String(2048), nullable=False)
    description = Column(String(5000))  # Conservative limit for summaries
    content = Column(Text)  # Keep unlimited for full content
    image_url = Column(String(2048))  # Best representative cover image
    author = Column(String(500))

    published_at = Column(DateTime(timezone=True), index=True)
    estimated_read_time_minutes = Column(Integer)  # In minutes

    # Metadata
    custom_metadata = Column(JSONB)  # For any other data from the feed item or extraction

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    feed_articles = relationship("FeedArticle", back_populates="content")
    clipped_articles = relationship("ClippedArticle", back_populates="content")


class Feed(Base):
    """Global feed table - shared across all users."""

    __tablename__ = "feeds"

    id: Mapped[UUID] = mapped_column(SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    url: Mapped[str] = mapped_column(String(2048), nullable=False, unique=True)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    link: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    language: Mapped[str | None] = mapped_column(String(50), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    # RSS dataset fields
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String()), nullable=True)
    top_level_category: Mapped[str | None] = mapped_column(SQLEnum(FeedCategory), nullable=True)
    popularity_score: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    subscriber_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Vector embedding for similarity search (768 dimensions)
    # Added via migration with pgvector extension
    embedding: Mapped[list[float] | None] = mapped_column(Vector(768), nullable=True)

    # RSS-specific metadata
    ttl: Mapped[int | None] = mapped_column(Integer, nullable=True)
    skip_hours: Mapped[list[int] | None] = mapped_column(ARRAY(Integer), nullable=True)
    skip_days: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    # Feed fetching state
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_modified_header: Mapped[str | None] = mapped_column(String(255), nullable=True)
    etag_header: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_article_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Error tracking
    fetch_error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    subscriptions = relationship("FeedSubscription", back_populates="feed", cascade="all, delete-orphan")
    articles = relationship("FeedArticle", back_populates="feed", cascade="all, delete-orphan")


# Tag class removed - using ARRAY field in Feed instead


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

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    feed = relationship("Feed", back_populates="subscriptions")
    user = relationship("Profile", foreign_keys=[user_id])
    folder = relationship("Folder", foreign_keys=[folder_id])


class FeedArticle(Base):
    """New feed articles table without user-specific fields."""

    __tablename__ = "feed_articles"

    id: Mapped[UUID] = mapped_column(SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    feed_id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("feeds.id", ondelete="CASCADE"),
        nullable=False,
    )
    content_id: Mapped[UUID] = mapped_column(
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


class UserArticleState(Base):
    """User-specific article interaction states."""

    __tablename__ = "user_article_states"

    id: Mapped[UUID] = mapped_column(SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[UUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    article_id: Mapped[UUID] = mapped_column(
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


class Folder(Base):
    __tablename__ = "folders"

    id = Column(SQLUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    user_id = Column(
        SQLUUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_folder_user_name"),)


class ClippedArticle(Base):
    """Manually saved web articles - not from RSS feeds"""

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
        index=True,
    )

    # Clipped article specific fields
    priority = Column(String(20), default="medium", nullable=False)  # low, medium, high
    note = Column(String(2000))  # User's personal note about the article

    # User interaction state
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime(timezone=True))  # Timestamp for "Recently Read"
    is_read_later = Column(
        Boolean, default=True, nullable=False, index=True
    )  # Clipped articles are read later by default
    is_favorite = Column(Boolean, default=False, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    # Relationships
    content = relationship("ArticleContent", back_populates="clipped_articles")

    __table_args__ = (UniqueConstraint("user_id", "content_id", name="uq_clipped_article_user_content"),)
