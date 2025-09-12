"""RSS Similar Feeds API router."""

from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.auth import TokenData
from app.services.auth import get_current_user
from app.services.feed_similarity_service import FeedSimilarityService

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/similar", tags=["RSS Similar Feeds"])


@router.get("/{feed_id}", response_model=dict[str, Any])
async def get_similar_feeds(
    feed_id: UUID,
    limit: int = Query(10, ge=1, le=20, description="Maximum number of similar feeds to return"),
    min_similarity: float = Query(0.1, ge=0.0, le=1.0, description="Minimum similarity score threshold"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get feeds similar to the specified feed using vector similarity."""
    similarity_service = FeedSimilarityService(db=db, user_id=UUID(current_user.sub))

    try:
        # Get the source feed info first
        source_feed = await similarity_service._get_user_feed(feed_id)
        if not source_feed:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Source feed not found"
            )

        similar_feeds = await similarity_service.get_similar_feeds(
            feed_id=feed_id,
            limit=limit,
            min_similarity=min_similarity
        )

        logger.info(
            "Similar feeds retrieved",
            feed_id=feed_id,
            user_id=current_user.sub,
            results_count=len(similar_feeds)
        )

        # Return both source feed info and similar feeds
        return {
            "source_feed": {
                "id": str(source_feed.id),
                "title": source_feed.title,
                "description": source_feed.description,
                "url": str(source_feed.url),
                "link": similarity_service._normalize_url(source_feed.link),
                "image_url": similarity_service._normalize_url(source_feed.image_url),
            },
            "similar_feeds": similar_feeds
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error retrieving similar feeds",
            feed_id=feed_id,
            user_id=current_user.sub,
            error=str(e),
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while finding similar feeds."
        )
