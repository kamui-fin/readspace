"""Article and content models - pure SQLAlchemy."""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as SQLUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base
from app.models.enums import ArticlePriority


class ArticleContent(Base):
    """Shared content table for both RSS articles and clipped articles."""

    __tablename__ = "article_contents"

    id = Column(SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    content_hash = Column(String(64), nullable=False, unique=True, index=True)
    title = Column(Text, nullable=False)
    link = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    author = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    tags = Column(ARRAY(Text), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    feed_articles = relationship("FeedArticle", back_populates="content", cascade="all, delete-orphan")
    user_entries = relationship("UserEntry", back_populates="content", cascade="all, delete-orphan")


class FeedArticle(Base):
    """Feed articles table - links feeds to content."""

    __tablename__ = "feed_articles"

    id = Column(SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    feed_id = Column(
        SQLUUID(as_uuid=True),
        ForeignKey("feeds.id", ondelete="CASCADE"),
        nullable=False,
    )
    content_id = Column(
        SQLUUID(as_uuid=True),
        ForeignKey("article_contents.id", ondelete="CASCADE"),
        nullable=False,
    )
    guid_hash = Column(String(64), nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    feed = relationship("Feed", back_populates="articles")
    content = relationship("ArticleContent", back_populates="feed_articles")
    user_entries = relationship("UserEntry", back_populates="feed_article", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("feed_id", "guid_hash", name="uq_feed_articles_feed_guid_hash"),)


class UserEntry(Base):
    """Unified table for all user-article interactions (feed articles and clipped articles)."""

    __tablename__ = "user_entries"

    id = Column(SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(
        SQLUUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Either content_id or feed_article_id must be present
    content_id = Column(
        SQLUUID(as_uuid=True),
        ForeignKey("article_contents.id", ondelete="CASCADE"),
        nullable=True,
    )
    feed_article_id = Column(
        SQLUUID(as_uuid=True),
        ForeignKey("feed_articles.id", ondelete="CASCADE"),
        nullable=True,
    )

    # State flags
    is_read = Column(Boolean, nullable=False, server_default="false")
    is_saved = Column(Boolean, nullable=False, server_default="false")
    priority = Column(
        SQLEnum(ArticlePriority, name="articlepriority"),
        nullable=False,
        server_default="LOW",
    )

    # Metadata
    user_note = Column(Text, nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    user = relationship("Profile", back_populates="entries")
    content = relationship("ArticleContent", back_populates="user_entries")
    feed_article = relationship("FeedArticle", back_populates="user_entries")

    __table_args__ = (UniqueConstraint("user_id", "content_id", name="uq_user_entry_content"),)
