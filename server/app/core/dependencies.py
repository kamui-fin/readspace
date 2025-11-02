from typing import TYPE_CHECKING, Annotated
from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.auth import TokenData
from app.services.user.auth import get_current_user

if TYPE_CHECKING:
    from app.core.redis_cache import RedisCache
    from app.services.subscription import SubscriptionService
    from app.services.user.user import UserService

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


async def get_subscription_service(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> "SubscriptionService":
    """Get SubscriptionService instance with dependency injection."""
    from app.services.subscription import SubscriptionService

    return SubscriptionService(db=db, user_id=UUID(current_user.sub))


async def get_user_service(
    db: DatabaseSession,
) -> "UserService":
    """Get UserService instance with dependency injection."""
    from app.services.user.user import UserService

    return UserService(db=db)


def get_redis_cache_dependency() -> "RedisCache":
    """Get singleton RedisCache instance for dependency injection."""
    from app.core.redis_cache import get_redis_cache

    return get_redis_cache()
