import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.photo import SortKey

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    email: str
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL.match(v):
            raise ValueError("Invalid email address")
        return v

    model_config = {"json_schema_extra": {"example": {"name": "Yuvika", "email": "yuvika@example.com", "password": "StrongPass123"}}}


class LoginIn(BaseModel):
    email: str
    password: str

    model_config = {"json_schema_extra": {"example": {"email": "yuvika@example.com", "password": "StrongPass123"}}}


class UserSettings(BaseModel):
    theme: Literal["light", "dark", "system"] = "system"
    default_view: Literal["large", "medium", "small"] = "medium"
    default_sort: SortKey = "date-new"
    bin_days: int = Field(30, ge=1, le=365)
    upload_quality: Literal["original", "compressed"] = "original"
    storage_provider: str | None = None


class SettingsPatch(BaseModel):
    theme: Literal["light", "dark", "system"] | None = None
    default_view: Literal["large", "medium", "small"] | None = None
    default_sort: SortKey | None = None
    bin_days: int | None = Field(None, ge=1, le=365)
    upload_quality: Literal["original", "compressed"] | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    settings: SettingsPatch | None = None


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    settings: UserSettings
    created_at: datetime | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
