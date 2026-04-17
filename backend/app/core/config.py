from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "MikroTik Manager"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./mikrotik_manager.db"

    # JWT
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Encryption key for device credentials
    DEVICE_CREDENTIAL_KEY: str = "change-this-encryption-key-32b!"

    # MikroTik defaults
    MIKROTIK_DEFAULT_PORT: int = 443
    MIKROTIK_DEFAULT_USE_SSL: bool = True
    MIKROTIK_REQUEST_TIMEOUT: int = 30

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
