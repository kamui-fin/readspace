"""RSS Feed Discovery Router - Preview functionality only.

Note: Search functionality has been migrated to Meilisearch with direct frontend integration.
The frontend now uses React InstantSearch to query Meilisearch directly.
"""

import time
from datetime import datetime
from typing import Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import MAX_PAGE_SIZE
from app.db.session import get_db
from app.services.feeds.feed_creation import FeedCreationService
from app.utils.rsshub_url_transformer import transform_rsshub_url

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/discover", tags=["RSS Discovery"])


@router.get("/preview/articles")
async def get_preview_articles(
    *,
    db: AsyncSession = Depends(get_db),
    url: str = Query(..., description="RSS feed URL to preview"),
    limit: int = Query(25, ge=1, le=MAX_PAGE_SIZE, description="Maximum number of articles to return"),
) -> dict[str, Any]:
    """
    Get articles from an RSS feed URL for preview purposes.

    This endpoint fetches and parses an RSS feed directly without requiring database storage.
    Used when users want to preview feed content before subscribing.
    """
    try:
        # Create a temporary service instance for fetching articles
        temp_service = FeedCreationService(db, user_id=uuid4())

        # Transform rsshub:// URLs to actual HTTP URLs for fetching
        fetch_url = transform_rsshub_url(url)

        # Fetch and parse the RSS feed using the transformed URL
        fetch_result = await temp_service._fetch_feed_content(fetch_url)
        if fetch_result["status"] != 200 or not fetch_result["content"]:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not fetch RSS feed content",
            )

        # Parse the feed using the transformed URL
        parsed_feed = temp_service._parse_feed_data(fetch_result["content"], fetch_url)

        # Extract articles from the parsed feed (limit to requested amount)
        articles = []
        feed_entries = getattr(parsed_feed, "entries", [])[:limit]

        for i, entry in enumerate(feed_entries):
            # Create a preview article object
            article = {
                "id": f"preview_article_{hash(url)}_{i}",
                "feed_id": f"preview_feed_{hash(url)}",
                "content_id": f"preview_content_{hash(url)}_{i}",
                "title": getattr(entry, "title", "Untitled"),
                "author": getattr(entry, "author", None),
                "url": getattr(entry, "link", ""),
                "published_at": _parse_entry_date(entry),
                "excerpt": _extract_excerpt(entry),
                "content": {
                    "content_html": getattr(entry, "content", [{}])[0].get("value", "")
                    if hasattr(entry, "content")
                    else getattr(entry, "summary", ""),
                    "content_text": None,
                },
            }
            articles.append(article)

        response = {
            "articles": articles,
            "feed": {
                "id": f"preview_feed_{hash(url)}",
                "title": getattr(parsed_feed.get("feed", {}), "title", "Preview Feed"),
                "description": getattr(parsed_feed.get("feed", {}), "description", ""),
                "url": url,
                "link": getattr(parsed_feed.get("feed", {}), "link", ""),
            },
            "total_count": len(articles),
        }

        logger.info("Feed preview generated", url=fetch_url, articles_count=len(articles))

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error previewing feed articles", url=url, error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while previewing the feed",
        ) from e


def _parse_entry_date(entry: Any) -> datetime | None:
    """Parse published date from feed entry."""
    try:
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            return datetime(*entry.published_parsed[:6])
        if hasattr(entry, "updated_parsed") and entry.updated_parsed:
            return datetime(*entry.updated_parsed[:6])
    except Exception:
        pass
    return None


def _extract_excerpt(entry: Any) -> str | None:
    """Extract a short excerpt from feed entry."""
    try:
        if hasattr(entry, "summary"):
            summary = entry.summary
            # Strip HTML and limit length
            import re

            text = re.sub(r"<[^>]+>", "", summary)
            return text[:500] if len(text) > 500 else text
    except Exception:
        pass
    return None
