from functools import cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Supabase Configuration
    SUPABASE_URL: str
    SUPABASE_JWT_SECRET: SecretStr
    SUPABASE_SERVICE_ROLE_KEY: SecretStr

    # Database Configuration
    SUPABASE_DB_CONNECTION: str

    # CORS Configuration
    CORS_ORIGIN: str = "http://localhost:8042"

    REDIS_URL: str = "redis://localhost:6379/0"

    # Celery Configuration
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    model_config = SettingsConfigDict(env_file=".env")


@cache
def get_settings() -> Settings:
    return Settings()
