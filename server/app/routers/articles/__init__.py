"""
Articles router module.

This module provides endpoints for managing articles, including:
- Article retrieval (list, get by ID)
- Article views (today, recently-read, read-later)
- Article management (update status)
- Clipped articles (save web articles, check if saved)
- Article counts (unread counts)
"""

from fastapi import APIRouter

from . import clipped, counts, management, retrieval, views

# Create main router with common configuration
router = APIRouter(
    prefix="/articles",
    tags=["RSS Articles"],
    responses={
        401: {"description": "Authentication required"},
        422: {"description": "Validation error"},
    },
)

# Include all subrouters - SPECIFIC routes BEFORE generic parameterized routes
# This ordering is critical: FastAPI matches routes in registration order, and
# parameterized routes like GET /{article_id} will catch any path segment.
# Specific named paths must be registered first to ensure proper matching.
router.include_router(counts.router)        # GET /unread-counts (specific path)
router.include_router(views.router)         # GET /today, /recently-read, /read-later (specific paths)
router.include_router(clipped.router)       # POST /, GET /check-saved (specific paths)
router.include_router(management.router)    # PUT /{article_id} (parameterized, but not GET)
router.include_router(retrieval.router)     # GET /{article_id} (generic parameterized - MUST BE LAST)

__all__ = ["router"]
