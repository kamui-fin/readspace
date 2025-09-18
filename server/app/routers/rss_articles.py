from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_ARTICLE_NOT_FOUND
from app.db.session import get_db
from app.schemas.auth import TokenData
from app.schemas.rss_schemas import (
    ArticleResponse,
    ArticleUpdate,
    ClippedArticleResponse,
    PaginatedResponse,
    SaveArticleRequest,
)
from app.services.auth import get_current_user
from app.services.rss_service import RssOrchestrationService
from app.services.user_service import UserService
from app.services.web_article_service import WebArticleService

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/articles", tags=["RSS Articles"])


@router.post("/save", response_model=ClippedArticleResponse)
async def save_web_article(
    request: SaveArticleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> ClippedArticleResponse:
    """Save a web article from URL for read-later functionality."""
    # Ensure user profile exists in database
    user_service = UserService(db=db)
    await user_service.ensure_user_profile_exists(current_user)

    web_service = WebArticleService(db=db, user_id=UUID(current_user.sub))

    try:
        article = await web_service.save_article_from_url(
            url=str(request.url),
            title=request.title,
            content=request.content,  # Pass extracted content from extension
            metadata=request.metadata or {},
            # tag_ids removed - using ARRAY field on feeds
            note=request.note,
            priority=request.priority,
        )

        logger.info(
            "Web article saved successfully",
            article_id=article.id,
            user_id=current_user.sub,
            url=str(request.url),
        )
        return article

    except ValueError as e:
        logger.warning(
            "Failed to save web article due to validation error",
            error=str(e),
            user_id=current_user.sub,
            url=str(request.url),
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except ConnectionError as e:
        logger.warning(
            "Failed to save web article due to connection error",
            error=str(e),
            user_id=current_user.sub,
            url=str(request.url),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to fetch article: {str(e)}",
        ) from e
    except Exception as e:
        logger.error(
            "Unexpected error saving web article",
            error=str(e),
            user_id=current_user.sub,
            url=str(request.url),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while saving the article.",
        ) from e


@router.get("/", response_model=PaginatedResponse[ArticleResponse])
async def list_articles(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    feed_ids: list[UUID] | None = Query(None, description="Filter by specific feed IDs"),
    folder_id: UUID | None = Query(None, description="Filter by folder ID"),
    is_read: bool | None = Query(None, description="Filter by read status"),
    is_read_later: bool | None = Query(None, description="Filter by read later status"),
    is_favorite: bool | None = Query(None, description="Filter by article favorite status"),
    feed_is_favorite: bool | None = Query(None, description="Filter by parent feed's favorite status"),
    published_since: datetime | None = Query(None, description="Filter by articles published since this UTC datetime"),
    published_until: datetime | None = Query(None, description="Filter by articles published until this UTC datetime"),
    user_timezone: str | None = Query(
        None,
        description="User's timezone for date calculations (e.g., 'America/New_York')",
    ),
    search_query: str | None = Query(None, description="Search query for article title and description"),
    sort_by: str = Query(
        "published_at",
        description="Sort articles by: published_at, created_at, read_at, title",
    ),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1, description="Page number for pagination"),
    size: int = Query(20, ge=1, le=100, description="Number of items per page"),
) -> PaginatedResponse[ArticleResponse]:
    """List articles with filtering, sorting, and pagination."""
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    allowed_sort_by = ["published_at", "created_at", "read_at", "title"]
    if sort_by not in allowed_sort_by:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid sort_by parameter. Allowed values: {allowed_sort_by}",
        )
    if sort_order.lower() not in ["asc", "desc"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid sort_order parameter. Allowed values: asc, desc",
        )

    # Check if user is requesting preview mode by checking if they have access to the feed
    allow_preview = False
    if feed_ids and len(feed_ids) == 1:
        # If requesting articles for a single feed, check if user is subscribed
        feed_data = await rss_service.get_feed(feed_ids[0])
        if feed_data and not feed_data.is_subscribed:
            allow_preview = True

    paginated_articles = await rss_service.get_articles(
        feed_ids=feed_ids,
        folder_id=folder_id,
        is_read=is_read,
        is_read_later=is_read_later,
        is_favorite=is_favorite,
        feed_is_favorite=feed_is_favorite,
        published_since=published_since,
        published_until=published_until,
        user_timezone=user_timezone,
        search_query=search_query,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        size=size,
        allow_preview=allow_preview,
    )
    return paginated_articles


@router.get("/today", response_model=PaginatedResponse[ArticleResponse])
async def get_todays_articles(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    page: int = Query(1, ge=1, description="Page number for pagination"),
    size: int = Query(25, ge=1, le=100, description="Number of items per page"),
) -> PaginatedResponse[ArticleResponse]:
    """Get articles from the last 24 hours in UTC."""
    from datetime import timedelta

    # Get current time in UTC
    now_utc = datetime.now(UTC)

    # Get articles from the last 24 hours
    twenty_four_hours_ago = now_utc - timedelta(hours=24)

    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    paginated_articles = await rss_service.get_articles(
        published_since=twenty_four_hours_ago,
        published_until=now_utc,
        sort_by="published_at",
        sort_order="desc",
        page=page,
        size=size,
    )
    return paginated_articles


@router.get("/recently_read", response_model=PaginatedResponse[ArticleResponse])
async def get_recently_read_articles(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
) -> PaginatedResponse[ArticleResponse]:
    """Get recently read articles for the current user."""
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    skip = (page - 1) * size
    return await rss_service.get_recently_read_articles(skip=skip, limit=size)


@router.get("/read_later", response_model=PaginatedResponse[ArticleResponse])
async def get_read_later_articles(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(100, ge=1, le=200, description="Page size"),
) -> PaginatedResponse[ArticleResponse]:
    """Get articles marked for read later by the current user."""
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    skip = (page - 1) * size
    return await rss_service.get_read_later_articles(skip=skip, limit=size)


@router.get("/unread_counts", response_model=dict[str, Any])
async def get_unread_article_counts(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    folder_id: UUID | None = Query(None, description="Optional folder ID to get counts for a specific folder"),
) -> dict[str, Any]:
    """Get unread article counts (total, and by folder if folder_id is not specified)."""
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    return await rss_service.get_unread_counts(folder_id_filter=folder_id)


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> ArticleResponse:
    """Get a specific article by its ID."""
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))

    # First try to get the article with preview mode disabled (normal case)
    article = await rss_service.get_article(article_id=article_id, allow_preview=False)

    # If not found and user might be in preview mode, try with preview enabled
    if not article:
        # Try again with preview mode enabled - this allows access to articles
        # from feeds the user hasn't subscribed to (useful for feed preview)
        article = await rss_service.get_article(article_id=article_id, allow_preview=True)

    if not article:
        logger.warning(
            "Article not found or access denied",
            article_id=article_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_ARTICLE_NOT_FOUND)
    return article


@router.put("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: UUID,
    article_in: ArticleUpdate = Body(...),
    article_type: str = Query("feed", pattern="^(feed|clipped)$", description="Article type: feed or clipped"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> ArticleResponse:
    """Update an article's status (e.g., is_read, is_read_later, is_favorite)."""
    rss_service = RssOrchestrationService(db=db, user_id=UUID(current_user.sub))
    updated_article = await rss_service.update_article(
        article_id=article_id, article_in=article_in, article_type=article_type
    )
    if not updated_article:
        logger.warning(
            "Article not found for update or access denied",
            article_id=article_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_ARTICLE_NOT_FOUND)
    logger.info(
        "Article status updated successfully",
        article_id=updated_article.id,
        user_id=current_user.sub,
    )
    return updated_article
