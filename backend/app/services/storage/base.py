"""
StorageProvider = the one interface the rest of the app talks to.

Routers never import boto3 / cloudinary. They call provider.upload(), provider.get_url() ...
That is why switching Local -> Cloudinary -> S3 only needs a config change.
"""
import uuid
from abc import ABC, abstractmethod


class ProviderNotConfigured(RuntimeError):
    pass


class StorageProvider(ABC):
    name = "base"
    label = "Base"
    description = ""
    env_vars: list[str] = []
    supports_transforms = False   # True = provider can make thumbnails from the original URL
    supports_presign = False      # True = browser may upload directly to the bucket

    def is_configured(self) -> bool:
        return True

    def make_key(self, user_id: str, ext: str) -> str:
        """Object name inside the bucket/folder. UUID => uploads can never overwrite each other."""
        return f"{user_id}/{uuid.uuid4().hex}{ext}"

    @abstractmethod
    async def upload(self, key: str, data: bytes, content_type: str) -> None: ...

    @abstractmethod
    async def delete(self, key: str) -> None: ...

    @abstractmethod
    async def read(self, key: str) -> bytes: ...

    @abstractmethod
    def get_url(self, key: str) -> str: ...

    def get_thumbnail_url(self, key: str, thumb_key: str | None = None) -> str:
        return self.get_url(thumb_key or key)

    async def usage(self) -> dict:
        return {}

    def presign_put(self, key: str, content_type: str, expires: int = 900) -> str:
        raise NotImplementedError(f"{self.name} does not support presigned uploads")
