from typing import Any, Generic, Protocol, TypeVar

from pydantic import BaseModel
from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select


class HasId(Protocol):
    """Protocol for models that have an id attribute."""

    id: Any


ModelType = TypeVar("ModelType", bound=HasId)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: type[ModelType]):
        """
        CRUD object with default methods to Create, Read, Update, Delete (CRUD).
        **Parameters**
        * `model`: A SQLAlchemy model class
        * `schema`: A Pydantic model (schema) class
        """
        self.model = model

    async def get(self, db: AsyncSession, id: Any) -> ModelType | None:
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalar_one_or_none()

    async def create(self, db: AsyncSession, *, obj_in: CreateSchemaType) -> ModelType:
        """Create a new record using INSERT...RETURNING for optimal performance."""
        obj_in_data = obj_in.model_dump()

        # Use INSERT...RETURNING to get the created object without refresh()
        insert_stmt = insert(self.model).values(**obj_in_data)
        result = await db.execute(insert_stmt.returning(self.model))
        db_obj = result.scalar_one()

        await db.commit()
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: UpdateSchemaType | dict[str, Any],
    ) -> ModelType:
        """Update a record using UPDATE...RETURNING for optimal performance."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        if not update_data:  # No changes to make
            return db_obj

        # Use UPDATE...RETURNING to get the updated object without refresh()
        update_stmt = update(self.model).where(self.model.id == db_obj.id).values(**update_data).returning(self.model)
        result = await db.execute(update_stmt)
        updated_obj = result.scalar_one()

        await db.commit()
        return updated_obj

    async def remove(self, db: AsyncSession, *, id: Any) -> ModelType | None:
        obj = await self.get(db, id=id)
        if obj:
            await db.delete(obj)
            await db.commit()
        return obj
