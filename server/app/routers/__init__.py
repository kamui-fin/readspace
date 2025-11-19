from typing import Any

import structlog
from fastapi import APIRouter, Depends

from app.services.user.auth import TokenData, get_current_user

from . import (
    article_enhancements,
    articles,
    discover,
    feeds,
    folders,
    opml,
    users,
)

router = APIRouter()

# Include all route modules
router.include_router(article_enhancements.router)
router.include_router(users.router)

# RSS Routers (no /rss prefix - routes are directly under /api)
router.include_router(folders.router)
router.include_router(feeds.router)
router.include_router(articles.router)
router.include_router(opml.router)
router.include_router(discover.router)


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
