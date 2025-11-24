"""Simplified transformer for new unified schema."""

from typing import Any
from urllib.parse import urlparse

from app.models import Feed, FeedArticle, UserEntry
from app.schemas import ArticleResponse


class ArticleTransformer:
    """Transform database models to API responses."""

    @staticmethod
    def _extract_source_domain(link: str | None) -> str | None:
        """Extract domain from URL."""
        if not link:
            return None
        try:
            parsed = urlparse(link)
            return parsed.netloc or None
        except Exception:
            return None

    @staticmethod
    def _extract_feed_info(feed: Feed | None) -> dict[str, Any] | None:
        """Extract feed information."""
        if not feed:
            return None

        return {
            "id": feed.id,
            "title": feed.title,
            "url": feed.url,
            "link": feed.link,
            "image_url": feed.image_url,
        }

    @staticmethod
    def _truncate_description(description: str | None, max_length: int = 200) -> str | None:
        """Truncate description to max length."""
        if not description:
            return None
        if len(description) <= max_length:
            return description
        return description[:max_length].rsplit(" ", 1)[0] + "..."

    def entry_to_response(
        self,
        feed_article: FeedArticle,
        user_entry: UserEntry | None = None,
    ) -> ArticleResponse:
        """
        Convert FeedArticle + UserEntry to ArticleResponse.
        """
        content = feed_article.content
        feed = feed_article.feed

        # Extract user state
        is_read = user_entry.is_read if user_entry else False
        is_read_later = user_entry.is_read_later if user_entry else False
        is_favorite = user_entry.is_favorite if user_entry else False
        read_at = user_entry.read_at if user_entry else None
        user_note = user_entry.user_note if user_entry else None
        user_tags = user_entry.user_tags if user_entry else None

        return ArticleResponse(
            id=feed_article.id,
            title=content.title,
            link=content.link,
            description=self._truncate_description(content.description),
            content=content.content,
            image_url=content.image_url,
            author=content.author,
            published_at=feed_article.published_at,  # Use denormalized value!
            estimated_read_time_minutes=content.estimated_read_time_minutes,
            source_domain=self._extract_source_domain(content.link),
            is_read=is_read,
            is_read_later=is_read_later,
            is_favorite=is_favorite,
            read_at=read_at,
            user_note=user_note,
            user_tags=user_tags,
            article_type="feed",
            created_at=feed_article.created_at,
            feed=self._extract_feed_info(feed),
        )

    def to_response(
        self,
        article: FeedArticle | tuple[FeedArticle, UserEntry | None],
    ) -> ArticleResponse:
        """
        Convert article to response - handles both single and tuple formats.
        """
        if isinstance(article, tuple):
            feed_article, user_entry = article
            return self.entry_to_response(feed_article, user_entry)
        else:
            return self.entry_to_response(article, None)

    def raw_row_to_response(self, row: Any) -> ArticleResponse:
        """Convert raw SQLAlchemy row to response."""
        if hasattr(row, "_tuple"):
            # Row from query result
            feed_article, user_entry = row._tuple()
            return self.entry_to_response(feed_article, user_entry)
        else:
            # Single object
            return self.entry_to_response(row, None)
