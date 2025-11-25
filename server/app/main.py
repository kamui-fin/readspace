from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.logging_config import setup_logging
from app.core.redis_cache import close_pool, get_pool
from app.core.taskiq_app import broker
from app.middleware.compression import compression_middleware
from app.middleware.logging import logging_middleware
from app.routers import api_router

# Configure structured logging first
setup_logging()
logger = structlog.get_logger(__name__)


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI lifespan context manager for startup/shutdown."""
    # Startup
    get_pool()  # Initialize Redis connection pool
    await broker.startup()
    logger.info("Application startup complete")

    yield

    # Shutdown
    await broker.shutdown()
    await close_pool()
    logger.info("Application shutdown complete")


# Config
settings = get_settings()

app = FastAPI(
    title="Readspace API",
    description="A privacy-focused open-source RSS reader.",
    version="1.0.0",
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
)

# --- Middleware Registration ---
# Order matters: Inner runs first on request, Outer runs first on response
# We want Compression LAST on response
# We want Logging FIRST on request

# 1. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Compression (Outer layer response processing)
app.add_middleware(BaseHTTPMiddleware, dispatch=compression_middleware)

# 4. Logging (Inner layer, closest to logic)
app.add_middleware(BaseHTTPMiddleware, dispatch=logging_middleware)


# --- Exception Handlers ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> ORJSONResponse:
    logger.error("Validation error", path=request.url.path, errors=exc.errors())
    return ORJSONResponse(status_code=422, content={"detail": exc.errors()})


# --- Router ---
app.include_router(api_router, prefix="/api")
