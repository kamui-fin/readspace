from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.routers import books, feedback, highlights

app = FastAPI(title="ReadSpace API")

settings = get_settings()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(books.router, prefix=settings.API_V1_STR)
app.include_router(feedback.router, prefix=settings.API_V1_STR)
app.include_router(highlights.router, prefix=settings.API_V1_STR)
