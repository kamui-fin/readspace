"""Article count routes - consolidated unread counts."""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.article.counts import (
    count_read_later_articles,
    count_today_articles,
    get_unread_counts_per_feed,
)
from app.db.session import get_db
from app.schemas.auth import TokenData
from app.services.user.auth import get_current_user

router = APIRouter()


@router.get(
    "/counts",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Get article counts",
    description="Retrieve unread counts per feed, read later count, and today's count",
    responses={
        200: {
            "description": "Successfully retrieved article counts",
            "content": {
                "application/json": {
                    "example": {
                        "feed_counts": {
                            "feed-uuid-1": 15,
                            "feed-uuid-2": 8,
                            "feed-uuid-3": 0,
                        },
                        "read_later": 5,
                        "today": 8,
                    }
                }
            },
        },
    },
)
async def get_article_counts(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """
    Retrieve article counts: per-feed unread counts, read later count, and today's count.

    This endpoint provides all count statistics needed by the frontend in a single call.
    The frontend can use feed_counts to calculate per-folder counts by grouping feeds.

    Args:
        db: Database session dependency
        current_user: Authenticated user token data

    Returns:
        dict: Count statistics:
        - feed_counts: Dictionary mapping feed_id (as string) to unread count
        - read_later: Number of articles marked as read later
        - today: Number of articles published today

    Note:
        - Only includes feeds the user is subscribed to
        - Feeds with 0 unread articles are included in feed_counts
        - Uses optimized queries for better performance
        - Frontend should calculate per-folder counts by grouping feed_counts by folder_id
    """
    user_id = UUID(current_user.sub)

    feed_counts = await get_unread_counts_per_feed(db=db, user_id=user_id)
    read_later = await count_read_later_articles(db=db, user_id=user_id)
    today = await count_today_articles(db=db, user_id=user_id)

    return {
        "feed_counts": {str(feed_id): count for feed_id, count in feed_counts.items()},
        "read_later": read_later,
        "today": today,
    }
