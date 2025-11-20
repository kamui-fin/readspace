"""CRUD operations for user article states."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models import UserArticleState
from app.schemas.subscriptions import (
    UserArticleStateCreate,
    UserArticleStateUpdate,
)


class CRUDUserArticleState(CRUDBase[UserArticleState, UserArticleStateCreate, UserArticleStateUpdate]):
    """CRUD operations for user article state."""

    async def get_by_user_and_article(
        self, db: AsyncSession, *, user_id: UUID, article_id: UUID
    ) -> UserArticleState | None:
        """Get user's state for a specific article."""
        result = await db.execute(
            select(UserArticleState).filter(
                UserArticleState.user_id == user_id,
                UserArticleState.article_id == article_id,
            )
        )
        return result.scalars().first()

    async def get_batch(self, db: AsyncSession, *, user_id: UUID, article_ids: list[UUID]) -> list[UserArticleState]:
        """Get user's states for multiple articles."""
        if not article_ids:
            return []

        result = await db.execute(
            select(UserArticleState).filter(
                UserArticleState.user_id == user_id,
                UserArticleState.article_id.in_(article_ids),
            )
        )
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, *, obj_in: UserArticleStateCreate) -> UserArticleState:
        """Create a new user article state."""
        state_data = obj_in.model_dump()
        if state_data.get("is_read") and "read_at" not in state_data:
            state_data["read_at"] = datetime.now(timezone.utc)

        db_state = UserArticleState(**state_data)
        db.add(db_state)
        await db.flush()
        await db.refresh(db_state)
        return db_state

    async def update(
        self, db: AsyncSession, *, db_obj: UserArticleState, obj_in: UserArticleStateUpdate
    ) -> UserArticleState:
        """Update an existing user article state."""
        update_data = obj_in.model_dump(exclude_unset=True)

        # Set read_at timestamp when marking as read
        if update_data.get("is_read") and not db_obj.is_read:
            update_data["read_at"] = datetime.now(timezone.utc)
        elif update_data.get("is_read") is False:
            update_data["read_at"] = None

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def get_or_create(self, db: AsyncSession, *, user_id: UUID, article_id: UUID) -> UserArticleState:
        """Get existing state or create a new default state."""
        existing_state = await self.get_by_user_and_article(db, user_id=user_id, article_id=article_id)
        if existing_state:
            return existing_state

        # Create default state
        state_in = UserArticleStateCreate(user_id=user_id, article_id=article_id)
        return await self.create(db, obj_in=state_in)

    async def update_read_status(
        self, db: AsyncSession, *, user_id: UUID, article_id: UUID, is_read: bool
    ) -> UserArticleState:
        """Update read status for an article.

        Args:
            db: Database session
            user_id: User ID
            article_id: Article ID
            is_read: True to mark as read, False to mark as unread
        """
        state = await self.get_by_user_and_article(db, user_id=user_id, article_id=article_id)

        if state:
            # Only update if status is actually changing
            if state.is_read != is_read:
                state.is_read = is_read
                state.read_at = datetime.now(timezone.utc) if is_read else None
                db.add(state)
                await db.flush()
                await db.refresh(state)
        else:
            # Create new state with specified read status
            state_in = UserArticleStateCreate(user_id=user_id, article_id=article_id, is_read=is_read)
            state = await self.create(db, obj_in=state_in)

        return state

    async def mark_read(self, db: AsyncSession, *, user_id: UUID, article_id: UUID) -> UserArticleState:
        """Mark an article as read for a user."""
        return await self.update_read_status(db, user_id=user_id, article_id=article_id, is_read=True)

    async def mark_unread(self, db: AsyncSession, *, user_id: UUID, article_id: UUID) -> UserArticleState:
        """Mark an article as unread for a user."""
        return await self.update_read_status(db, user_id=user_id, article_id=article_id, is_read=False)

    async def toggle_favorite(self, db: AsyncSession, *, user_id: UUID, article_id: UUID) -> UserArticleState:
        """Toggle favorite status for an article."""
        state = await self.get_or_create(db, user_id=user_id, article_id=article_id)

        state.is_favorite = not state.is_favorite
        db.add(state)
        await db.flush()
        await db.refresh(state)
        return state

    async def toggle_read_later(self, db: AsyncSession, *, user_id: UUID, article_id: UUID) -> UserArticleState:
        """Toggle read later status for an article."""
        state = await self.get_or_create(db, user_id=user_id, article_id=article_id)

        state.is_read_later = not state.is_read_later
        db.add(state)
        await db.flush()
        await db.refresh(state)
        return state

    async def get_unread_count(
        self, db: AsyncSession, *, user_id: UUID, subscription_ids: list[UUID] | None = None
    ) -> int:
        """Get count of unread articles for a user."""
        from app.models import FeedArticle, FeedSubscription

        # Use COUNT in database instead of fetching all IDs and counting in Python
        stmt = (
            select(func.count(FeedArticle.id))
            .join(FeedSubscription, FeedSubscription.feed_id == FeedArticle.feed_id)
            .filter(FeedSubscription.user_id == user_id)
        )

        if subscription_ids:
            stmt = stmt.filter(FeedSubscription.id.in_(subscription_ids))

        # Left join with user states to find articles without read state or explicitly unread
        stmt = stmt.outerjoin(
            UserArticleState,
            and_(
                UserArticleState.user_id == user_id,
                UserArticleState.article_id == FeedArticle.id,
            ),
        ).filter(
            or_(
                UserArticleState.id.is_(None),  # No state record (unread by default)
                UserArticleState.is_read.is_(False),  # Explicitly marked unread
            )
        )

        result = await db.execute(stmt)
        return result.scalar_one() or 0

    async def get_favorite_article_ids(self, db: AsyncSession, *, user_id: UUID) -> list[UUID]:
        """Get IDs of user's favorite articles."""
        result = await db.execute(
            select(UserArticleState.article_id).filter(
                UserArticleState.user_id == user_id, UserArticleState.is_favorite.is_(True)
            )
        )
        return list(result.scalars().all())

    async def get_read_later_article_ids(self, db: AsyncSession, *, user_id: UUID) -> list[UUID]:
        """Get IDs of user's read-later articles."""
        result = await db.execute(
            select(UserArticleState.article_id).filter(
                UserArticleState.user_id == user_id, UserArticleState.is_read_later.is_(True)
            )
        )
        return list(result.scalars().all())


# Create instance
user_article_state = CRUDUserArticleState(UserArticleState)
