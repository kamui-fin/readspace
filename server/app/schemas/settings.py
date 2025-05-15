from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Supabase settings
    supabase_url: str = "http://localhost:54321"
    supabase_key: SecretStr
    supabase_db_connection: str = (
        "postgresql://postgres:postgres@localhost:5432/postgres"
    )

    # Auth settings
    jwt_secret: SecretStr = "super-secret-jwt-token-with-at-least-32-characters-long"

    # Allowed origins for CORS
    allowed_origins: str = "http://localhost:8042"

    # --- Added Logging/Tracing Settings ---
    log_level: str = "INFO"  # Default log level
    environment: str = "development"  # e.g., development, staging, production

    # Load settings from .env file
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")
