from typing import Annotated
from uuid import UUID

import structlog
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.crud.profile import get_profile_by_id
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import Profile
from app.services.user.auth import get_current_user
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)

SettingsType = Annotated[Settings, Depends(get_settings)]
CurrentUser = Annotated[TokenData, Depends(get_current_user)]
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]


async def get_request_id(request: Request) -> str:
    """
    Get request ID from state.

    The RequestIdMiddleware ensures request_id is always set before this is called.
    This dependency can be used to access the request_id in route handlers.

    Args:
        request: The FastAPI request object

    Returns:
        str: The unique request ID for this request
    """
    return str(request.state.request_id)


async def get_current_admin(
    db: Annotated[AsyncSession, Depends(get_db)],
    token_data: Annotated[TokenData, Depends(get_current_user)],
) -> Profile:
    """
    Dependency that validates the user exists and has the ADMIN role.
    Returns the user Profile object if successful.
    """
    user_id = UUID(token_data.sub)
    profile = await get_profile_by_id(db, user_id=user_id)

    if not profile or profile.role != UserRole.ADMIN:
        logger.warning("Unauthorized admin access attempt", user_id=token_data.sub)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return profile
