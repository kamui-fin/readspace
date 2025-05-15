from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""
    # API settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "ReadSpace API"
    VERSION: str = "1.0.0"
    
    # Supabase settings
    SUPABASE_URL: str = "http://localhost:54321"
    SUPABASE_KEY: str
    SUPABASE_DB_CONNECTION: str = "postgresql://postgres:postgres@localhost:5432/postgres"
    
    # Security
    JWT_SECRET: str = "super-secret-jwt-token-with-at-least-32-characters-long"
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:8042"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def allowed_origins_list(self) -> List[str]:
        """Get list of allowed origins."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()