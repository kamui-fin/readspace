from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import get_settings
from app.core.redis_client import close_redis_client, create_redis_client
from app.middleware import setup_middleware
from app.routers import router
from app.utils.logging_config import setup_logging, setup_tracing

settings = get_settings()
logger = setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown."""
    logger.info("Application startup: Creating Redis client...")
    await create_redis_client()
    yield
    logger.info("Application shutdown: Closing Redis client...")
    await close_redis_client()

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description="API for ReadSpace application",
        version=settings.VERSION,
        lifespan=lifespan,
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Type", "Authorization", "Content-Length"],
        max_age=600,
    )

    # Include routers
    app.include_router(router, prefix=settings.API_V1_STR)

    # Setup auth middleware with public paths
    public_paths = [
        f"{settings.API_V1_STR}/health",
        "/docs",
        "/redoc",
        "/openapi.json",
    ]
    setup_middleware(app, public_paths)

    # Setup monitoring and tracing
    setup_tracing(app)
    Instrumentator().instrument(app).expose(app)

    return app

app = create_app()
