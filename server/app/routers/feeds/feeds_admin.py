"""Admin feed routes - update and delete global feed properties."""

from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import ERROR_FEED_NOT_FOUND
from app.crud.feed.core import admin_update_feed as crud_admin_update_feed
from app.crud.feed.core import delete_feed as crud_delete_feed
from app.crud.feed.core import get_feed_by_id
from app.crud.profile import get_profile_by_id
from app.db.session import get_db
from app.models.enums import UserRole
from app.services.feeds.meilisearch import delete_feed as meilisearch_delete_feed
from app.services.user.auth import get_current_user
from app.typing.feeds import AdminFeedUpdate, FeedDetail
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.put(
    "/{feed_id}/admin",
    response_model=FeedDetail,
    summary="[Admin] Update global feed properties",
    description="Admin-only endpoint to update global feed metadata that affects all users",
    responses={
        200: {
            "description": "Successfully updated global feed",
            "model": FeedDetail,
        },
        403: {
            "description": "Forbidden - Admin access required",
            "content": {"application/json": {"example": {"detail": "Admin access required"}}},
        },
        404: {
            "description": "Feed not found",
            "content": {"application/json": {"example": {"detail": "Feed not found"}}},
        },
        422: {"description": "Validation error in request body or invalid feed ID format"},
    },
)
async def admin_update_feed(
    feed_id: UUID,
    feed_in: AdminFeedUpdate = Body(..., description="Global feed properties to update (all fields optional)"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> FeedDetail:
    """
    Update global feed properties (admin only).

    This endpoint allows administrators to modify the global feed metadata
    that affects all users subscribed to the feed. This includes fields like
    title, description, language, category, and image URL.

    Args:
        feed_id: UUID of the feed to update
        feed_in: Feed update data with optional fields to modify
        db: Database session dependency
        current_user: Authenticated user information (must be admin)

    Returns:
        FeedDetail: Updated feed details

    Updatable Fields:
        - title: Feed title
        - description: Feed description
        - language: Feed language code
        - top_level_category: Feed category classification
        - link: Feed website URL
        - image_url: Feed icon/logo URL
        - url: RSS feed URL

    Raises:
        HTTPException:
            - 403: User is not an admin
            - 404: Feed not found
            - 422: Invalid request format or feed ID

    Note:
        - Requires admin role
        - Updates affect all users subscribed to the feed
        - Changes are applied to the global feed record
    """
    # Check if user is admin
    user_profile = await get_profile_by_id(db, user_id=UUID(current_user.sub))
    if user_profile is None:
        logger.warning(
            "User profile not found",
            user_id=current_user.sub,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    if user_profile.role != UserRole.ADMIN:
        logger.warning(
            "Non-admin user attempted to update global feed",
            user_id=current_user.sub,
            user_role=user_profile.role,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    # Get the feed from the global feeds table
    feed = await get_feed_by_id(db, feed_id=feed_id)
    if not feed:
        logger.warning(
            "Admin attempted to update non-existent feed",
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

    # Update the feed metadata using CRUD function
    try:
        updated_feed = await crud_admin_update_feed(
            db,
            feed=feed,
            title=feed_in.title,
            description=feed_in.description,
            link=feed_in.link,
            language=feed_in.language,
            image_url=feed_in.image_url,
            url=str(feed_in.url) if feed_in.url else None,
            ttl=feed_in.ttl,
            skip_hours=feed_in.skip_hours,
            skip_days=feed_in.skip_days,
            top_level_category=feed_in.top_level_category,
            popularity_score=feed_in.popularity_score,
        )

        logger.info(
            "Admin updated global feed successfully",
            feed_id=updated_feed.id,
            user_id=current_user.sub,
        )

        return FeedDetail.model_validate(updated_feed, from_attributes=True)

    except ValueError as e:
        logger.warning(
            "Invalid feed update data",
            error=str(e),
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.error(
            "Error updating global feed",
            error=str(e),
            feed_id=feed_id,
            user_id=current_user.sub,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        ) from e


@router.delete(
    "/{feed_id}/admin",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="[Admin] Delete global feed",
    description="Admin-only endpoint to permanently delete a feed from the platform for all users",
    responses={
        204: {"description": "Successfully deleted global feed"},
        403: {
            "description": "Forbidden - Admin access required",
            "content": {"application/json": {"example": {"detail": "Admin access required"}}},
        },
        404: {
            "description": "Feed not found",
            "content": {"application/json": {"example": {"detail": "Feed not found"}}},
        },
        422: {"description": "Invalid feed ID format"},
    },
)
async def admin_delete_feed(
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> Response:
    """
    Delete global feed (admin only).

    This endpoint allows administrators to permanently delete a feed from
    the entire platform. This will remove the feed and all its articles
    for ALL users subscribed to it.

    Args:
        feed_id: UUID of the feed to delete
        db: Database session dependency
        current_user: Authenticated user information (must be admin)

    Returns:
        Response: Empty response with 204 status code on success

    Raises:
        HTTPException:
            - 403: User is not an admin
            - 404: Feed not found
            - 422: Invalid feed ID format

    Note:
        - Requires admin role
        - Permanently deletes the feed for ALL users
        - Cascading deletion removes all associated articles and subscriptions
        - This action cannot be undone
    """
    # Check if user is admin
    user_profile = await get_profile_by_id(db, user_id=UUID(current_user.sub))
    if user_profile is None:
        logger.warning(
            "User profile not found",
            user_id=current_user.sub,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    if user_profile.role != UserRole.ADMIN:
        logger.warning(
            "Non-admin user attempted to delete global feed",
            user_id=current_user.sub,
            user_role=user_profile.role,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    # Delete the feed using CRUD function
    logger.info(
        "Admin deleting global feed",
        feed_id=feed_id,
        user_id=current_user.sub,
    )

    deleted = await crud_delete_feed(db, feed_id=feed_id)
    if not deleted:
        logger.warning(
            "Admin attempted to delete non-existent feed",
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

    # Delete from Meilisearch search index
    try:
        settings = get_settings()
        await meilisearch_delete_feed(settings, str(feed_id))
        logger.info(
            "Admin deleted feed from Meilisearch",
            feed_id=feed_id,
            user_id=current_user.sub,
        )
    except Exception as e:
        logger.error(
            "Failed to delete feed from Meilisearch",
            feed_id=feed_id,
            user_id=current_user.sub,
            error=str(e),
        )
        # Don't fail the request if Meilisearch deletion fails
        # The feed is already deleted from the database

    logger.info(
        "Admin deleted global feed successfully",
        feed_id=feed_id,
        user_id=current_user.sub,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
