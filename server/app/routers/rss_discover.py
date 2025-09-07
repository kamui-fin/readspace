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
    limit: int = Query(10, ge=1, le=20, description="Maximum number of results")
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
                search_metadata=result.get("search_metadata")
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
                search_metadata=result.get("search_metadata")
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
