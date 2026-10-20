"""Central configuration. Values come from backend/.env (or real environment variables)."""
import logging
import os
import secrets
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]  # backend/
# The Electron app can point these at the user's AppData folder.
ENV_FILE = Path(os.getenv("CG_ENV_FILE") or BASE_DIR / ".env")
UPLOAD_DIR = Path(os.getenv("CG_UPLOAD_DIR") or BASE_DIR / "uploads")

log = logging.getLogger("cloudgallery.config")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_FILE), env_file_encoding="utf-8", extra="ignore")

    MONGODB_URI: str
    DATABASE_NAME: str = "photo_gallery"

    JWT_SECRET: str = ""
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7
    AUTH_RATE_LIMIT_PER_MIN: int = 10

    # "null" is the Origin Electron sends when it loads the built app from file://
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,null"
    MAX_UPLOAD_MB: int = 50
    QUOTA_GB: float = 5.0

    STORAGE_PROVIDER: str = "local"

    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    S3_BUCKET: str = ""
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    S3_ENDPOINT_URL: str = ""
    S3_PUBLIC_BASE_URL: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024

    @property
    def quota_bytes(self) -> int:
        return int(self.QUOTA_GB * 1024 * 1024 * 1024)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if not s.JWT_SECRET:
        s.JWT_SECRET = secrets.token_hex(32)
        log.warning("JWT_SECRET is empty -> using a temporary one. Users will be logged out on every restart. "
                    "Set JWT_SECRET in .env.")
    return s
