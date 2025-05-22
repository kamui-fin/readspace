from typing import List, Optional
from uuid import UUID

import structlog
from app.crud import crud_tag
from app.db.session import get_db
from app.schemas.auth import TokenData
from app.schemas.rss_schemas import FeedCreate, FeedResponse, FeedUpdate
from app.services.auth import get_current_user
from app.services.rss_service import RssService
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post("/feeds/", response_model=FeedResponse, status_code=status.HTTP_201_CREATED)
async def add_new_feed(
    *, 
    db: AsyncSession = Depends(get_db),
    feed_in: FeedCreate = Body(...),
    current_user: TokenData = Depends(get_current_user)
):
    """Add a new RSS feed by URL, associate with a folder and optional tags."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        tag_names_to_pass: Optional[List[str]] = None
        if feed_in.tag_ids:
            tag_names_list = []
            for tag_id in feed_in.tag_ids:
                tag_db = await crud_tag.get_tag(db, tag_id=tag_id, user_id=UUID(current_user.sub))
                if tag_db:
                    tag_names_list.append(tag_db.name)
                else:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Tag with ID {tag_id} not found.")
            tag_names_to_pass = tag_names_list

        feed = await rss_service.add_new_feed(
            url=str(feed_in.url),
            folder_id=feed_in.folder_id,
            tag_names=tag_names_to_pass
        )
        logger.info("Feed added successfully", feed_id=feed.id, user_id=current_user.sub, url=feed_in.url)
        return feed
    except ValueError as e:
        logger.warning("Failed to add feed due to value error", error=str(e), user_id=current_user.sub, url=feed_in.url)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ConnectionError as e:
        logger.error("Connection error adding feed", error=str(e), user_id=current_user.sub, url=feed_in.url)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Could not connect to feed URL: {e}")
    except Exception as e:
        logger.error("Unexpected error adding feed", error=str(e), user_id=current_user.sub, url=feed_in.url)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while adding the feed.")

@router.get("/feeds/", response_model=List[FeedResponse])
async def list_feeds(
    db: AsyncSession = Depends(get_db),
    folder_id: Optional[UUID] = Query(None, description="Filter feeds by folder ID"),
    tag_names: Optional[List[str]] = Query(None, description="Filter feeds by a list of tag names (case-insensitive, matches all provided tags)"),
    is_favorite: Optional[bool] = Query(None, description="Filter feeds by favorite status"),
    search_query: Optional[str] = Query(None, description="Search query for feed titles"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: TokenData = Depends(get_current_user)
):
    """List feeds for the current user with optional filtering."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    feeds = await rss_service.list_feeds(
        folder_id=folder_id,
        tag_names=tag_names,
        is_favorite=is_favorite,
        search_query=search_query,
        skip=skip,
        limit=limit
    )
    return feeds

@router.get("/feeds/{feed_id}", response_model=FeedResponse)
async def get_feed(
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Get a specific feed by its ID."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    feed = await rss_service.get_feed(feed_id=feed_id)
    if not feed:
        logger.warning("Feed not found or access denied", feed_id=feed_id, user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found")
    return feed

@router.put("/feeds/{feed_id}", response_model=FeedResponse)
async def update_feed_settings(
    feed_id: UUID,
    feed_in: FeedUpdate = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Update a feed's user-configurable settings (folder, tags, favorite status, title)."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        updated_feed = await rss_service.update_feed_user_settings(feed_id=feed_id, feed_in=feed_in)
        if not updated_feed:
            logger.warning("Feed not found for update or access denied", feed_id=feed_id, user_id=current_user.sub)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found")
        logger.info("Feed settings updated successfully", feed_id=updated_feed.id, user_id=current_user.sub)
        return updated_feed
    except ValueError as e:
        logger.warning("Failed to update feed due to value error", error=str(e), user_id=current_user.sub, feed_id=feed_id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error updating feed settings", error=str(e), user_id=current_user.sub, feed_id=feed_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

@router.post("/feeds/{feed_id}/refresh", response_model=FeedResponse)
async def refresh_feed(
    feed_id: UUID,
    force_refetch: bool = Query(False, description="Force refetch even if not modified based on ETag/Last-Modified"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Manually trigger a refresh of a specific feed to fetch new articles."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        refreshed_feed = await rss_service.refresh_feed(feed_id=feed_id, force_refetch=force_refetch)
        if not refreshed_feed:
            logger.warning("Feed not found for refresh or access denied", feed_id=feed_id, user_id=current_user.sub)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found")
        logger.info("Feed refresh triggered/completed", feed_id=refreshed_feed.id, user_id=current_user.sub)
        return refreshed_feed
    except ConnectionError as e:
        logger.error("Connection error refreshing feed", error=str(e), user_id=current_user.sub, feed_id=feed_id)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Could not connect to feed URL during refresh: {e}")
    except ValueError as e:
        logger.warning("Value error during feed refresh", error=str(e), user_id=current_user.sub, feed_id=feed_id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error refreshing feed", error=str(e), user_id=current_user.sub, feed_id=feed_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred during feed refresh.")

@router.delete("/feeds/{feed_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feed(
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Delete a feed. Associated articles will also be deleted (cascade)."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    success = await rss_service.delete_feed(feed_id=feed_id)
    if not success:
        logger.warning("Feed not found for deletion or access denied", feed_id=feed_id, user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found")
    logger.info("Feed deleted successfully", feed_id=feed_id, user_id=current_user.sub)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"ok": True}
    )