from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import ERROR_FEED_NOT_FOUND
from app.core.dependencies import get_current_admin
from app.crud.feed.core import admin_update_feed as crud_admin_update_feed
from app.crud.feed.core import delete_feed as crud_delete_feed
from app.crud.feed.core import get_feed_by_id
from app.db.session import get_db
from app.models.user import Profile
from app.services.feeds.meilisearch import delete_feed as meilisearch_delete_feed
from app.services.feeds.meilisearch import sync_feed
from app.typing.feeds import AdminFeedUpdate, FeedDetail

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.put(
    "/{feed_id}/admin",
    response_model=FeedDetail,
    summary="[Admin] Update global feed properties",
    description="Admin-only endpoint to update global feed metadata that affects all users",
    responses={
        200: {"description": "Successfully updated global feed", "model": FeedDetail},
        403: {"description": "Forbidden - Admin access required"},
        404: {"description": "Feed not found"},
    },
)
async def admin_update_feed(
    feed_id: UUID,
    feed_in: Annotated[AdminFeedUpdate, Body(..., description="Global feed properties to update")],
    admin_profile: Annotated[Profile, Depends(get_current_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FeedDetail:
    # 1. Bind context for all logs in this scope
    log = logger.bind(feed_id=str(feed_id), user_id=str(admin_profile.id))

    # 2. Check existence
    feed = await get_feed_by_id(db, feed_id=feed_id)
    if not feed:
        log.warning("Admin attempted to update non-existent feed")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

    # 3. Perform Update
    try:
        updated_feed = await crud_admin_update_feed(
            db,
            feed=feed,
            title=feed_in.title,
            description=feed_in.description,
            link=str(feed_in.link) if feed_in.link else None,
            language=feed_in.language,
            image_url=feed_in.image_url,
            url=str(feed_in.url) if feed_in.url else None,
            top_level_category=feed_in.top_level_category,
            popularity_score=feed_in.popularity_score,
            tags=feed_in.tags,
            author=feed_in.author,
        )

        # Sync to Meilisearch after admin update
        try:
            settings = get_settings()
            await sync_feed(settings, updated_feed)
            log.info("Admin updated feed in Meilisearch")
        except Exception as e:
            log.warning("Failed to sync feed to Meilisearch", error=str(e))

        log.info("Admin updated global feed successfully")
        return FeedDetail.model_validate(updated_feed, from_attributes=True)

    except ValueError as e:
        log.warning("Invalid feed update data", error=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        log.error("Error updating global feed", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        ) from e


@router.delete(
    "/{feed_id}/admin",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="[Admin] Delete global feed",
    responses={
        204: {"description": "Successfully deleted global feed"},
        403: {"description": "Forbidden - Admin access required"},
        404: {"description": "Feed not found"},
    },
)
async def admin_delete_feed(
    feed_id: UUID,
    admin_profile: Annotated[Profile, Depends(get_current_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    # 1. Bind context
    log = logger.bind(feed_id=str(feed_id), user_id=str(admin_profile.id))

    log.info("Admin deleting global feed")

    # 2. Database Deletion
    deleted = await crud_delete_feed(db, feed_id=feed_id)
    if not deleted:
        log.warning("Admin attempted to delete non-existent feed")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_FEED_NOT_FOUND)

    # 3. Search Index Deletion (Best Effort)
    try:
        settings = get_settings()
        await meilisearch_delete_feed(settings, str(feed_id))
        log.info("Admin deleted feed from Meilisearch")
    except Exception as e:
        # We log error but do not raise, as DB deletion succeeded
        log.error("Failed to delete feed from Meilisearch", error=str(e))

    return Response(status_code=status.HTTP_204_NO_CONTENT)
