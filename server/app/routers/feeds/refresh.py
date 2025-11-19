import time
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_FEED_NOT_FOUND
from app.core.custom_exceptions import (
    FeedConnectionError,
    FeedParsingError,
    FeedValidationError,
)
from app.core.metrics import feed_operation_duration_seconds, feed_operations_total
from app.db.session import get_db
from app.schemas.auth import TokenData
from app.schemas.subscriptions import FeedResponse
from app.services.feeds.feed_management import FeedManagementService
from app.services.user.auth import get_current_user

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post(
    "/{feed_id}/refresh",
    response_model=FeedResponse,
    summary="Refresh RSS feed",
    description="Manually trigger a refresh of a specific RSS feed to fetch new articles",
    responses={
        200: {
            "description": "Successfully triggered/completed feed refresh",
            "model": FeedResponse,
        },
        400: {
            "description": "Bad request - feed validation or parsing error",
            "content": {
                "application/json": {
                    "examples": {
                        "parsing_error": {
                            "summary": "Feed parsing failed",
                            "value": {"detail": "Invalid RSS/XML format"},
                        },
                        "validation_error": {
                            "summary": "Feed validation failed",
                            "value": {"detail": "Feed content validation failed"},
                        },
                    }
                }
            },
        },
        404: {
            "description": "Feed not found or user not subscribed (unless preview mode)",
            "content": {"application/json": {"example": {"detail": "Feed not found"}}},
        },
        422: {"description": "Invalid feed ID format or query parameters"},
        503: {
            "description": "Service unavailable - could not connect to feed URL",
            "content": {
                "application/json": {
                    "example": {"detail": "Could not connect to feed URL during refresh: Connection timeout"}
                }
            },
        },
        500: {"description": "Internal server error during feed refresh"},
    },
)
async def refresh_feed(
    feed_id: UUID,
    force_refetch: bool = Query(
        False,
        description="Force refetch even if not modified based on ETag/Last-Modified headers",
    ),
    preview: bool = Query(
        False,
        description="Preview mode - refresh feed without requiring user subscription",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> FeedResponse:
    """
    Manually trigger a refresh of a specific RSS feed to fetch new articles.

    This endpoint initiates an immediate refresh of the specified RSS feed,
    bypassing the normal scheduled refresh cycle. It fetches the latest content
    from the feed URL, parses new articles, and updates the database.

    Args:
        feed_id: UUID of the feed to refresh
        force_refetch: If True, ignores ETag/Last-Modified headers and forces full refetch
        preview: If True, allows refresh without user subscription (for feed preview)
        db: Database session dependency
        current_user: Authenticated user information

    Returns:
        FeedResponse: Updated feed details after refresh completion

    Refresh Process:
        1. Validates user access to the feed (unless preview mode)
        2. Fetches current feed content from the source URL
        3. Respects HTTP caching headers (ETag, Last-Modified) unless force_refetch=True
        4. Parses RSS/Atom content and extracts articles
        5. Updates feed metadata and adds new articles to database
        6. Returns updated feed information

    Raises:
        HTTPException:
            - 400: Feed parsing errors or content validation failures
            - 404: Feed not found or user not subscribed (unless preview mode)
            - 503: Network connectivity issues or feed server unavailable
            - 500: Unexpected errors during refresh process

    Note:
        - Requires authentication
        - In normal mode, user must be subscribed to refresh the feed
        - Preview mode allows refreshing any feed for evaluation
        - Force refetch bypasses HTTP caching for immediate updates
        - Refresh is synchronous and may take several seconds for large feeds
    """
    start_time = time.perf_counter()
    feed_service = FeedManagementService(db=db, user_id=UUID(current_user.sub))
    try:
        refreshed_feed = await feed_service.refresh_feed(
            feed_id=feed_id, force_refetch=force_refetch, preview_mode=preview
        )
        if not refreshed_feed:
            logger.warning(
                "Feed not found for refresh or access denied",
                feed_id=feed_id,
                user_id=current_user.sub,
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

        # Record success metrics
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="refresh", status="success").inc()
        feed_operation_duration_seconds.labels(operation="refresh").observe(duration)

        logger.info(
            "Feed refresh triggered/completed",
            feed_id=refreshed_feed.id,
            user_id=current_user.sub,
            duration_seconds=round(duration, 3),
        )
        return refreshed_feed
    except FeedConnectionError as e:
        # Record connection error metrics
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="refresh", status="connection_error").inc()
        feed_operation_duration_seconds.labels(operation="refresh").observe(duration)

        logger.error(
            "Connection error refreshing feed",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
            duration_seconds=round(duration, 3),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not connect to feed URL during refresh: {e}",
        ) from e
    except (FeedValidationError, FeedParsingError) as e:
        # Record validation/parsing error metrics
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="refresh", status="validation_error").inc()
        feed_operation_duration_seconds.labels(operation="refresh").observe(duration)

        logger.warning(
            "Validation/parsing error during feed refresh",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
            duration_seconds=round(duration, 3),
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except HTTPException:
        # Record metrics for HTTP exceptions
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="refresh", status="http_error").inc()
        feed_operation_duration_seconds.labels(operation="refresh").observe(duration)
        # Re-raise HTTP exceptions (like feed not found)
        raise
    except Exception as e:
        # Record metrics for unexpected errors
        duration = time.perf_counter() - start_time
        feed_operations_total.labels(operation="refresh", status="error").inc()
        feed_operation_duration_seconds.labels(operation="refresh").observe(duration)

        logger.error(
            "Unexpected error refreshing feed",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
            duration_seconds=round(duration, 3),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during feed refresh.",
        ) from e
