import uuid
from typing import Annotated

from fastapi import Depends, Request
from supabase import Client
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db
from app.repositories.books import BookRepository
from app.repositories.highlights import HighlightRepository
from app.repositories.supabase import SupabaseStorageClient, get_supabase_client
from app.schemas.auth import TokenData
from app.services.auth import get_current_user

Settings = Annotated[type(get_settings()), Depends(get_settings)]
CurrentUser = Annotated[TokenData, Depends(get_current_user)]
SupabaseClient = Annotated[Client, Depends(get_supabase_client)]
StorageClient = Annotated[SupabaseStorageClient, Depends(get_supabase_client)]
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]


async def get_book_repository(db: DatabaseSession) -> BookRepository:
    """Get book repository instance."""
    return BookRepository()


async def get_highlight_repository(db: DatabaseSession) -> HighlightRepository:
    """Get highlight repository instance."""
    return HighlightRepository()


BookRepo = Annotated[BookRepository, Depends(get_book_repository)]
HighlightRepo = Annotated[HighlightRepository, Depends(get_highlight_repository)]


async def get_request_id(request: Request) -> str:
    """Get request ID from state or generate new one."""
    if not hasattr(request.state, "request_id"):
        request.state.request_id = str(uuid.uuid4())
    return request.state.request_id
