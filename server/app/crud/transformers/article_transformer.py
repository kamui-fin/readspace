"""Transformers for converting between article data models and response schemas."""

from typing import Any
from urllib.parse import urlparse

from app.models.rss_models import ClippedArticle, Feed, FeedArticle
from app.schemas.rss_schemas import ArticleResponse


class ArticleTransformer:
    """Transforms articles between different representations."""

    def feed_to_unified(self, feed_article: FeedArticle) -> ArticleResponse:
        """Convert FeedArticle to unified ArticleResponse."""
        content = feed_article.content
        feed = feed_article.feed

        return ArticleResponse(
            id=feed_article.id,
            title=content.title if content else None,
            link=content.link if content else None,
            description=content.description if content else None,
            content=content.content if content else None,
            published_at=content.published_at if content else None,
            author=content.author if content else None,
            image_url=content.image_url if content else None,
            estimated_read_time_minutes=content.estimated_read_time_minutes
            if content
            else None,
            is_read=feed_article.is_read,
            is_read_later=feed_article.is_read_later,
            is_favorite=feed_article.is_favorite,
            feed_id=feed_article.feed_id,
            guid=getattr(feed_article, "guid", None),
            folder_id=getattr(feed, "folder_id", None) if feed else None,
            article_type="feed",
            created_at=feed_article.created_at,
            updated_at=feed_article.updated_at,
            feed=self._extract_feed_info(feed),
        )

    def clipped_to_unified(self, clipped_article: ClippedArticle) -> ArticleResponse:
        """Convert ClippedArticle to unified ArticleResponse."""
        content = clipped_article.content
        return ArticleResponse(
            id=clipped_article.id,
            title=content.title if content else None,
            link=content.link if content else None,
            description=content.description if content else None,
            content=content.content if content else None,
            published_at=clipped_article.created_at,  # Use created_at as published_at
            author=content.author if content else None,
            image_url=content.image_url if content else None,
            estimated_read_time_minutes=content.estimated_read_time_minutes
            if content
            else None,
            is_read=clipped_article.is_read,
            is_read_later=clipped_article.is_read_later,
            is_favorite=clipped_article.is_favorite,
            feed_id=None,  # No feed for clipped articles
            priority=getattr(clipped_article, "priority", None),
            note=getattr(clipped_article, "note", None),
            article_type="clipped",
            created_at=clipped_article.created_at,
            updated_at=clipped_article.created_at,  # ClippedArticle doesn't have updated_at, use created_at
            feed=None,
        )

    def raw_row_to_unified(self, row: Any) -> ArticleResponse:
        """Convert raw database row from union query to ArticleResponse."""
        # Handle both ORM objects and raw row data
        if hasattr(row, "_asdict"):
            # Handle named tuple from raw SQL
            data = row._asdict()
        elif hasattr(row, "__dict__"):
            # Handle ORM object
            data = row.__dict__
        else:
            # Handle dictionary
            data = dict(row) if hasattr(row, "items") else {}

        # Build feed info if we have feed data
        feed_info = None
        if data.get("feed_title") or data.get("feed_link"):
            feed_info = {
                "title": data.get("feed_title"),
                "link": data.get("feed_link"),
                "image_url": data.get("feed_image_url"),
            }

        return ArticleResponse(
            id=data.get("id"),
            title=data.get("title"),
            link=data.get("link"),
            description=data.get("description"),
            content=data.get("content"),
            published_at=data.get("published_at"),
            author=data.get("author"),
            image_url=data.get("image_url"),
            estimated_read_time_minutes=data.get("read_time"),
            is_read=data.get("is_read", False),
            is_read_later=data.get("is_read_later", False),
            is_favorite=data.get("is_favorite", False),
            feed_id=data.get("feed_id"),
            guid=data.get("guid"),
            folder_id=data.get("folder_id"),
            priority=data.get("priority"),
            note=data.get("note"),
            article_type=data.get("article_type", "unknown"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at", data.get("created_at")),
            feed=feed_info,
        )

    def _extract_source_domain(self, link: str | None) -> str | None:
        """Extract domain from article link."""
        if not link:
            return None

        try:
            parsed = urlparse(link)
            return parsed.netloc
        except Exception:
            return None

    def _extract_feed_info(self, feed: Feed | None) -> dict[str, Any] | None:
        """Extract feed information for response."""
        if not feed:
            return None

        return {
            "title": feed.title,
            "link": feed.link,
            "image_url": feed.image_url,
        }
