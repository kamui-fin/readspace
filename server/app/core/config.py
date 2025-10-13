from functools import cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Observability Configuration
    LOKI_URL: str = ""
    SERVICE_NAME: str = "readspace-server"  # Can be overridden via env var

    # OpenTelemetry Configuration
    OTEL_SERVICE_NAME: str = "readspace-server"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = ""
    OTEL_RESOURCE_ATTRIBUTES: str = ""

    # Supabase Configuration
    SUPABASE_URL: str
    SUPABASE_JWT_SECRET: SecretStr
    SUPABASE_SERVICE_ROLE_KEY: SecretStr

    # Database Configuration
    SUPABASE_DB_CONNECTION: str

    # CORS Configuration
    CORS_ORIGIN: str = "*"

    REDIS_URL: str = "redis://localhost:6379/0"

    # Celery Configuration
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # AI Configuration
    ENABLE_AI: bool = True  # Master switch for all AI functionality

    # Gemini Configuration (Primary AI service)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash-lite"  # For text generation
    GEMINI_EMBEDDING_MODEL: str = "text-embedding-004"  # For embeddings

    # RSShub Configuration
    RSSHUB_URL: str = "http://localhost:1200"  # Default RSShub instance URL

    model_config = SettingsConfigDict(env_file=".env")


@cache
def get_settings() -> Settings:
    return Settings()
