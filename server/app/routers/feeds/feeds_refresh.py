"""Feed refresh routes - manually trigger feed updates."""

from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.constants import ERROR_FEED_NOT_FOUND
from app.core.custom_exceptions import FeedConnectionError, FeedParsingError, FeedValidationError
from app.db.session import get_db_factory
from app.services.feeds.service import refresh_feed
from app.services.user.auth import get_current_user
from app.typing.feeds import FeedDetail
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post(
    "/{feed_id}/refresh",
    response_model=FeedDetail,
    summary="Refresh RSS feed",
    description="Manually trigger a refresh of a specific RSS feed to fetch new articles",
    responses={
        200: {
            "description": "Successfully triggered/completed feed refresh",
            "model": FeedDetail,
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
async def refresh_feed_route(
    feed_id: UUID,
    force_refetch: bool = Query(
        False,
        description="Force refetch even if not modified based on ETag/Last-Modified headers",
    ),
    preview: bool = Query(
        False,
        description="Preview mode - refresh feed without requiring user subscription",
    ),
    db_factory=Depends(get_db_factory),
    current_user: TokenData = Depends(get_current_user),
) -> FeedDetail:
    """
    Manually trigger a refresh of a specific RSS feed to fetch new articles.

    This endpoint initiates an immediate refresh of the specified RSS feed,
    bypassing the normal scheduled refresh cycle. It fetches the latest content
    from the feed URL, parses new articles, and updates the database.

    Args:
        feed_id: UUID of the feed to refresh
        force_refetch: If True, ignores ETag/Last-Modified headers and forces full refetch
        preview: If True, allows refresh without user subscription (for feed preview)
        db_factory: Database session factory
        current_user: Authenticated user information

    Returns:
        FeedDetail: Updated feed details after refresh completion

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
    try:
        refreshed_feed = await refresh_feed(
            session_factory=db_factory,
            feed_id=feed_id,
            force=force_refetch,
        )

        if not refreshed_feed:
            logger.warning(
                "Feed not found for refresh or access denied",
                feed_id=feed_id,
                user_id=current_user.sub,
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

        logger.info(
            "Feed refresh triggered/completed",
            feed_id=refreshed_feed.id,
            user_id=current_user.sub,
        )
        return refreshed_feed
    except FeedConnectionError as e:
        logger.error(
            "Connection error refreshing feed",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not connect to feed URL during refresh: {e}",
        ) from e
    except (FeedValidationError, FeedParsingError) as e:
        logger.warning(
            "Validation/parsing error during feed refresh",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Unexpected error refreshing feed",
            error=str(e),
            user_id=current_user.sub,
            feed_id=feed_id,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during feed refresh.",
        ) from e
