from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from app.core.exceptions import StorageError
from app.db.base_class import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)

class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Base repository with common CRUD operations using SQLAlchemy."""

    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, id: UUID) -> Optional[ModelType]:
        """Get a single record by ID."""
        try:
            query = select(self.model).where(self.model.id == id)
            result = await db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            raise StorageError(f"Failed to get {self.model.__name__}: {str(e)}")

    async def get_multi(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[ModelType]:
        """Get multiple records with optional filtering."""
        try:
            query: Select = select(self.model)
            
            if filters:
                for key, value in filters.items():
                    query = query.where(getattr(self.model, key) == value)
            
            query = query.offset(skip).limit(limit)
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            raise StorageError(f"Failed to get {self.model.__name__} list: {str(e)}")

    async def create(self, db: AsyncSession, *, obj_in: CreateSchemaType) -> ModelType:
        """Create a new record."""
        try:
            obj_in_data = jsonable_encoder(obj_in)
            db_obj = self.model(**obj_in_data)
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await db.rollback()
            raise StorageError(f"Failed to create {self.model.__name__}: {str(e)}")

    async def update(
        self,
        db: AsyncSession,
        *,
        id: UUID,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        """Update a record."""
        try:
            data = jsonable_encoder(obj_in) if isinstance(obj_in, BaseModel) else obj_in
            query = (
                update(self.model)
                .where(self.model.id == id)
                .values(**data)
                .execution_options(synchronize_session="fetch")
            )
            await db.execute(query)
            await db.commit()
            
            # Fetch the updated object
            return await self.get(db, id)
        except Exception as e:
            await db.rollback()
            raise StorageError(f"Failed to update {self.model.__name__}: {str(e)}")

    async def delete(self, db: AsyncSession, *, id: UUID) -> bool:
        """Delete a record."""
        try:
            query = delete(self.model).where(self.model.id == id)
            result = await db.execute(query)
            await db.commit()
            return result.rowcount > 0
        except Exception as e:
            await db.rollback()
            raise StorageError(f"Failed to delete {self.model.__name__}: {str(e)}") 