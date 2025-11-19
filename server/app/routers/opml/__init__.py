"""
OPML router module.

This module provides endpoints for OPML import/export operations, including:
- OPML import (file upload and status tracking)
- OPML export (generate OPML file from user's feeds)
- Task management (list, cancel import tasks)
"""

from fastapi import APIRouter

from . import export, import_opml, task_management

# Create main router with common configuration
router = APIRouter(
    prefix="/opml",
    tags=["RSS OPML"],
    responses={
        401: {"description": "Authentication required"},
        422: {"description": "Validation error"},
    },
)

# Include all subrouters
router.include_router(import_opml.router)
router.include_router(export.router)
router.include_router(task_management.router)

__all__ = ["router"]
