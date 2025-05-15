from app.core.config import get_settings
from app.middleware import setup_middleware
from app.routers import auth, books, feedback, highlights
from app.utils.logging_config import setup_logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

settings = get_settings()
logger = setup_logging()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description="API for ReadSpace application",
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Type", "Authorization", "Content-Length"],
        max_age=600,
    )

    # Include routers
    app.include_router(auth.router, prefix=settings.API_V1_STR)
    app.include_router(books.router, prefix=settings.API_V1_STR)
    app.include_router(highlights.router, prefix=settings.API_V1_STR)
    app.include_router(feedback.router, prefix=settings.API_V1_STR)

    # Setup auth middleware with public paths
    public_paths = [
        f"{settings.API_V1_STR}/health",
        "/docs",
        "/redoc",
        "/openapi.json",
    ]
    setup_middleware(app, public_paths)

    return app


app = create_app()
