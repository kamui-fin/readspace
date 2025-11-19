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

# Include all subrouters
router.include_router(retrieval.router)
router.include_router(views.router)
router.include_router(management.router)
router.include_router(clipped.router)
router.include_router(counts.router)

__all__ = ["router"]
