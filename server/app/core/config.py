from functools import cache

from pydantic import AnyUrl, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = Field(default="development", pattern="^(development|staging|production|test)$")
    LOG_LEVEL: str = Field(default="INFO", pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")

    # Supabase Configuration (validated URLs)
    SUPABASE_URL: AnyUrl
    SUPABASE_JWT_SECRET: SecretStr
    SUPABASE_SERVICE_ROLE_KEY: SecretStr

    # Database Configuration
    SUPABASE_DB_CONNECTION: str

    # CORS Configuration
    CORS_ORIGIN: str = "*"

    # Redis Configuration (validated URL)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Celery Configuration (validated URLs)
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # AI Configuration
    ENABLE_AI: bool = True  # Master switch for all AI functionality

    # Gemini Configuration (Primary AI service)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash-lite"  # For text generation
    GEMINI_EMBEDDING_MODEL: str = "text-embedding-004"  # For embeddings

    # RSShub Configuration (validated URL)
    RSSHUB_URL: str = "http://localhost:1200"  # Default RSShub instance URL

    model_config = SettingsConfigDict(env_file=".env")

    @field_validator("GEMINI_API_KEY")
    @classmethod
    def validate_gemini_api_key(cls, v: str, info) -> str:
        """Validate GEMINI_API_KEY is provided when AI is enabled."""
        if info.data.get("ENABLE_AI") and not v:
            raise ValueError("GEMINI_API_KEY is required when ENABLE_AI is True")
        return v

    @field_validator("SUPABASE_DB_CONNECTION")
    @classmethod
    def validate_db_connection(cls, v: str) -> str:
        """Validate database connection string format."""
        if not v:
            raise ValueError("SUPABASE_DB_CONNECTION is required")
        if not v.startswith("postgresql"):
            raise ValueError("SUPABASE_DB_CONNECTION must be a valid PostgreSQL connection string")
        return v

    @field_validator("REDIS_URL", "CELERY_BROKER_URL", "CELERY_RESULT_BACKEND")
    @classmethod
    def validate_redis_url(cls, v: str) -> str:
        """Validate Redis URL format."""
        if not v.startswith("redis://"):
            raise ValueError(f"Redis URL must start with 'redis://': {v}")
        return v

    @field_validator("RSSHUB_URL")
    @classmethod
    def validate_rsshub_url(cls, v: str) -> str:
        """Validate RSShub URL format."""
        if not v.startswith(("http://", "https://")):
            raise ValueError(f"RSSHUB_URL must be a valid HTTP URL: {v}")
        return v


@cache
def get_settings() -> Settings:
    return Settings()
