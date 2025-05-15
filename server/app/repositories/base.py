from typing import Any, Dict, Generic, List, Optional, TypeVar, Union

from pydantic import BaseModel

from app.core.exceptions import StorageError
from app.repositories.supabase import get_supabase_client

ModelType = TypeVar("ModelType", bound=BaseModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Base repository with common CRUD operations."""

    def __init__(self, table_name: str):
        self.table_name = table_name
        self.client = get_supabase_client()

    async def get(self, id: str) -> Optional[ModelType]:
        """Get a single record by ID."""
        try:
            response = (
                self.client.table(self.table_name)
                .select("*")
                .eq("id", id)
                .maybe_single()
                .execute()
            )
            return response.data if response.data else None
        except Exception as e:
            raise StorageError(f"Failed to get {self.table_name}: {str(e)}")

    async def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[ModelType]:
        """Get multiple records with optional filtering."""
        try:
            query = self.client.table(self.table_name).select("*")
            
            if filters:
                for key, value in filters.items():
                    query = query.eq(key, value)
            
            response = query.range(skip, skip + limit - 1).execute()
            return response.data or []
        except Exception as e:
            raise StorageError(f"Failed to get {self.table_name} list: {str(e)}")

    async def create(self, *, obj_in: CreateSchemaType) -> ModelType:
        """Create a new record."""
        try:
            response = (
                self.client.table(self.table_name)
                .insert(obj_in.model_dump())
                .execute()
            )
            if not response.data:
                raise StorageError(f"Failed to create {self.table_name}")
            return response.data[0]
        except Exception as e:
            raise StorageError(f"Failed to create {self.table_name}: {str(e)}")

    async def update(
        self,
        *,
        id: str,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        """Update a record."""
        try:
            data = obj_in.model_dump() if isinstance(obj_in, BaseModel) else obj_in
            response = (
                self.client.table(self.table_name)
                .update(data)
                .eq("id", id)
                .execute()
            )
            if not response.data:
                raise StorageError(f"Failed to update {self.table_name}")
            return response.data[0]
        except Exception as e:
            raise StorageError(f"Failed to update {self.table_name}: {str(e)}")

    async def delete(self, *, id: str) -> bool:
        """Delete a record."""
        try:
            response = (
                self.client.table(self.table_name)
                .delete()
                .eq("id", id)
                .execute()
            )
            return bool(response.data)
        except Exception as e:
            raise StorageError(f"Failed to delete {self.table_name}: {str(e)}") 