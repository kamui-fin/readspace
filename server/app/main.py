import logging
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.core.redis_cache import RedisCache
from app.routers import router as api_router  # Import the main router
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Redis client
    await RedisCache._get_client()
    yield
    # Shutdown: Close Redis client
    await RedisCache.close()

app = FastAPI(title="Readspace API", lifespan=lifespan)

settings = get_settings()

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
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=400,
        content={"detail": exc.errors()},
    )

# Include the main API router
app.include_router(api_router) # Add all routes from app.routers with /api prefix