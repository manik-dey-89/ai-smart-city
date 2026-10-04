from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./smartcity.db"
    SECRET_KEY: str = "your-super-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Accepts a JSON array string OR a comma-separated string from .env / environment.
    # Examples:
    #   BACKEND_CORS_ORIGINS='["http://localhost:3000","http://localhost"]'
    #   BACKEND_CORS_ORIGINS=http://localhost:3000,http://localhost
    BACKEND_CORS_ORIGINS: List[str] = ["*"]
    MAX_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCK_MINUTES: int = 30
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_DIGIT: bool = True
    PASSWORD_REQUIRE_SPECIAL: bool = True
    DISABLE_GEOMETRY: bool = True  # Disable geometry for SQLite compatibility

    # Google OAuth — set these in .env to enable Google sign-in/sign-up
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        """Accept both JSON-array strings and comma-separated strings."""
        if isinstance(v, str) and not v.startswith("["):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    class Config:
        env_file = ".env"


settings = Settings()
