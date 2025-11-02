import uuid
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from supabase import Client

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.repositories.supabase import get_supabase_client
from app.schemas.auth import TokenData
from app.services.auth import get_current_user

SettingsType = Annotated[Settings, Depends(get_settings)]
CurrentUser = Annotated[TokenData, Depends(get_current_user)]
SupabaseClient = Annotated[Client, Depends(get_supabase_client)]
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]


async def get_request_id(request: Request) -> str:
    """Get request ID from state or generate new one."""
    if not hasattr(request.state, "request_id"):
        request.state.request_id = str(uuid.uuid4())
    return str(request.state.request_id)
