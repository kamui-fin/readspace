"""RSS Feed Discovery Router - Preview functionality only.

Note: Search functionality has been migrated to Meilisearch with direct frontend integration.
The frontend now uses React InstantSearch to query Meilisearch directly.
"""

from typing import Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.feeds.creation import FeedCreationService
from app.utils.url.rsshub_url_transformer import transform_rsshub_url

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/discover", tags=["RSS Discovery"])


@router.get("/preview")
async def get_feed_preview(
    *,
    db: AsyncSession = Depends(get_db),
    url: str = Query(..., description="RSS feed URL to preview"),
) -> dict[str, Any]:
    """
    Get feed metadata from an RSS feed URL for preview purposes.

    This endpoint fetches and parses an RSS feed to extract metadata without storing it.
    Returns a FeedDiscoveryResult that can be displayed to users before subscribing.
    """
    try:
        # Create a temporary service instance for fetching feed metadata
        temp_service = FeedCreationService(db)

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

        # Extract feed metadata
        feed_info = parsed_feed.get("feed", {})
        feed_id = f"preview_feed_{hash(url)}"

        # Build response matching FeedDiscoveryResult schema
        response = {
            "id": feed_id,
            "title": getattr(feed_info, "title", None) or "Untitled Feed",
            "description": getattr(feed_info, "description", None),
            "url": fetch_url,  # The RSS feed URL
            "link": getattr(feed_info, "link", None),  # The website URL
            "image_url": _extract_feed_image(feed_info),
            "tags": _extract_feed_tags(feed_info),
            "language": getattr(feed_info, "language", None),
            "category": None,  # Not available from feed parsing
            "popularity_score": 0.0,  # Not available for preview feeds
            "relevance": 1.0,  # Max relevance for direct URL match
            "search_metadata": None,
            "is_preview": True,
            "preview_url": url,  # Original URL provided by user
        }

        logger.info("Feed preview generated", url=fetch_url, title=response["title"])

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error previewing feed", url=url, error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while previewing the feed",
        ) from e


def _extract_feed_image(feed_info: Any) -> str | None:
    """Extract feed image URL from parsed feed."""
    try:
        # Try common feed image locations
        if hasattr(feed_info, "image") and isinstance(feed_info.image, dict):
            return feed_info.image.get("href") or feed_info.image.get("url")
        if hasattr(feed_info, "logo"):
            return feed_info.logo
        if hasattr(feed_info, "icon"):
            return feed_info.icon
    except Exception:
        logger.debug("Failed to extract feed image", exc_info=True)
    return None


def _extract_feed_tags(feed_info: Any) -> list[str]:
    """Extract tags/categories from parsed feed."""
    try:
        tags = []
        if hasattr(feed_info, "tags"):
            tags.extend([tag.get("term") for tag in feed_info.tags if isinstance(tag, dict) and tag.get("term")])
        if hasattr(feed_info, "categories"):
            tags.extend([cat for cat in feed_info.categories if isinstance(cat, str)])
        return tags[:10]  # Limit to 10 tags
    except Exception:
        logger.debug("Failed to extract feed tags", exc_info=True)
    return []
