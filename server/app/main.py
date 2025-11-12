from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.constants import SHOW_DOCS_ENVIRONMENTS
from app.core.redis_cache import RedisCache
from app.core.taskiq_app import broker
from app.middleware import CompressionMiddleware, HTTPCachingMiddleware, RequestIdMiddleware
from app.routers import router as api_router  # Import the main router
from app.utils.logging_config import setup_logging

# Configure structured logging first
setup_logging()
logger = structlog.get_logger(__name__)


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI lifespan context manager for startup/shutdown."""
    # Startup: Initialize Redis connection pool
    await RedisCache.get_pool()

    # Startup: Initialize Taskiq broker
    await broker.startup()

    logger.info("Application startup complete")

    yield

    # Shutdown: Close Taskiq broker
    await broker.shutdown()

    # Shutdown: Close Redis connection pool
    await RedisCache.close_pool()
    logger.info("Application shutdown complete")


# Configure FastAPI with comprehensive documentation metadata
settings = get_settings()

# Determine if documentation should be enabled based on environment
docs_config = {}

if settings.ENVIRONMENT not in SHOW_DOCS_ENVIRONMENTS:
    # Hide documentation in production
    docs_config.update(
        {
            "openapi_url": None,
            "docs_url": None,
            "redoc_url": None,
        }
    )

app = FastAPI(
    title="Readspace API",
    description="""
    A privacy-focused open-source RSS reader to follow all the blogs, publications, newsletters,
    and writers you care about.

    ## Authentication

    This API uses Supabase JWT tokens for authentication. Include your token in the
    `Authorization` header as `Bearer <token>`.

    ## Rate Limiting

    Some endpoints have resource limits to ensure fair usage and prevent abuse.
    """,
    version="1.0.0",
    contact={
        "name": "Readspace Support",
        "url": "https://github.com/kamui-fin/readspace",
        "email": "support@readspace.ai",
    },
    license_info={
        "name": "GPLv3 License",
        "url": "https://github.com/kamui-fin/readspace/blob/main/LICENSE",
    },
    servers=[
        {"url": "https://api.readspace.ai", "description": "Production server"},
    ],
    lifespan=lifespan,
    **docs_config,
)

# Add Request ID middleware (must be added before other middleware to ensure request_id is always available)
app.add_middleware(RequestIdMiddleware)

# Add HTTP Caching middleware (adds ETag and Cache-Control headers)
# This should be early in the chain to cache the final response
app.add_middleware(HTTPCachingMiddleware)

# Add Compression middleware (compresses responses with Brotli)
# This should be last in the middleware chain so it compresses the final response
app.add_middleware(CompressionMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


# Include the main API router
app.include_router(api_router, prefix="/api")  # Add all routes from app.routers with /api prefix
