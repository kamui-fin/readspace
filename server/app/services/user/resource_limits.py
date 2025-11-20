"""Resource limit service for enforcing user role-based limits."""

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.resource_limits import RESOURCE_LIMITS
from app.crud.profile import get_profile_by_id
from app.models import FeedSubscription


class ResourceLimitService:
    """Service for checking and enforcing resource limits based on user roles."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_limit(self, user_id: UUID, resource: str, user_role: str, lock: bool = True) -> bool:
        """Check if user can perform action within limits.

        Args:
            user_id: User UUID
            resource: Resource type (e.g., 'max_subscriptions')
            user_role: User's role (basic, pro, admin)
            lock: If True, acquire row-level lock to prevent race conditions (default: True)

        Returns:
            True if action is allowed, False if limit exceeded
        """
        limits = self.get_user_limits(user_role)

        # Admin has unlimited access (-1 means unlimited)
        if limits.get(resource, 0) == -1:
            return True

        current_usage = await self.get_current_usage(user_id, resource, lock=lock)
        limit: int = limits.get(resource, 0)

        return current_usage < limit

    async def get_current_usage(self, user_id: UUID, resource: str, lock: bool = False) -> int:
        """Get current usage count for resource.

        Args:
            user_id: User UUID
            resource: Resource type
            lock: If True, acquire row-level lock to prevent race conditions (use within transaction)

        Returns:
            Current usage count
        """
        if resource == "max_subscriptions":
            if lock:
                # PostgreSQL doesn't allow FOR UPDATE with aggregate functions
                # So we select the IDs with lock, then count them
                query = select(FeedSubscription.id).where(FeedSubscription.user_id == user_id).with_for_update()
                result = await self.db.execute(query)
                rows = result.all()
                return len(rows)
            else:
                # Without lock, we can use the more efficient COUNT query
                query = select(func.count()).select_from(FeedSubscription).where(FeedSubscription.user_id == user_id)
                result = await self.db.execute(query)
                return result.scalar_one()

        return 0

    def get_user_limits(self, user_role: str) -> dict[str, Any]:
        """Get all limits for user role.

        Args:
            user_role: User's role (can be 'basic', 'BASIC', or 'UserRole.BASIC')

        Returns:
            Dictionary of resource limits
        """
        # Normalize role string - handle both "UserRole.BASIC" and "BASIC" formats
        normalized_role = user_role.lower().replace("userrole.", "")
        return RESOURCE_LIMITS.get(normalized_role, RESOURCE_LIMITS["basic"])


class ResourceLimitError(Exception):
    """Exception raised when resource limit is exceeded."""

    def __init__(self, resource: str, limit: int, current: int):
        self.resource = resource
        self.limit = limit
        self.current = current
        super().__init__(f"Resource limit exceeded for {resource}: {current}/{limit}")


async def check_subscription_limit(
    db: AsyncSession,
    user_id: UUID,
) -> None:
    """Check if user can add more feed subscriptions and raise HTTPException if limit exceeded.

    Args:
        db: Database session
        user_id: User UUID

    Raises:
        HTTPException: 404 if user profile not found, 429 if subscription limit exceeded
    """
    profile = await get_profile_by_id(db, user_id=user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )

    resource_service = ResourceLimitService(db)
    can_proceed = await resource_service.check_limit(user_id, "max_subscriptions", str(profile.role))

    if not can_proceed:
        limits = resource_service.get_user_limits(str(profile.role))
        current_count = await resource_service.get_current_usage(user_id, "max_subscriptions")
        max_allowed = limits.get("max_subscriptions", 0)

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You've reached the maximum number of feed subscriptions ({current_count}/{max_allowed}). "
            "Please upgrade your plan to add more feeds.",
        )
