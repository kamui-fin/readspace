"""RSS Feed Discovery Router for search and browsing functionality."""

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.rss_schemas import (
    DiscoverCategoriesResponse,
    DiscoverSearchResponse,
    FeedDiscoveryResult,
)
from app.services.rss_search_service import RssSearchService

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/discover", tags=["RSS Discovery"])


@router.get("/search", response_model=DiscoverSearchResponse)
async def search_feeds(
    *,
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(None, description="Search query text", max_length=500),
    category: str | None = Query(None, description="Feed category to filter by", max_length=100),
    language: str = Query("en", description="Language code for filtering", max_length=10),
    limit: int = Query(40, ge=1, le=100, description="Maximum number of results")
):
    """
    Search for RSS feeds using hybrid search or browse by category.
    
    - **q**: Search query text (optional)
    - **category**: Category to filter by (optional) 
    - **language**: Language code for filtering (defaults to 'en')
    - **limit**: Maximum results to return (1-20)
    
    If no query is provided but category is specified, returns top feeds for that category.
    If neither query nor category is provided, returns popular feeds across all categories.
    """
    try:
        search_service = RssSearchService(db)

        # Perform search
        results = await search_service.search_feeds(
            query=q,
            category=category,
            language=language,
            limit=limit
        )

        # Convert to response schema
        feed_results = []
        for result in results:
            feed_result = FeedDiscoveryResult(
                id=result["id"],
                title=result["title"],
                description=result["description"],
                url=result["url"],
                link=result["link"],
                image_url=result["image_url"],
                tags=result["tags"],
                language=result["language"],
                category=result["category"],
                popularity_score=result["popularity_score"],
                relevance=result["relevance"],
                search_metadata=result.get("search_metadata"),
                is_preview=result.get("is_preview", False),
                preview_url=result.get("preview_url")
            )
            feed_results.append(feed_result)

        response = DiscoverSearchResponse(
            results=feed_results,
            total_count=len(feed_results),
            query=q,
            category=category,
            language=language
        )

        logger.info(
            "Feed discovery search completed",
            query=q,
            category=category,
            language=language,
            results_count=len(feed_results)
        )

        return response

    except Exception as e:
        logger.error("Error in feed discovery search", query=q, category=category, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while searching for feeds"
        )


@router.get("/categories", response_model=DiscoverCategoriesResponse)
async def get_categories(
    *,
    db: AsyncSession = Depends(get_db),
    language: str = Query("en", description="Language code for filtering", max_length=10)
):
    """
    Get all available RSS feed categories with counts for the discovery grid.
    
    - **language**: Language code for filtering (defaults to 'en')
    
    Returns categories sorted by feed count descending.
    """
    try:
        search_service = RssSearchService(db)

        categories = await search_service.get_categories_with_counts(language=language)

        response = DiscoverCategoriesResponse(
            categories=categories,
            language=language
        )

        logger.info(
            "Categories retrieved for discovery",
            language=language,
            categories_count=len(categories)
        )

        return response

    except Exception as e:
        logger.error("Error getting discovery categories", language=language, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching categories"
        )


@router.get("/categories/{category_name}", response_model=DiscoverSearchResponse)
async def get_category_feeds(
    *,
    db: AsyncSession = Depends(get_db),
    category_name: str,
    language: str = Query("en", description="Language code for filtering", max_length=10),
    limit: int = Query(20, ge=1, le=20, description="Maximum number of results")
):
    """
    Get top feeds for a specific category.
    
    - **category_name**: The category name to browse
    - **language**: Language code for filtering (defaults to 'en')  
    - **limit**: Maximum results to return (1-20)
    """
    try:
        search_service = RssSearchService(db)

        # Use the category search functionality
        results = await search_service.search_feeds(
            query=None,
            category=category_name,
            language=language,
            limit=limit
        )

        # Convert to response schema
        feed_results = []
        for result in results:
            feed_result = FeedDiscoveryResult(
                id=result["id"],
                title=result["title"],
                description=result["description"],
                url=result["url"],
                link=result["link"],
                image_url=result["image_url"],
                tags=result["tags"],
                language=result["language"],
                category=result["category"],
                popularity_score=result["popularity_score"],
                relevance=result["relevance"],
                search_metadata=result.get("search_metadata"),
                is_preview=result.get("is_preview", False),
                preview_url=result.get("preview_url")
            )
            feed_results.append(feed_result)

        if not feed_results:
            logger.warning(f"No feeds found for category: {category_name}")

        response = DiscoverSearchResponse(
            results=feed_results,
            total_count=len(feed_results),
            query=None,
            category=category_name,
            language=language
        )

        logger.info(
            "Category feeds retrieved",
            category=category_name,
            language=language,
            results_count=len(feed_results)
        )

        return response

    except Exception as e:
        logger.error(
            "Error getting category feeds",
            category=category_name,
            language=language,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while fetching feeds for category: {category_name}"
        )


@router.get("/preview/articles")
async def get_preview_articles(
    *,
    db: AsyncSession = Depends(get_db),
    url: str = Query(..., description="RSS feed URL to preview"),
    limit: int = Query(25, ge=1, le=100, description="Maximum number of articles to return")
):
    """
    Get articles from an RSS feed URL for preview purposes.
    This endpoint fetches and parses an RSS feed directly without requiring database storage.
    """
    try:
        search_service = RssSearchService(db)

        # First check if this is a valid RSS URL by trying to preview it
        # This will handle rsshub:// URLs automatically via the transformer
        preview_result = await search_service._preview_url_as_feed(url)
        if not preview_result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid RSS feed URL or feed could not be fetched"
            )

        # Import here to avoid circular imports
        from uuid import uuid4

        from app.services.feed_creation_service import FeedCreationService
        from app.utils.rsshub_url_transformer import transform_rsshub_url

        # Create a temporary service instance for fetching articles
        temp_service = FeedCreationService(db, user_id=uuid4())

        # Transform rsshub:// URLs to actual HTTP URLs for fetching
        fetch_url = transform_rsshub_url(url)

        # Fetch and parse the RSS feed using the transformed URL
        fetch_result = await temp_service._fetch_feed_content(fetch_url)
        if fetch_result["status"] != 200 or not fetch_result["content"]:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not fetch RSS feed content"
            )

        # Parse the feed using the transformed URL
        parsed_feed = temp_service._parse_feed_data(fetch_result["content"], fetch_url)

        # Extract articles from the parsed feed (limit to requested amount)
        articles = []
        feed_entries = getattr(parsed_feed, 'entries', [])[:limit]

        for i, entry in enumerate(feed_entries):
            # Create a preview article object
            article = {
                "id": f"preview_article_{hash(url)}_{i}",
                "feed_id": preview_result["id"],
                "content_id": f"preview_content_{hash(url)}_{i}",
                "guid": getattr(entry, 'id', getattr(entry, 'link', str(i))),
                "created_at": "2023-01-01T00:00:00Z",
                "updated_at": "2023-01-01T00:00:00Z",

                # Content data
                "title": getattr(entry, 'title', 'Untitled'),
                "link": getattr(entry, 'link', None),
                "description": getattr(entry, 'summary', getattr(entry, 'description', None)),
                "content": getattr(entry, 'content', [{}])[0].get('value', None) if hasattr(entry, 'content') and entry.content else None,
                "image_url": None,  # Could extract from content if needed
                "author": getattr(entry, 'author', None),
                "published_at": getattr(entry, 'published_parsed', None),
                "estimated_read_time_minutes": None,

                # User state (all false for preview)
                "is_read": False,
                "read_at": None,
                "is_read_later": False,
                "is_favorite": False,
                "user_note": None,
                "user_tags": None,

                # Feed info
                "feed_title": preview_result["title"],
                "custom_feed_title": None,
                "folder_id": None,
                "folder_name": None,
            }

            # Convert published_parsed to ISO string if available
            if article["published_at"]:
                try:
                    import time
                    from datetime import datetime
                    article["published_at"] = datetime.fromtimestamp(time.mktime(article["published_at"])).isoformat() + "Z"
                except:
                    article["published_at"] = None

            articles.append(article)

        # Return in the same format as the regular articles endpoint
        response = {
            "items": articles,
            "total": len(articles),
            "page": 1,
            "size": limit,
            "pages": 1
        }

        logger.info(
            "Preview articles fetched successfully",
            url=url,
            articles_count=len(articles)
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching preview articles", url=url, error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching preview articles"
        )
