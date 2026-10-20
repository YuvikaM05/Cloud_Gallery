from datetime import datetime

from pydantic import BaseModel, Field


class NotificationOut(BaseModel):
    id: str
    kind: str
    title: str
    body: str = ""
    read: bool
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread: int


class NotificationIn(BaseModel):
    kind: str = "info"
    title: str = Field(..., max_length=120)
    body: str = Field("", max_length=300)


class ProviderInfo(BaseModel):
    id: str
    name: str
    description: str
    configured: bool
    active: bool
    env_vars: list[str]


class TypeBreakdown(BaseModel):
    type: str
    count: int
    bytes: int


class StorageSummary(BaseModel):
    provider: str
    used_bytes: int
    quota_bytes: int
    free_bytes: int
    photo_count: int
    bin_bytes: int
    by_type: list[TypeBreakdown]
    providers: list[ProviderInfo]
    direct_upload: bool
    provider_usage: dict | None = None


class ProviderSwitch(BaseModel):
    provider: str
