"""CRUD operations for user article states."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserArticleState
from app.schemas.subscriptions import (
    UserArticleStateCreate,
    UserArticleStateUpdate,
)


async def get_user_article_state(db: AsyncSession, *, user_id: UUID, article_id: UUID) -> UserArticleState | None:
    """Get user's state for a specific article."""
    result = await db.execute(
        select(UserArticleState).filter(
            UserArticleState.user_id == user_id,
            UserArticleState.article_id == article_id,
        )
    )
    return result.scalars().first()


async def get_user_article_states_batch(
    db: AsyncSession, *, user_id: UUID, article_ids: list[UUID]
) -> list[UserArticleState]:
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


async def create_user_article_state(db: AsyncSession, *, state_in: UserArticleStateCreate) -> UserArticleState:
    """Create a new user article state."""
    state_data = state_in.model_dump()
    if state_data.get("is_read") and "read_at" not in state_data:
        state_data["read_at"] = datetime.now(timezone.utc)

    db_state = UserArticleState(**state_data)
    db.add(db_state)
    await db.commit()
    await db.refresh(db_state)
    return db_state


async def update_user_article_state(
    db: AsyncSession, *, state_db: UserArticleState, state_in: UserArticleStateUpdate
) -> UserArticleState:
    """Update an existing user article state."""
    update_data = state_in.model_dump(exclude_unset=True)

    # Set read_at timestamp when marking as read
    if update_data.get("is_read") and not state_db.is_read:
        update_data["read_at"] = datetime.now(timezone.utc)
    elif update_data.get("is_read") is False:
        update_data["read_at"] = None

    for field, value in update_data.items():
        setattr(state_db, field, value)

    db.add(state_db)
    await db.commit()
    await db.refresh(state_db)
    return state_db


async def get_or_create_user_article_state(db: AsyncSession, *, user_id: UUID, article_id: UUID) -> UserArticleState:
    """Get existing state or create a new default state."""
    existing_state = await get_user_article_state(db, user_id=user_id, article_id=article_id)
    if existing_state:
        return existing_state

    # Create default state
    from app.schemas.subscriptions import UserArticleStateCreate

    state_in = UserArticleStateCreate(user_id=user_id, article_id=article_id)
    return await create_user_article_state(db, state_in=state_in)


async def update_article_read_status(
    db: AsyncSession, *, user_id: UUID, article_id: UUID, is_read: bool
) -> UserArticleState:
    """Update read status for an article.

    Args:
        db: Database session
        user_id: User ID
        article_id: Article ID
        is_read: True to mark as read, False to mark as unread
    """
    state = await get_user_article_state(db, user_id=user_id, article_id=article_id)

    if state:
        # Only update if status is actually changing
        if state.is_read != is_read:
            state.is_read = is_read
            state.read_at = datetime.now(timezone.utc) if is_read else None
            db.add(state)
            await db.commit()
            await db.refresh(state)
    else:
        # Create new state with specified read status
        from app.schemas.subscriptions import UserArticleStateCreate

        state_in = UserArticleStateCreate(user_id=user_id, article_id=article_id, is_read=is_read)
        state = await create_user_article_state(db, state_in=state_in)

    return state


async def mark_article_read(db: AsyncSession, *, user_id: UUID, article_id: UUID) -> UserArticleState:
    """Mark an article as read for a user."""
    return await update_article_read_status(db, user_id=user_id, article_id=article_id, is_read=True)


async def mark_article_unread(db: AsyncSession, *, user_id: UUID, article_id: UUID) -> UserArticleState:
    """Mark an article as unread for a user."""
    return await update_article_read_status(db, user_id=user_id, article_id=article_id, is_read=False)


async def toggle_article_favorite(db: AsyncSession, *, user_id: UUID, article_id: UUID) -> UserArticleState:
    """Toggle favorite status for an article."""
    state = await get_or_create_user_article_state(db, user_id=user_id, article_id=article_id)

    state.is_favorite = not state.is_favorite
    db.add(state)
    await db.commit()
    await db.refresh(state)
    return state


async def toggle_article_read_later(db: AsyncSession, *, user_id: UUID, article_id: UUID) -> UserArticleState:
    """Toggle read later status for an article."""
    state = await get_or_create_user_article_state(db, user_id=user_id, article_id=article_id)

    state.is_read_later = not state.is_read_later
    db.add(state)
    await db.commit()
    await db.refresh(state)
    return state


async def get_user_unread_count(db: AsyncSession, *, user_id: UUID, subscription_ids: list[UUID] | None = None) -> int:
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


async def get_user_favorite_article_ids(db: AsyncSession, *, user_id: UUID) -> list[UUID]:
    """Get IDs of user's favorite articles."""
    result = await db.execute(
        select(UserArticleState.article_id).filter(
            UserArticleState.user_id == user_id, UserArticleState.is_favorite.is_(True)
        )
    )
    return list(result.scalars().all())


async def get_user_read_later_article_ids(db: AsyncSession, *, user_id: UUID) -> list[UUID]:
    """Get IDs of user's read-later articles."""
    result = await db.execute(
        select(UserArticleState.article_id).filter(
            UserArticleState.user_id == user_id, UserArticleState.is_read_later.is_(True)
        )
    )
    return list(result.scalars().all())
