import structlog
from app.services.auth import TokenData, get_current_user
from fastapi import APIRouter, Depends

from . import (
    books,
    feedback,
    highlights,
    rss_articles,
    rss_feeds,
    rss_folders,
    rss_opml,
    rss_tags,
    upload,
)

router = APIRouter()

# Include all route modules
router.include_router(books.router, tags=["Books"])
router.include_router(feedback.router, tags=["Feedback"])
router.include_router(highlights.router, tags=["Highlights"])
router.include_router(upload.router, prefix="/upload", tags=["Upload"])

# RSS Routers
router.include_router(rss_folders.router, prefix="/rss")
router.include_router(rss_tags.router, prefix="/rss")
router.include_router(rss_feeds.router, prefix="/rss")
router.include_router(rss_articles.router, prefix="/rss")
router.include_router(rss_opml.router, prefix="/rss")


@router.get("/health")
async def health_check():
    """
    Health check endpoint that doesn't require authentication
    """
    log = structlog.get_logger()
    log.info("Health check endpoint called")
    return {"status": "ok"}


@router.get("/user-info")
async def user_info(user: TokenData = Depends(get_current_user)):
    """
    Protected endpoint that returns user information
    """
    return {"user_id": user.sub, "email": user.email, "metadata": user.user_metadata}
