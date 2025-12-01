"""Main API router that aggregates all route modules."""

from fastapi import APIRouter

# Article routers
from app.routers.articles.articles import router as articles_router
from app.routers.articles.articles_clipped import router as articles_clipped_router
from app.routers.articles.articles_counts import router as articles_counts_router
from app.routers.articles.articles_enhancements import (
    router as articles_enhancements_router,
)
from app.routers.articles.articles_views import router as articles_views_router

# Top-level routers (already have prefixes)
from app.routers.discover import router as discover_router

# Feed routers
from app.routers.feeds.feeds import router as feeds_router
from app.routers.feeds.feeds_admin import router as feeds_admin_router
from app.routers.feeds.feeds_bulk import router as feeds_bulk_router
from app.routers.feeds.feeds_refresh import router as feeds_refresh_router
from app.routers.feeds.feeds_subscription import router as feeds_subscription_router
from app.routers.folders import router as folders_router

# OPML routers
from app.routers.opml.import_opml import router as opml_import_router
from app.routers.opml.task_management import router as opml_task_management_router

from app.routers.users import router as users_router

# Create main API router
api_router = APIRouter()

# Include top-level routers (already have prefixes)
api_router.include_router(discover_router)
api_router.include_router(folders_router)
api_router.include_router(users_router)

# Include article routers with prefix
# Note: Order matters! More specific routes must come before generic /{article_id} routes
api_router.include_router(articles_views_router, prefix="/articles", tags=["Articles"])
api_router.include_router(articles_counts_router, prefix="/articles", tags=["Articles"])
api_router.include_router(
    articles_clipped_router, prefix="/articles", tags=["Articles"]
)
api_router.include_router(
    articles_enhancements_router, prefix="/articles", tags=["Articles"]
)
api_router.include_router(articles_router, prefix="/articles", tags=["Articles"])

# Include feed routers with prefix
# Note: feeds_subscription_router must come before feeds_router to ensure POST / route is registered
api_router.include_router(feeds_subscription_router, prefix="/feeds", tags=["Feeds"])
api_router.include_router(feeds_router, prefix="/feeds", tags=["Feeds"])
api_router.include_router(feeds_admin_router, prefix="/feeds", tags=["Feeds"])
api_router.include_router(feeds_bulk_router, prefix="/feeds", tags=["Feeds"])
api_router.include_router(feeds_refresh_router, prefix="/feeds", tags=["Feeds"])

# Include OPML routers with prefix
api_router.include_router(opml_import_router, prefix="/opml", tags=["OPML"])
api_router.include_router(opml_task_management_router, prefix="/opml", tags=["OPML"])

__all__ = ["api_router"]
