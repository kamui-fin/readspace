from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

import structlog
from app.db.session import get_db
from app.schemas.auth import TokenData
from app.schemas.rss_schemas import (
    ArticleBulkUpdateRequest,
    ArticleResponse,
    ArticleUpdate,
    PaginatedResponse,
)
from app.services.auth import get_current_user
from app.services.rss_service import RssService
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get("/articles/", response_model=PaginatedResponse[ArticleResponse])
async def list_articles(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    feed_ids: Optional[List[UUID]] = Query(None, description="Filter by specific feed IDs"),
    folder_id: Optional[UUID] = Query(None, description="Filter by folder ID"),
    is_read: Optional[bool] = Query(None, description="Filter by read status"),
    is_read_later: Optional[bool] = Query(None, description="Filter by read later status"),
    is_favorite: Optional[bool] = Query(None, description="Filter by article favorite status"),
    feed_is_favorite: Optional[bool] = Query(None, description="Filter by parent feed\'s favorite status"),
    published_since: Optional[datetime] = Query(None, description="Filter by articles published since this UTC datetime"),
    published_until: Optional[datetime] = Query(None, description="Filter by articles published until this UTC datetime"),
    search_query: Optional[str] = Query(None, description="Search query for article title and description"),
    sort_by: str = Query("published_at", description="Sort articles by: published_at, created_at, read_at, title"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1, description="Page number for pagination"),
    size: int = Query(20, ge=1, le=100, description="Number of items per page")
):
    """List articles with filtering, sorting, and pagination."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    allowed_sort_by = ["published_at", "created_at", "read_at", "title"]
    if sort_by not in allowed_sort_by:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid sort_by parameter. Allowed values: {allowed_sort_by}")
    if sort_order.lower() not in ["asc", "desc"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid sort_order parameter. Allowed values: asc, desc")

    paginated_articles = await rss_service.list_articles(
        feed_ids=feed_ids,
        folder_id=folder_id,
        is_read=is_read,
        is_read_later=is_read_later,
        is_favorite=is_favorite,
        feed_is_favorite=feed_is_favorite,
        published_since=published_since,
        published_until=published_until,
        search_query=search_query,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        size=size
    )
    return paginated_articles

@router.get("/articles/recently_read", response_model=PaginatedResponse[ArticleResponse])
async def get_recently_read_articles(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size")
):
    """Get recently read articles for the current user."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    return await rss_service.get_recently_read_articles(page=page, size=size)

@router.get("/articles/read_later", response_model=PaginatedResponse[ArticleResponse])
async def get_read_later_articles(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(100, ge=1, le=200, description="Page size")
):
    """Get articles marked for read later by the current user."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    return await rss_service.get_read_later_articles(page=page, size=size)

@router.get("/articles/unread_counts", response_model=Dict[str, Any])
async def get_unread_article_counts(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    folder_id: Optional[UUID] = Query(None, description="Optional folder ID to get counts for a specific folder")
):
    """Get unread article counts (total, and by folder if folder_id is not specified)."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    return await rss_service.get_unread_counts(folder_id_filter=folder_id)

@router.get("/articles/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Get a specific article by its ID."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    article = await rss_service.get_article(article_id=article_id)
    if not article:
        logger.warning("Article not found or access denied", article_id=article_id, user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article

@router.put("/articles/{article_id}", response_model=ArticleResponse)
async def update_article_status(
    article_id: UUID,
    article_in: ArticleUpdate = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Update an article\'s status (e.g., is_read, is_read_later, is_favorite)."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    updated_article = await rss_service.update_article_status(article_id=article_id, article_in=article_in)
    if not updated_article:
        logger.warning("Article not found for update or access denied", article_id=article_id, user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    logger.info("Article status updated successfully", article_id=updated_article.id, user_id=current_user.sub)
    return updated_article

@router.post("/articles/bulk_update", response_model=Dict[str, int])
async def bulk_update_article_statuses(
    update_request: ArticleBulkUpdateRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Bulk update status of multiple articles (e.g., mark as read, toggle favorite)."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        affected_count = await rss_service.bulk_update_articles_status(
            article_ids=update_request.article_ids,
            action=update_request.action
        )
        logger.info(
            "Bulk article status update processed", 
            action=update_request.action, 
            num_ids_provided=len(update_request.article_ids),
            num_affected=affected_count, 
            user_id=current_user.sub
        )
        return {"affected_articles": affected_count}
    except ValueError as e:
        logger.warning("Invalid action for bulk article update", error=str(e), user_id=current_user.sub, action=update_request.action)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error during bulk article update", error=str(e), user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

@router.post("/articles/feed/{feed_id}/mark-all-as-read", response_model=Dict[str, int])
async def mark_all_feed_articles_as_read(
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Marks all articles in a specific feed as read for the current user."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        affected_count = await rss_service.mark_feed_articles_as_read(feed_id=feed_id)
        logger.info(
            "Marked all articles as read for feed", 
            feed_id=feed_id, 
            num_affected=affected_count, 
            user_id=current_user.sub
        )
        return {"affected_articles": affected_count}
    except Exception as e:
        logger.error("Error marking feed articles as read", error=str(e), feed_id=feed_id, user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An error occurred while marking articles as read.")

@router.post("/articles/folder/{folder_id}/mark-all-as-read", response_model=Dict[str, int])
async def mark_all_folder_articles_as_read(
    folder_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Marks all articles in a specific folder as read for the current user."""
    rss_service = RssService(db=db, user_id=UUID(current_user.sub))
    try:
        affected_count = await rss_service.mark_folder_articles_as_read(folder_id=folder_id)
        logger.info(
            "Marked all articles as read for folder", 
            folder_id=folder_id, 
            num_affected=affected_count, 
            user_id=current_user.sub
        )
        return {"affected_articles": affected_count}
    except Exception as e:
        logger.error("Error marking folder articles as read", error=str(e), folder_id=folder_id, user_id=current_user.sub)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An error occurred while marking articles as read.") 