import uuid
from typing import Annotated

from fastapi import Depends, Request
from supabase import Client

from app.core.config import get_settings
from app.repositories.books import BookRepository
from app.repositories.supabase import SupabaseStorageClient, get_supabase_client
from app.schemas.auth import TokenData
from app.services.auth import get_current_user

Settings = Annotated[type(get_settings()), Depends(get_settings)]
CurrentUser = Annotated[TokenData, Depends(get_current_user)]
SupabaseClient = Annotated[Client, Depends(get_supabase_client)]
StorageClient = Annotated[SupabaseStorageClient, Depends(get_supabase_client)]

def get_book_repository() -> BookRepository:
    """Get book repository instance."""
    return BookRepository()

BookRepo = Annotated[BookRepository, Depends(get_book_repository)]

async def get_request_id(request: Request) -> str:
    """Get request ID from state or generate new one."""
    if not hasattr(request.state, "request_id"):
        request.state.request_id = str(uuid.uuid4())
    return request.state.request_id