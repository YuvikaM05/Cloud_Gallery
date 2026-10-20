from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ShareIn(BaseModel):
    kind: Literal["photo", "photos", "album"]
    photo_ids: list[str] = Field(default_factory=list)
    album_id: str | None = None
    expires_in_days: int | None = Field(None, ge=1, le=365, description="None = never expires")

    model_config = {"json_schema_extra": {"example": {"kind": "photos", "photo_ids": ["665f0c..."], "expires_in_days": 7}}}


class ShareOut(BaseModel):
    id: str
    token: str
    path: str = Field(..., description="Public page path, e.g. /s/abc123")
    kind: str
    title: str
    count: int
    views: int
    expires_at: datetime | None = None
    expired: bool = False
    created_at: datetime


class SharedPhoto(BaseModel):
    id: str
    name: str
    url: str
    thumb_url: str
    width: int | None = None
    height: int | None = None


class SharePublicOut(BaseModel):
    title: str
    owner: str
    expires_at: datetime | None = None
    photos: list[SharedPhoto]
