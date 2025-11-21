from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_FEED_NOT_FOUND
from app.crud import crud_feed
from app.crud.profile import get_profile_by_id
from app.db.session import get_db
from app.models import Feed
from app.schemas.auth import TokenData
from app.schemas.feeds import AdminFeedUpdate
from app.schemas.subscriptions import FeedResponse
from app.services.feeds.management import FeedManagementService
from app.services.user.auth import get_current_user

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.put(
    "/{feed_id}/admin",
    response_model=FeedResponse,
    summary="[Admin] Update global feed properties",
    description="Admin-only endpoint to update global feed metadata that affects all users",
    responses={
        200: {
            "description": "Successfully updated global feed",
            "model": FeedResponse,
        },
        403: {
            "description": "Forbidden - Admin access required",
            "content": {
                "application/json": {"example": {"detail": "Admin access required"}}
            },
        },
        404: {
            "description": "Feed not found",
            "content": {"application/json": {"example": {"detail": "Feed not found"}}},
        },
        422: {
            "description": "Validation error in request body or invalid feed ID format"
        },
    },
)
async def admin_update_feed(
    feed_id: UUID,
    feed_in: AdminFeedUpdate = Body(
        ..., description="Global feed properties to update (all fields optional)"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> FeedResponse:
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
        FeedResponse: Updated feed details

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
    # Check if user is admin by fetching their profile
    from app.models.enums import UserRole

    user_profile = await get_profile_by_id(db, user_id=UUID(current_user.sub))
    if not user_profile or user_profile.role != UserRole.ADMIN:
        logger.warning(
            "Non-admin user attempted to update global feed",
            user_id=current_user.sub,
            user_role=user_profile.role if user_profile else None,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    # Get the feed from the global feeds table
    feed = await crud_feed.get_feed_by_id(db, feed_id=feed_id)
    if not feed:
        logger.warning(
            "Admin attempted to update non-existent feed",
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND
        )

    # Update the feed metadata
    try:
        updated_feed = await crud_feed.update_feed_metadata(
            db,
            feed_db=feed,
            title=feed_in.title,
            description=feed_in.description,
            link=str(feed_in.link) if feed_in.link else None,
            language=feed_in.language,
            image_url=feed_in.image_url,
            ttl=feed_in.ttl,
            skip_hours=feed_in.skip_hours,
            skip_days=feed_in.skip_days,
        )

        # Handle top_level_category separately since it's an enum
        if feed_in.top_level_category is not None:
            from app.models import FeedCategory

            # Convert string to enum if needed
            # The frontend sends the enum VALUE (e.g., "Design & Creativity")
            # We need to find the matching enum and assign the enum itself (not .value)
            if isinstance(feed_in.top_level_category, str):
                try:
                    category_enum = FeedCategory(feed_in.top_level_category)
                    # Assign the enum itself, not its value - SQLAlchemy handles conversion
                    updated_feed.top_level_category = category_enum
                except ValueError as e:
                    logger.warning(
                        "Invalid category provided",
                        category=feed_in.top_level_category,
                        feed_id=feed_id,
                    )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid category: {feed_in.top_level_category}",
                    ) from e
            else:
                # If it's already a FeedCategory enum, use it directly
                updated_feed.top_level_category = feed_in.top_level_category

            db.add(updated_feed)
            await db.flush()
            await db.refresh(updated_feed)

        # Handle popularity_score update
        if feed_in.popularity_score is not None:
            updated_feed.popularity_score = feed_in.popularity_score
            db.add(updated_feed)
            await db.flush()
            await db.refresh(updated_feed)

        # Handle URL update if provided
        if feed_in.url is not None:
            updated_feed.url = str(feed_in.url)
            db.add(updated_feed)
            await db.flush()
            await db.refresh(updated_feed)

        logger.info(
            "Admin updated global feed successfully",
            feed_id=updated_feed.id,
            user_id=current_user.sub,
        )

        # Return as FeedResponse
        feed_service = FeedManagementService(db=db, user_id=UUID(current_user.sub))
        return await feed_service.get_feed(feed_id=feed_id) or updated_feed

    except Exception as e:
        logger.error(
            "Error updating global feed",
            error=str(e),
            feed_id=feed_id,
            user_id=current_user.sub,
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
            "content": {
                "application/json": {"example": {"detail": "Admin access required"}}
            },
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
) -> JSONResponse:
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
        JSONResponse: Empty response with 204 status code on success

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
    # Check if user is admin by fetching their profile
    from app.models.enums import UserRole

    user_profile = await get_profile_by_id(db, user_id=UUID(current_user.sub))
    if not user_profile or user_profile.role != UserRole.ADMIN:
        logger.warning(
            "Non-admin user attempted to delete global feed",
            user_id=current_user.sub,
            user_role=user_profile.role if user_profile else None,
            feed_id=feed_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    # Check if feed exists first
    result = await db.execute(select(Feed).where(Feed.id == feed_id))
    feed = result.scalar_one_or_none()

    if not feed:
        logger.warning(
            "Admin attempted to delete non-existent feed",
            feed_id=feed_id,
            user_id=current_user.sub,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND
        )

    # Use raw SQL for efficient bulk deletion leveraging database cascades
    # This is much faster than ORM cascade which loads each related object individually
    from sqlalchemy import delete as sql_delete

    logger.info(
        "Admin deleting global feed with bulk SQL",
        feed_id=feed_id,
        user_id=current_user.sub,
    )

    # Delete the feed - database CASCADE will handle related records efficiently
    await db.execute(sql_delete(Feed).where(Feed.id == feed_id))

    # Delete from Meilisearch search index
    from app.core.config import get_settings
    from app.services.feeds.search.meilisearch import get_meilisearch_service

    try:
        settings = get_settings()
        meilisearch_service = get_meilisearch_service(settings)
        await meilisearch_service.delete_feed(str(feed_id))
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
    # Return 204 No Content without a response body
    from starlette.responses import Response

    return Response(status_code=status.HTTP_204_NO_CONTENT)
