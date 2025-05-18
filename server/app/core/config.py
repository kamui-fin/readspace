from functools import cache
from typing import List

from pydantic import SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Supabase Configuration
    SUPABASE_URL: str
    SUPABASE_KEY: SecretStr
    SUPABASE_JWT_SECRET: SecretStr
    SUPABASE_SERVICE_ROLE_KEY: SecretStr

    # Database Configuration
    SUPABASE_DB_CONNECTION: str

    # CORS Configuration
    CORS_ORIGINS: List[str] = ["http://localhost:8042"]

    # Celery Configuration
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"

    # Other Configuration
    DEBUG: bool = False

    class Config:
        env_file = ".env"

    # Add your settings here, for example:
    # DATABASE_URL: str
    # API_KEY: str
    pass 

@cache
def get_settings() -> Settings:
    return Settings()