import time
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.auth import TokenData
from app.services.articles.management import ArticleManagementService
from app.services.user.auth import get_current_user

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get(
    "/unread-counts",
    response_model=dict[str, int],
    status_code=status.HTTP_200_OK,
    summary="Get global unread article counts",
    description="Retrieve global unread article counts (total, read later, today)",
    responses={
        200: {
            "description": "Successfully retrieved unread counts",
            "content": {
                "application/json": {
                    "example": {
                        "total_unread": 42,
                        "read_later_count": 5,
                        "today_count": 8,
                    }
                }
            },
        },
    },
)
async def get_unread_article_counts(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict[str, int]:
    """
    Retrieve global unread article counts.

    [Performance logging enabled]

    This endpoint provides global unread article statistics to power UI elements like
    badges, notifications, and navigation counters.

    Args:
        db: Database session dependency
        current_user: Authenticated user token data

    Returns:
        dict[str, int]: Unread count statistics:
        - total_unread: Total unread articles (feed + clipped)
        - read_later_count: Articles marked as read later
        - today_count: Unread articles from last 24 hours

    Note:
        - Only counts articles from feeds the user is subscribed to
        - Counts are calculated in real-time using optimized COALESCE queries
        - Per-folder counts removed - use /feeds/unread-counts for per-feed counts
        - Frontend should calculate per-folder counts from per-feed counts
    """
    request_start = time.perf_counter()
    logger.debug("unread_counts: Request received", user_id=current_user.sub)

    service_start = time.perf_counter()
    article_service = ArticleManagementService(db=db, user_id=UUID(current_user.sub))
    logger.debug("unread_counts: Service created", elapsed_ms=(time.perf_counter() - service_start) * 1000)

    query_start = time.perf_counter()
    result = await article_service.get_all_unread_counts()

    query_duration = (time.perf_counter() - query_start) * 1000
    total_duration = (time.perf_counter() - request_start) * 1000

    logger.warning("unread_counts: Complete",
                query_duration_ms=round(query_duration, 2),
                total_duration_ms=round(total_duration, 2))

    return result
