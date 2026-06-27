"""User management routes."""

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.custom_exceptions import NotFoundError
from app.crud import profile as crud_profile
from app.db.session import get_db
from app.services.user.auth import get_current_user
from app.services.user.resource_limits import get_user_limits_and_usage
from app.typing.user import ProfileResponse, ProfileUpdate, TokenData, UserLimitsResponse

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/profile", response_model=ProfileResponse, summary="Get current user profile")
async def get_profile(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> ProfileResponse:
    """
    Get the current user's profile.
    """
    logger.bind(user_id=current_user.sub)

    profile = await crud_profile.get_profile_by_id(db, user_id=UUID(current_user.sub))
    if not profile:
        # This should theoretically not happen if get_current_user succeeds,
        # but good to handle safely.
        raise NotFoundError(message="Profile not found")

    return profile


@router.patch("/profile", response_model=ProfileResponse, summary="Update current user profile")
async def update_profile(
    payload: ProfileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> ProfileResponse:
    """
    Update the current user's profile (e.g. mark as onboarded).
    """
    profile = await crud_profile.update_profile(
        db,
        user_id=UUID(current_user.sub),
        is_onboarded=payload.is_onboarded,
    )
    if not profile:
        raise NotFoundError(message="Profile not found")
    return profile


@router.get("/limits", response_model=UserLimitsResponse, summary="Get current user limits and usage")
async def get_limits(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> UserLimitsResponse:
    """
    Get the current user's resource limits and usage.
    """
    logger.bind(user_id=current_user.sub)

    limits_and_usage = await get_user_limits_and_usage(db, user_id=UUID(current_user.sub))
    return limits_and_usage
