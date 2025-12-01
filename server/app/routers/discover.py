"""RSS Feed Discovery Router - Preview functionality only.

Note: Search functionality has been migrated to Meilisearch with direct frontend integration.
The frontend now uses React InstantSearch to query Meilisearch directly.
"""

import structlog
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.db.session import get_db_factory
from app.typing.user import TokenData
from app.core.dependencies import get_current_user
from app.services.feeds import fetching, parsing, service
from app.crud.feed.subscription import get_subscription_by_feed_id
from app.typing.feeds import ParsedFeed

from app.utils.urls import normalize_feed_url

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/discover", tags=["RSS Discovery"])


@router.get("/preview")
async def get_feed_preview(
    *,
    url: str = Query(..., description="RSS feed URL to preview"),
    db_factory=Depends(get_db_factory),
    current_user: TokenData = Depends(get_current_user),
) -> ParsedFeed:
    """
    Get feed metadata from an RSS feed URL for preview purposes.

    Fetches and parses an RSS feed to extract metadata without storing it.
    Also checks if the user is already subscribed to this feed.
    """
    # Fetch feed content
    fetch_result = await fetching.fetch_feed_content(url)
    if fetch_result["error"] or not fetch_result["content"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=fetch_result["error"] or "Could not fetch RSS feed content",
        )

    # Determine canonical URL from fetch result
    final_url = fetch_result.get("final_url") or url
    final_normalized_url = normalize_feed_url(final_url)

    # Parse feed content
    try:
        parsed = parsing.parse_feed_content(fetch_result["content"], final_url)

        # Check if feed exists and if user is subscribed
        async with db_factory() as db:
            existing_feed = await service.feed_crud.get_feed_by_url(
                db, url=final_normalized_url
            )
            if existing_feed:
                parsed.id = str(existing_feed.id)
                subscription = await get_subscription_by_feed_id(
                    db, feed_id=existing_feed.id, user_id=UUID(current_user.sub)
                )
                parsed.is_subscribed = subscription is not None

        logger.info(
            "Feed preview generated",
            url=final_normalized_url,
            title=parsed.title,
            is_subscribed=parsed.is_subscribed,
        )
        return parsed
    except Exception as e:
        logger.error("Feed parse failed", url=url, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse feed",
        ) from e
