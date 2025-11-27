"""RSS Feed Discovery Router - Preview functionality only.

Note: Search functionality has been migrated to Meilisearch with direct frontend integration.
The frontend now uses React InstantSearch to query Meilisearch directly.
"""

from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query, status

from app.services.feeds import fetching, parsing

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/discover", tags=["RSS Discovery"])


@router.get("/preview")
async def get_feed_preview(
    *,
    url: str = Query(..., description="RSS feed URL to preview"),
) -> dict[str, Any]:
    """
    Get feed metadata from an RSS feed URL for preview purposes.

    Fetches and parses an RSS feed to extract metadata without storing it.
    """
    # Fetch feed content
    fetch_result = await fetching.fetch_feed_content(url)
    if fetch_result["error"] or not fetch_result["content"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=fetch_result["error"] or "Could not fetch RSS feed content",
        )

    # Parse feed content
    try:
        parsed = parsing.parse_feed_content(fetch_result["content"], url)
        logger.info("Feed preview generated", url=url, title=response["title"])
        return parsed
    except Exception as e:
        logger.error("Feed parse failed", url=url, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse feed",
        ) from e
