"""New feed models for the subscription-based architecture."""

import uuid
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as UUIDType
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base

# Association table for Many-to-Many relationship between Feed and Tag
feed_tag_association = Table(
    "feed_tag_association",
    Base.metadata,
    Column(
        "feed_id",
        UUIDType(as_uuid=True),
        ForeignKey("feeds.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tag_id",
        UUIDType(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class ArticleContent(Base):
    """Shared content table for both RSS articles and clipped articles"""

    __tablename__ = "article_contents"

    id = Column(UUIDType(as_uuid=True), primary_key=True, default=uuid.uuid4)

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
    custom_metadata = Column(
        JSONB
    )  # For any other data from the feed item or extraction

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
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

    id: Column[UUID] = Column(
        UUIDType(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    url: Column[str] = Column(String(2048), nullable=False, unique=True)
    title: Column[str | None] = Column(String(500), nullable=True)
    description: Column[str | None] = Column(Text, nullable=True)
    link: Column[str | None] = Column(String(2048), nullable=True)
    language: Column[str | None] = Column(String(50), nullable=True)
    image_url: Column[str | None] = Column(String(2048), nullable=True)

    # RSS-specific metadata
    ttl: Column[int | None] = Column(Integer, nullable=True)
    skip_hours: Column[list[int] | None] = Column(ARRAY(Integer), nullable=True)
    skip_days: Column[list[str] | None] = Column(ARRAY(String), nullable=True)

    # Feed fetching state
    last_fetched_at: Column[datetime | None] = Column(
        DateTime(timezone=True), nullable=True
    )
    last_modified_header: Column[str | None] = Column(String(255), nullable=True)
    etag_header: Column[str | None] = Column(String(255), nullable=True)
    last_article_published_at: Column[datetime | None] = Column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Column[datetime] = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Column[datetime] = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    subscriptions = relationship(
        "FeedSubscription", back_populates="feed", cascade="all, delete-orphan"
    )
    articles = relationship(
        "FeedArticle", back_populates="feed", cascade="all, delete-orphan"
    )
    tags = relationship("Tag", secondary=feed_tag_association, back_populates="feeds")


class Tag(Base):
    __tablename__ = "tags"

    id: Column[UUID] = Column(
        UUIDType(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Column[str] = Column(String(100), nullable=False, index=True)
    user_id: Column[UUID] = Column(
        UUIDType(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at: Column[datetime] = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Column[datetime] = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    feeds = relationship(
        "Feed",
        secondary=feed_tag_association,
        back_populates="tags",
        cascade="all, delete",
    )

    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_tag_user_name"),)


class FeedSubscription(Base):
    """User-specific feed subscription table."""

    __tablename__ = "feed_subscriptions"

    id: Column[UUID] = Column(
        UUIDType(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Column[UUID] = Column(
        UUIDType(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    feed_id: Column[UUID] = Column(
        UUIDType(as_uuid=True),
        ForeignKey("feeds.id", ondelete="CASCADE"),
        nullable=False,
    )
    folder_id: Column[UUID] = Column(
        UUIDType(as_uuid=True),
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=False,
    )

    # User-specific feed settings
    is_favorite: Column[bool] = Column(Boolean, nullable=False, default=False)
    custom_title: Column[str | None] = Column(String(500), nullable=True)

    created_at: Column[datetime] = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Column[datetime] = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    feed = relationship("Feed", back_populates="subscriptions")
    user = relationship("Profile", foreign_keys=[user_id])
    folder = relationship("Folder", foreign_keys=[folder_id])


class FeedArticle(Base):
    """New feed articles table without user-specific fields."""

    __tablename__ = "feed_articles"

    id: Column[UUID] = Column(
        UUIDType(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    feed_id: Column[UUID] = Column(
        UUIDType(as_uuid=True),
        ForeignKey("feeds.id", ondelete="CASCADE"),
        nullable=False,
    )
    content_id: Column[UUID] = Column(
        UUIDType(as_uuid=True),
        ForeignKey("article_contents.id", ondelete="CASCADE"),
        nullable=False,
    )
    guid: Column[str] = Column(String(1024), nullable=False)

    created_at: Column[datetime] = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Column[datetime] = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    feed = relationship("Feed", back_populates="articles")
    content = relationship("ArticleContent", foreign_keys=[content_id])
    user_states = relationship(
        "UserArticleState", back_populates="article", cascade="all, delete-orphan"
    )


class UserArticleState(Base):
    """User-specific article interaction states."""

    __tablename__ = "user_article_states"

    id: Column[UUID] = Column(
        UUIDType(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Column[UUID] = Column(
        UUIDType(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    article_id: Column[UUID] = Column(
        UUIDType(as_uuid=True),
        ForeignKey("feed_articles.id", ondelete="CASCADE"),
        nullable=False,
    )

    # User interaction states
    is_read: Column[bool] = Column(Boolean, nullable=False, default=False)
    read_at: Column[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    is_read_later: Column[bool] = Column(Boolean, nullable=False, default=False)
    is_favorite: Column[bool] = Column(Boolean, nullable=False, default=False)

    # User-specific metadata
    user_note: Column[str | None] = Column(Text, nullable=True)
    user_tags: Column[list[str] | None] = Column(ARRAY(String), nullable=True)

    created_at: Column[datetime] = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Column[datetime] = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user = relationship("Profile", foreign_keys=[user_id])
    article = relationship("FeedArticle", back_populates="user_states")


class Folder(Base):
    __tablename__ = "folders"

    id = Column(UUIDType(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    user_id = Column(
        UUIDType(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_folder_user_name"),)


class ClippedArticle(Base):
    """Manually saved web articles - not from RSS feeds"""

    __tablename__ = "clipped_articles"

    id = Column(UUIDType(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_id = Column(
        UUIDType(as_uuid=True),
        ForeignKey("article_contents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUIDType(as_uuid=True),
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

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    # Relationships
    content = relationship("ArticleContent", back_populates="clipped_articles")

    __table_args__ = (
        UniqueConstraint(
            "user_id", "content_id", name="uq_clipped_article_user_content"
        ),
    )


# Keep backward compatibility alias
Article = FeedArticle
