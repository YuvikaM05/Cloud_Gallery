from datetime import datetime

from pydantic import BaseModel, Field


class AlbumIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    photo_ids: list[str] = Field(default_factory=list, description="Optionally put these photos in the new album")

    model_config = {"json_schema_extra": {"example": {"name": "Goa 2026", "photo_ids": []}}}


class AlbumPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    cover_photo_id: str | None = None


class AlbumOut(BaseModel):
    id: str
    name: str
    cover_url: str | None = None
    cover_photo_id: str | None = None
    photo_count: int = 0
    total_size: int = 0
    created_at: datetime


class AlbumAddIn(BaseModel):
    photo_ids: list[str] = Field(..., min_length=1, max_length=5000)
