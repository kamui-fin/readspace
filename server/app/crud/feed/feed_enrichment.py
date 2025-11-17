"""Feed enrichment and metadata updates."""

from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Feed, FeedCategory

logger = structlog.get_logger(__name__)


async def update_feed_metadata(
    db: AsyncSession,
    *,
    feed_db: Feed,
    title: str | None = None,
    description: str | None = None,
    link: str | None = None,
    language: str | None = None,
    image_url: str | None = None,
    ttl: int | None = None,
    skip_hours: list[int] | None = None,
    skip_days: list[str] | None = None,
    last_modified: str | None = None,
    etag: str | None = None,
    last_fetched_at: datetime | None = None,
    last_article_published_at: datetime | None = None,
    content_hash: str | None = None,
    adaptive_fetch_interval_minutes: int | None = None,
) -> Feed:
    """Update feed metadata after successful fetch."""
    if title is not None:
        feed_db.title = title
    if description is not None:
        feed_db.description = description
    if link is not None:
        feed_db.link = str(link)
    if language is not None:
        feed_db.language = language
    if image_url is not None:
        feed_db.image_url = str(image_url)

    if ttl is not None:
        try:
            feed_db.ttl = int(ttl) if ttl is not None else None
        except (ValueError, TypeError):
            logger.warning("Invalid TTL value", ttl=ttl, feed_id=feed_db.id)
            feed_db.ttl = None

    if skip_hours is not None:
        try:
            validated_hours = []
            for hour in skip_hours:
                hour_int = int(hour)
                if 0 <= hour_int <= 23:
                    validated_hours.append(hour_int)
            feed_db.skip_hours = validated_hours
        except (ValueError, TypeError):
            logger.warning("Invalid skip_hours", skip_hours=skip_hours, feed_id=feed_db.id)
            feed_db.skip_hours = []

    if skip_days is not None:
        try:
            feed_db.skip_days = [str(day) for day in skip_days]
        except (ValueError, TypeError):
            logger.warning("Invalid skip_days", skip_days=skip_days, feed_id=feed_db.id)
            feed_db.skip_days = []

    if last_modified is not None:
        feed_db.last_modified_header = last_modified
    if etag is not None:
        feed_db.etag_header = etag
    if last_fetched_at is not None:
        feed_db.last_fetched_at = last_fetched_at
    if last_article_published_at is not None:
        feed_db.last_article_published_at = last_article_published_at
    if content_hash is not None:
        feed_db.content_hash = content_hash
    if adaptive_fetch_interval_minutes is not None:
        feed_db.adaptive_fetch_interval_minutes = adaptive_fetch_interval_minutes

    # Reset error state on successful fetch (enables exponential backoff)
    feed_db.fetch_error_count = 0
    feed_db.last_error_message = None

    db.add(feed_db)
    # NOTE: No commit here - let caller (task wrapper) handle transaction commit
    # This prevents transaction state conflicts when called from get_worker_db()
    return feed_db


async def update_feed_enrichment(db: AsyncSession, feed: Feed, enrichment_data: dict[str, Any]) -> Feed:
    """Update feed with enrichment data from background processing."""
    try:
        # Update basic feed metadata
        if "title" in enrichment_data and enrichment_data["title"]:
            feed.title = enrichment_data["title"]

        if "description" in enrichment_data and enrichment_data["description"]:
            feed.description = enrichment_data["description"]

        if "link" in enrichment_data and enrichment_data["link"]:
            feed.link = enrichment_data["link"]

        if "image_url" in enrichment_data and enrichment_data["image_url"]:
            feed.image_url = enrichment_data["image_url"]

        if "language" in enrichment_data and enrichment_data["language"]:
            feed.language = enrichment_data["language"]

        # Update RSS dataset fields
        if "tags" in enrichment_data and isinstance(enrichment_data["tags"], list):
            feed.tags = enrichment_data["tags"]

        if "top_level_category" in enrichment_data:
            category_str = enrichment_data["top_level_category"]
            try:
                # Convert string to enum - matches by value (e.g., "Technology & Programming")
                category_enum = FeedCategory(category_str)
                # Assign the enum itself, not its value - SQLAlchemy will use the enum member name
                feed.top_level_category = category_enum
            except ValueError:
                logger.warning("Invalid category", category=category_str, feed_id=feed.id)
                feed.top_level_category = FeedCategory.MISCELLANEOUS

        if "popularity_score" in enrichment_data:
            feed.popularity_score = float(enrichment_data["popularity_score"])

        # Update embedding if present
        if "embedding" in enrichment_data and enrichment_data["embedding"]:
            # Embedding is handled as a vector column by SQLAlchemy
            # The pgvector extension handles the conversion
            embedding_list = enrichment_data["embedding"]
            if isinstance(embedding_list, list) and len(embedding_list) == 768:
                # Update using raw SQL for vector type
                await db.execute(
                    text("UPDATE feeds SET embedding = :embedding WHERE id = :feed_id"),
                    {"embedding": str(embedding_list), "feed_id": feed.id},
                )

        # Update the feed timestamp
        feed.updated_at = datetime.now(timezone.utc)

        db.add(feed)
        # NOTE: No commit here - let caller (task wrapper) handle transaction commit
        # This prevents transaction state conflicts when called from get_worker_db()

        logger.info(
            "Feed enrichment data updated successfully",
            feed_id=feed.id,
            updated_fields=list(enrichment_data.keys()),
        )

        return feed

    except Exception as e:
        logger.error(
            "Failed to update feed with enrichment data",
            feed_id=feed.id,
            error=str(e),
            exc_info=True,
        )
        # NOTE: No rollback here - let caller handle exception and rollback
        # get_worker_db() will rollback on any exception
        raise
