"""Feed and subscription models - pure SQLAlchemy."""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as SQLUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base
from app.models.enums import ContentType, FeedCategory


class Feed(Base):
    """Global feed table - shared across all users."""

    __tablename__ = "feeds"

    id = Column(
        SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    url = Column(Text, nullable=False, unique=True)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    link = Column(Text, nullable=True)
    language = Column(Text, nullable=False)
    image_url = Column(Text, nullable=True)

    # Fetching Logic
    last_fetched_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    next_fetch_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    adaptive_fetch_interval_minutes = Column(Integer, nullable=True)
    fetch_error_count = Column(Integer, nullable=False, default=0)
    last_error_message = Column(Text, nullable=True)
    etag_header = Column(Text, nullable=True)
    last_modified_header = Column(Text, nullable=True)
    content_hash = Column(String(64), nullable=True)

    # Metadata
    tags = Column(ARRAY(Text), nullable=True)
    tags_native = Column(ARRAY(Text), nullable=True)
    author = Column(Text, nullable=True)
    content_type = Column(
        Text, nullable=True
    )  # Store enum value as string for flexibility
    top_level_category = Column(
        SQLEnum(FeedCategory, name="feedcategory"),
        nullable=False,
        server_default="miscellaneous",
    )
    popularity_score = Column(Float, nullable=False, default=0.0)
    subscriber_count = Column(Integer, nullable=False, default=0)

    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_updated_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    articles = relationship(
        "FeedArticle", back_populates="feed", cascade="all, delete-orphan"
    )
    subscriptions = relationship(
        "FeedSubscription", back_populates="feed", cascade="all, delete-orphan"
    )


class FeedSubscription(Base):
    """User-Feed subscription relationship."""

    __tablename__ = "feed_subscriptions"

    id = Column(
        SQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id = Column(
        SQLUUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    feed_id = Column(
        SQLUUID(as_uuid=True),
        ForeignKey("feeds.id", ondelete="CASCADE"),
        nullable=False,
    )
    folder_id = Column(
        SQLUUID(as_uuid=True),
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=False,
    )

    is_favorite = Column(Boolean, nullable=False, default=False)
    custom_title = Column(Text, nullable=True)
    last_read_cutoff = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user = relationship("Profile", back_populates="subscriptions")
    feed = relationship("Feed", back_populates="subscriptions")
    folder = relationship("Folder", back_populates="subscriptions")
