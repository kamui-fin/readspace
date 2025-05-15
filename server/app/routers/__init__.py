import structlog
from fastapi import APIRouter, Depends

from app.services.auth import TokenData, get_current_user

from . import (
    upload,
)

router = APIRouter()

# Include all route modules
router.include_router(upload.router, prefix="/upload", tags=["upload"])


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
