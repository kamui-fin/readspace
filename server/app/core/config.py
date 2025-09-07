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

    # AI/Embedding Configuration
    OPENAI_API_KEY: str = "ollama"  # Default for ollama
    OPENAI_BASE_URL: str = "http://localhost:11434/v1"  # Default ollama endpoint
    EMBEDDING_MODEL: str = "paraphrase-multilingual"  # Default embedding model
    AI_MODEL: str = "gemma3:4b"  # Default AI model for general tasks

    model_config = SettingsConfigDict(env_file=".env")


@cache
def get_settings() -> Settings:
    return Settings()
