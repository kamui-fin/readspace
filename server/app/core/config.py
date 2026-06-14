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
    SUPABASE_ANON_KEY: str = ""

    # Database Configuration
    # API uses Session Mode (port 5432) with QueuePool for persistent connections
    # Workers use Transaction Mode (port 6543) with NullPool for surgical transactions
    DATABASE_URL_API: str
    DATABASE_URL_WORKER: str

    # CORS Configuration
    CORS_ORIGIN: str = "*"

    # Redis Configuration (validated URL)
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI Configuration
    ENABLE_AI: bool = True  # Master switch for all AI functionality

    # Gemini Configuration (Primary AI service)
    GEMINI_API_KEY: str = ""
    GEMINI_SMART_MODEL: str = "gemini-3.5-flash"  # For complex reasoning (e.g. enrichment)
    GEMINI_FAST_MODEL: str = "gemini-3.1-flash-lite"  # For high-volume continuous parsing (summaries, translation)
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"  # For embeddings

    # RSShub Configuration (validated URL)
    RSSHUB_URL: str = "http://localhost:1200"  # Default RSShub instance URL

    # Meilisearch Configuration
    MEILISEARCH_URL: str = "http://localhost:7700"
    MEILISEARCH_MASTER_KEY: SecretStr
    MEILISEARCH_INDEX_NAME: str = "feeds"

    # Google Cloud / Vertex AI Configuration
    GOOGLE_CLOUD_PROJECT: str | None = None
    GOOGLE_CLOUD_LOCATION: str = "us-central1"
    GCS_BUCKET: str | None = None
    # Inbound Webhook Config
    INBOUND_WEBHOOK_SECRET: str = "dev_inbound_secret"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("GEMINI_API_KEY")
    @classmethod
    def validate_gemini_api_key(cls, v: str, info) -> str:
        """Validate GEMINI_API_KEY is provided when AI is enabled and Vertex AI is not used."""
        return v

    @field_validator("DATABASE_URL_API")
    @classmethod
    def validate_api_db_connection(cls, v: str) -> str:
        """Validate API database connection string format."""
        if not v:
            raise ValueError("DATABASE_URL_API is required")
        if not v.startswith("postgresql"):
            raise ValueError("DATABASE_URL_API must be a valid PostgreSQL connection string")
        return v

    @field_validator("DATABASE_URL_WORKER")
    @classmethod
    def validate_worker_db_connection(cls, v: str) -> str:
        """Validate Worker database connection string format."""
        if not v:
            raise ValueError("DATABASE_URL_WORKER is required")
        if not v.startswith("postgresql"):
            raise ValueError("DATABASE_URL_WORKER must be a valid PostgreSQL connection string")
        return v

    @field_validator("REDIS_URL")
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

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENVIRONMENT == "development"

    @property
    def is_supabase_cloud(self) -> bool:
        """Detect if using Supabase Cloud by URL pattern."""
        return ".pooler.supabase.com" in self.DATABASE_URL_API or ".supabase.co" in self.DATABASE_URL_API


@cache
def get_settings() -> Settings:
    return Settings()
