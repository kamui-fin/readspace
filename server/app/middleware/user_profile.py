"""Middleware to ensure user profile exists."""

from uuid import UUID

import structlog
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.crud.profile import create_profile_if_not_exists
from app.db.session import get_db
from app.services.user.auth import get_optional_user

logger = structlog.get_logger(__name__)


class UserProfileMiddleware(BaseHTTPMiddleware):
    """Middleware to automatically ensure user profile exists for authenticated requests."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Process request and ensure user profile exists if authenticated."""
        # Skip profile creation for unauthenticated endpoints and static assets
        skip_paths = ["/", "/health", "/metrics", "/docs", "/openapi.json", "/redoc"]
        if request.url.path in skip_paths or request.url.path.startswith("/api/auth"):
            return await call_next(request)

        # Try to get current user from token (if present)
        try:
            # Try to get user from authorization header (non-raising)
            token_data = get_optional_user(request)

            if token_data and token_data.sub and token_data.email:
                user_id = UUID(token_data.sub)
                email = token_data.email

                # Get database session
                async for db in get_db():
                    try:
                        # Check if profile exists and create if needed
                        # This is cached at the DB level with upsert, so it's efficient
                        await create_profile_if_not_exists(db, user_id=user_id, email=email)

                        logger.debug(
                            "User profile ensured via middleware",
                            user_id=user_id,
                            email=email,
                        )
                    finally:
                        # Always close the database session
                        await db.close()
                    break  # Exit after first iteration
        except Exception as e:
            # Don't fail the request if profile creation fails
            logger.warning(
                "Failed to ensure user profile in middleware",
                error=str(e),
                path=request.url.path,
            )

        # Continue processing the request
        return await call_next(request)
