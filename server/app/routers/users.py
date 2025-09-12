"""User and profile endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.crud_profile import crud_profile
from app.db.session import get_db
from app.schemas.user_schemas import ProfileResponse
from app.services.auth import TokenData, get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/profile", response_model=ProfileResponse)
async def get_current_user_profile(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's profile including role."""
    profile = await crud_profile.get_by_id(db, user_id=current_user.sub)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found"
        )
    return profile
