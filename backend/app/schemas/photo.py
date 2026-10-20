from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

SortKey = Literal["date-new", "date-old", "name-asc", "name-desc", "size-large", "size-small"]
BulkAction = Literal["favorite", "unfavorite", "delete", "restore", "delete_forever", "move", "remove_from_album"]


class PhotoOut(BaseModel):
    id: str
    name: str
    url: str
    thumb_url: str
    size: int
    mime: str
    width: int | None = None
    height: int | None = None
    exif: dict[str, str] = {}
    hash: str | None = None
    favorite: bool = False
    deleted: bool = False
    deleted_at: datetime | None = None
    days_left: int | None = Field(None, description="Days until a binned photo is purged")
    album_id: str | None = None
    album_name: str | None = None
    tags: list[str] = []
    taken_at: datetime | None = None
    created_at: datetime
    provider: str = "local"
    is_duplicate: bool = False


class PhotoPage(BaseModel):
    items: list[PhotoOut]
    total: int
    page: int
    limit: int
    has_more: bool


class PhotoIds(BaseModel):
    ids: list[str]
    total: int


class PhotoPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=150)
    favorite: bool | None = None
    tags: list[str] | None = None

    model_config = {"json_schema_extra": {"example": {"name": "Goa trip.jpg", "favorite": True, "tags": ["beach"]}}}


class BulkIn(BaseModel):
    ids: list[str] = Field(..., min_length=1, max_length=5000)
    action: BulkAction
    album_id: str | None = Field(None, description="Required for action=move")

    model_config = {"json_schema_extra": {"example": {"ids": ["665f0c...", "665f0d..."], "action": "favorite"}}}


class BulkOut(BaseModel):
    matched: int
    modified: int


class RejectedFile(BaseModel):
    name: str
    reason: str


class UploadOut(BaseModel):
    items: list[PhotoOut]
    rejected: list[RejectedFile] = []


class ZipIn(BaseModel):
    ids: list[str] = Field(..., min_length=1, max_length=500)


class PresignIn(BaseModel):
    filename: str
    content_type: str = "image/jpeg"


class PresignOut(BaseModel):
    upload_url: str
    method: str = "PUT"
    headers: dict[str, str]
    key: str


class RegisterIn(BaseModel):
    key: str
    name: str
