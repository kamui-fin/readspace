from functools import cache
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Supabase Configuration
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_JWT_SECRET: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # Database Configuration
    SUPABASE_DB_CONNECTION: str

    # API Configuration
    API_V1_STR: str = "/api/v1"

    # CORS Configuration
    CORS_ORIGINS: List[str] = ["http://localhost:8042"]

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