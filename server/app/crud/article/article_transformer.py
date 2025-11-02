"""Transformers for converting between article data models and response schemas."""

from typing import Any
from urllib.parse import urlparse

from app.models import ClippedArticle, Feed, FeedArticle, UserArticleState
from app.schemas import ArticleResponse


class ArticleTransformer:
    """Transforms articles between different representations."""

    @staticmethod
    def _truncate_description(description: str | None, max_length: int = 200) -> str | None:
        """Truncate description to specified length with ellipsis.

        Args:
            description: Full description text
            max_length: Maximum length for truncated version (default 200 chars)

        Returns:
            Truncated description with ellipsis if longer than max_length, or original if shorter
        """
        if not description:
            return None

        if len(description) <= max_length:
            return description

        # Find the last space before max_length to avoid cutting words
        truncated = description[:max_length]
        last_space = truncated.rfind(" ")

        if last_space > max_length * 0.8:  # Only use space if it's not too far back
            truncated = truncated[:last_space]

        return truncated.rstrip(".,;:") + "..."

    def feed_to_unified(self, feed_article: FeedArticle | tuple[FeedArticle, UserArticleState]) -> ArticleResponse:
        """Convert FeedArticle to unified ArticleResponse."""
        # Handle both single FeedArticle and tuple of (FeedArticle, UserArticleState)
        if isinstance(feed_article, tuple):
            article, user_state = feed_article
            # Handle case where user_state is None (from LEFT OUTER JOIN)
            if user_state is not None:
                is_read = user_state.is_read
                is_read_later = user_state.is_read_later
                is_favorite = user_state.is_favorite
                read_at = user_state.read_at
            else:
                # Default values when no user state exists yet
                is_read = False
                is_read_later = False
                is_favorite = False
                read_at = None
        else:
            # Legacy single FeedArticle (for backward compatibility)
            article = feed_article
            is_read = getattr(feed_article, "is_read", False)
            is_read_later = getattr(feed_article, "is_read_later", False)
            is_favorite = getattr(feed_article, "is_favorite", False)
            read_at = getattr(feed_article, "read_at", None)

        content = article.content
        feed = article.feed

        # Get description - may be None if deferred in list queries
        full_description = content.description if content else None

        # Generate preview from full description if available, otherwise use title
        description_preview = self._truncate_description(full_description)
        if not description_preview and content and content.title:
            # Fallback to truncated title if no description
            description_preview = self._truncate_description(content.title)

        return ArticleResponse(
            id=article.id,
            title=content.title if content else None,
            link=content.link if content else None,
            description=full_description,
            description_preview=description_preview,
            content=content.content if content else None,
            published_at=content.published_at if content else None,
            author=content.author if content else None,
            image_url=content.image_url if content else None,
            estimated_read_time_minutes=content.estimated_read_time_minutes if content else None,
            is_read=is_read,
            is_read_later=is_read_later,
            is_favorite=is_favorite,
            read_at=read_at,
            feed_id=article.feed_id,
            guid=getattr(article, "guid", None),
            folder_id=None,  # Will be determined from feed subscription
            article_type="feed",
            created_at=article.created_at,
            updated_at=article.updated_at,
            feed=self._extract_feed_info(feed),
        )

    def clipped_to_unified(self, clipped_article: ClippedArticle) -> ArticleResponse:
        """Convert ClippedArticle to unified ArticleResponse."""
        content = clipped_article.content

        # Get description - may be None if deferred in list queries
        full_description = content.description if content else None

        # Generate preview from full description if available
        description_preview = self._truncate_description(full_description)
        if not description_preview and content and content.title:
            description_preview = self._truncate_description(content.title)

        return ArticleResponse(
            id=clipped_article.id,
            title=content.title if content else None,
            link=content.link if content else None,
            description=full_description,
            description_preview=description_preview,
            content=content.content if content else None,
            published_at=clipped_article.created_at,  # Use created_at as published_at
            author=content.author if content else None,
            image_url=content.image_url if content else None,
            estimated_read_time_minutes=content.estimated_read_time_minutes if content else None,
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

        # Generate description preview
        full_description = data.get("description")
        description_preview = self._truncate_description(full_description)
        if not description_preview and data.get("title"):
            description_preview = self._truncate_description(data.get("title"))

        return ArticleResponse(
            id=data.get("id"),
            title=data.get("title"),
            link=data.get("link"),
            description=full_description,
            description_preview=description_preview,
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

    def to_unified(
        self, article: FeedArticle | ClippedArticle | tuple[FeedArticle, UserArticleState]
    ) -> ArticleResponse:
        """Convert any article type to unified ArticleResponse."""
        # Check the actual type to determine which transformer to use
        if isinstance(article, tuple):
            # This is a tuple of (FeedArticle, UserArticleState)
            return self.feed_to_unified(article)
        elif isinstance(article, FeedArticle):
            # This is a FeedArticle
            return self.feed_to_unified(article)
        elif isinstance(article, ClippedArticle):
            # This is a ClippedArticle
            return self.clipped_to_unified(article)
        else:
            # Unknown type - this should never happen due to type hints
            raise TypeError(f"Unsupported article type: {type(article)}")

    def _extract_feed_info(self, feed: Feed | None) -> dict[str, Any] | None:
        """Extract feed information for response."""
        if not feed:
            return None

        return {
            "title": feed.title,
            "link": feed.link,
            "image_url": feed.image_url,
        }
