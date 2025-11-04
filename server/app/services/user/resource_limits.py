"""Resource limit service for enforcing user role-based limits."""

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.resource_limits import RESOURCE_LIMITS
from app.models import FeedSubscription


class ResourceLimitService:
    """Service for checking and enforcing resource limits based on user roles."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_limit(self, user_id: UUID, resource: str, user_role: str) -> bool:
        """Check if user can perform action within limits.

        Args:
            user_id: User UUID
            resource: Resource type (e.g., 'max_subscriptions', 'max_books')
            user_role: User's role (basic, pro, admin)

        Returns:
            True if action is allowed, False if limit exceeded
        """
        limits = self.get_user_limits(user_role)

        # Admin has unlimited access (-1 means unlimited)
        if limits.get(resource, 0) == -1:
            return True

        current_usage = await self.get_current_usage(user_id, resource)
        limit: int = limits.get(resource, 0)

        return current_usage < limit

    async def get_current_usage(self, user_id: UUID, resource: str) -> int:
        """Get current usage count for resource.

        Args:
            user_id: User UUID
            resource: Resource type

        Returns:
            Current usage count
        """
        if resource == "max_subscriptions":
            result = await self.db.execute(
                select(func.count()).select_from(FeedSubscription).where(FeedSubscription.user_id == user_id)
            )
            return result.scalar_one()

        elif resource == "max_books":
            result = await self.db.execute(
                select(func.count()).select_from(UserBookLibrary).where(UserBookLibrary.user_id == user_id)
            )
            return result.scalar_one()

        return 0

    def get_user_limits(self, user_role: str) -> dict[str, Any]:
        """Get all limits for user role.

        Args:
            user_role: User's role

        Returns:
            Dictionary of resource limits
        """
        return RESOURCE_LIMITS.get(user_role, RESOURCE_LIMITS["basic"])


class ResourceLimitError(Exception):
    """Exception raised when resource limit is exceeded."""

    def __init__(self, resource: str, limit: int, current: int):
        self.resource = resource
        self.limit = limit
        self.current = current
        super().__init__(f"Resource limit exceeded for {resource}: {current}/{limit}")
