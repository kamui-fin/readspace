from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.services.user.auth import get_current_user
from app.typing.user import TokenData

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
