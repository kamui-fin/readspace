"""Decorators for enforcing resource limits."""

from collections.abc import Awaitable, Callable
from functools import wraps
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.crud_profile import crud_profile
from app.services.resource_limit_service import ResourceLimitError, ResourceLimitService


def require_resource_limit(resource: str) -> Callable[[Callable[..., Awaitable[Any]]], Callable[..., Awaitable[Any]]]:
    """Decorator to check resource limits before action.

    Args:
        resource: Resource type to check (e.g., 'max_subscriptions', 'max_books')
    """

    def decorator(func: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract user_id and db session from the function parameters
            # This assumes the function has user_id as a parameter and db as a dependency
            user_id: UUID | None = None
            db: AsyncSession | None = None

            # Look for user_id in kwargs or extract from current_user
            if "user_id" in kwargs:
                user_id = kwargs["user_id"]
            elif "current_user_id" in kwargs:
                user_id = kwargs["current_user_id"]
            elif "current_user" in kwargs:
                current_user = kwargs["current_user"]
                user_id = UUID(current_user.sub)

            # Look for db in kwargs
            if "db" in kwargs:
                db = kwargs["db"]

            # Fail loudly if required parameters are missing
            if not user_id:
                raise ValueError(
                    "user_id is required for resource limit checking but was not found in function parameters"
                )
            if not db:
                raise ValueError(
                    "db session is required for resource limit checking but was not found in function parameters"
                )

            try:
                # Get user profile to determine role
                profile = await crud_profile.get_by_id(db, user_id=user_id)
                if not profile:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="User profile not found",
                    )

                # Check resource limit
                resource_service = ResourceLimitService(db)
                can_proceed = await resource_service.check_limit(user_id, resource, str(profile.role))

                if not can_proceed:
                    limits = resource_service.get_user_limits(str(profile.role))
                    current_usage = await resource_service.get_current_usage(user_id, resource)

                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Resource limit exceeded for {resource}. "
                        f"Current usage: {current_usage}/{limits.get(resource, 0)}",
                    )

                return await func(*args, **kwargs)

            except ResourceLimitError as e:
                raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e)) from e

        return wrapper

    return decorator
