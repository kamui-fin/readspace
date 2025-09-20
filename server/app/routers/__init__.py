from typing import Any

import structlog
from fastapi import APIRouter, Depends

from app.services.auth import TokenData, get_current_user

from . import (
    article_enhancements,
    books,
    highlights,
    rss_articles,
    rss_discover,
    rss_feeds,
    rss_folders,
    rss_opml,
    rss_similar,
    upload,
    users,
)

router = APIRouter()

# Include all route modules
router.include_router(article_enhancements.router)
router.include_router(books.router)
router.include_router(highlights.router)
router.include_router(upload.router, prefix="/upload", tags=["Upload"])
router.include_router(users.router)

# RSS Routers
router.include_router(rss_folders.router, prefix="/rss")
router.include_router(rss_feeds.router, prefix="/rss")
router.include_router(rss_articles.router, prefix="/rss")
router.include_router(rss_opml.router, prefix="/rss")
router.include_router(rss_discover.router, prefix="/rss")
router.include_router(rss_similar.router, prefix="/rss")


@router.get("/health")
async def health_check() -> dict[str, str]:
    """
    Health check endpoint that doesn't require authentication
    """
    log = structlog.get_logger()
    log.info("Health check endpoint called")
    return {"status": "ok"}


@router.get("/user-info")
async def user_info(user: TokenData = Depends(get_current_user)) -> dict[str, Any]:
    """
    Protected endpoint that returns user information
    """
    return {"user_id": user.sub, "email": user.email, "metadata": user.user_metadata}
