from datetime import datetime, timezone

from app.db.base_class import Base
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
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

# Association table for Many-to-Many relationship between Feed and Tag
feed_tag_association = Table(
    "feed_tag_association",
    Base.metadata,
    Column("feed_id", PGUUID(as_uuid=True), ForeignKey("feeds.id"), primary_key=True),
    Column("tag_id", PGUUID(as_uuid=True), ForeignKey("tags.id"), primary_key=True),
)


class Folder(Base):
    __tablename__ = "folders"

    id = Column(PGUUID(as_uuid=True), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    feeds = relationship("Feed", back_populates="folder")
    # user = relationship("Profile", back_populates="folders") # Assuming Profile model has a 'folders' relationship

    __table_args__ = (UniqueConstraint('user_id', 'name', name='uq_folder_user_name'),)


class Tag(Base):
    __tablename__ = "tags"

    id = Column(PGUUID(as_uuid=True), primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True) # Consider uniqueness constraint per user
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    feeds = relationship(
        "Feed", secondary=feed_tag_association, back_populates="tags"
    )
    # user = relationship("Profile", back_populates="tags") # Assuming Profile model has a 'tags' relationship

    __table_args__ = (UniqueConstraint('user_id', 'name', name='uq_tag_user_name'),)


class Feed(Base):
    __tablename__ = "feeds"

    id = Column(PGUUID(as_uuid=True), primary_key=True, index=True)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False, index=True)
    folder_id = Column(PGUUID(as_uuid=True), ForeignKey("folders.id"), nullable=False, index=True)

    url = Column(String(2048), nullable=False, index=True) # Unique per user_id
    title = Column(String(500))
    description = Column(Text)
    link = Column(String(2048)) # Website link
    language = Column(String(50))
    image_url = Column(String(2048)) # From feed <image>
    
    ttl = Column(Integer) # Cache Time-To-Live in minutes
    skip_hours = Column(ARRAY(Integer)) # List of hours to skip
    skip_days = Column(ARRAY(String))   # List of days to skip (e.g., ['Saturday', 'Sunday'])

    last_fetched_at = Column(DateTime(timezone=True))
    last_modified_header = Column(String(255)) # HTTP Last-Modified header value
    etag_header = Column(String(255)) # HTTP ETag header value
    
    is_favorite = Column(Boolean, default=False, nullable=False)
    
    fetch_error_count = Column(Integer, default=0) # To track consecutive fetch errors
    last_error_message = Column(Text)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    folder = relationship("Folder", back_populates="feeds")
    articles = relationship("Article", back_populates="feed", cascade="all, delete-orphan")
    tags = relationship(
        "Tag", secondary=feed_tag_association, back_populates="feeds"
    )
    # user = relationship("Profile", back_populates="feeds") # Assuming Profile model has a 'feeds' relationship

    __table_args__ = (UniqueConstraint('user_id', 'url', name='uq_feed_user_url'),)


class Article(Base):
    __tablename__ = "articles"

    id = Column(PGUUID(as_uuid=True), primary_key=True, index=True)
    feed_id = Column(PGUUID(as_uuid=True), ForeignKey("feeds.id"), nullable=False, index=True)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False, index=True) # Denormalized for easier querying

    guid = Column(String(1024), nullable=False, index=True) # Unique identifier from feed
    title = Column(Text)
    link = Column(String(2048), nullable=False)
    description = Column(Text) # Summary
    content = Column(Text) # Full content, if available
    image_url = Column(String(2048)) # Best representative cover image

    published_at = Column(DateTime(timezone=True), index=True)
    estimated_read_time_minutes = Column(Integer) # In minutes

    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime(timezone=True)) # Timestamp for "Recently Read"
    is_read_later = Column(Boolean, default=False, nullable=False, index=True)
    is_favorite = Column(Boolean, default=False, nullable=False, index=True) # Article-level favorite

    custom_metadata = Column(JSONB) # For any other data from the feed item

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    feed = relationship("Feed", back_populates="articles")
    # user = relationship("Profile", back_populates="articles") # Assuming Profile model has an 'articles' relationship

    __table_args__ = (UniqueConstraint('feed_id', 'guid', name='uq_article_feed_guid'),) 