"""
Feeds router module.

This module provides endpoints for managing RSS feed subscriptions, including:
- Subscription management (subscribe, unsubscribe)
- Feed CRUD operations (list, get, update, delete)
- Feed refresh operations
- Admin operations (global feed management)
- Bulk operations (bulk delete, bulk move)

Note: Feed search/discovery has been migrated to Meilisearch with direct frontend integration.
"""

from fastapi import APIRouter

from . import admin, bulk_operations, management, refresh, subscription

# Create main router with common configuration
router = APIRouter(
    prefix="/feeds",
    tags=["RSS Feeds"],
    responses={
        401: {"description": "Authentication required"},
        422: {"description": "Validation error"},
    },
)

# Include all subrouters
router.include_router(subscription.router)
router.include_router(management.router)
router.include_router(refresh.router)
router.include_router(admin.router)
router.include_router(bulk_operations.router)

__all__ = ["router"]
