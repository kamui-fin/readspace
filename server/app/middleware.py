import time
import uuid
from typing import Callable, List, Optional

import structlog
from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse

from app.schemas.settings import Settings
from app.services.auth import get_optional_user

logger = structlog.get_logger()
settings = Settings()


def create_error_response(
    status_code: int,
    detail: str,
    request: Request,
) -> JSONResponse:
    """Create a standardized error response with CORS headers."""
    response = JSONResponse(
        status_code=status_code,
        content={"detail": detail},
    )
    origin = request.headers.get("Origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response


def setup_middleware(app: FastAPI, public_paths: Optional[List[str]] = None):
    """
    Setup all middleware for FastAPI application.

    Args:
        app: FastAPI application
        public_paths: List of path prefixes that don't require authentication
    """
    if public_paths is None:
        public_paths = []

    @app.middleware("http")
    async def request_logging_middleware(
        request: Request, call_next: Callable
    ) -> Response:
        """Log all incoming requests and their processing time."""
        request_id = str(uuid.uuid4())
        start_time = time.time()

        logger.info(
            "Request started",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client_host=request.client.host if request.client else None,
        )

        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            logger.info(
                "Request completed",
                request_id=request_id,
                status_code=response.status_code,
                process_time=process_time,
            )
            return response
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                "Request failed",
                request_id=request_id,
                error=str(e),
                process_time=process_time,
                exc_info=True,
            )
            raise

    @app.middleware("http")
    async def auth_middleware(request: Request, call_next: Callable) -> Response:
        """Handle authentication for protected routes."""
        # Allow preflight requests to pass through
        if request.method == "OPTIONS":
            return await call_next(request)

        # Skip auth for public paths
        path = request.url.path
        for public_path in public_paths:
            if path.startswith(public_path):
                return await call_next(request)

        # Check for auth header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return create_error_response(
                status.HTTP_401_UNAUTHORIZED,
                "Authentication required",
                request,
            )

        # Attach user to request state if token is valid
        try:
            user = get_optional_user(request)
            if user:
                request.state.user = user
                return await call_next(request)
            else:
                return create_error_response(
                    status.HTTP_401_UNAUTHORIZED,
                    "Invalid authentication token",
                    request,
                )
        except Exception as e:
            logger.error("Authentication error", error=str(e), exc_info=True)
            return create_error_response(
                status.HTTP_401_UNAUTHORIZED,
                "Authentication failed",
                request,
            )

    logger.info("Middleware setup completed", public_paths=public_paths)
