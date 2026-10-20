import asyncio
import io
import urllib.request

from app.core.config import get_settings
from app.services.storage.base import ProviderNotConfigured, StorageProvider


class CloudinaryProvider(StorageProvider):
    name = "cloudinary"
    label = "Cloudinary"
    description = ("Managed image CDN. Free tier, automatic thumbnails/resizing through URL transformations. "
                   "Easiest cloud to start with.")
    env_vars = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]
    supports_transforms = True

    def __init__(self) -> None:
        self._ready = False

    def is_configured(self) -> bool:
        s = get_settings()
        return bool(s.CLOUDINARY_CLOUD_NAME and s.CLOUDINARY_API_KEY and s.CLOUDINARY_API_SECRET)

    def _sdk(self):
        if not self.is_configured():
            raise ProviderNotConfigured("Cloudinary is not configured. Fill CLOUDINARY_* in backend/.env")
        import cloudinary  # imported lazily so the app starts even if the package is missing

        if not self._ready:
            s = get_settings()
            cloudinary.config(cloud_name=s.CLOUDINARY_CLOUD_NAME, api_key=s.CLOUDINARY_API_KEY,
                              api_secret=s.CLOUDINARY_API_SECRET, secure=True)
            self._ready = True
        return cloudinary

    def make_key(self, user_id: str, ext: str) -> str:
        import uuid
        return f"cloudgallery/{user_id}/{uuid.uuid4().hex}"  # Cloudinary public_id has no extension

    async def upload(self, key: str, data: bytes, content_type: str) -> None:
        cl = self._sdk()
        import cloudinary.uploader

        await asyncio.to_thread(cloudinary.uploader.upload, io.BytesIO(data), public_id=key,
                                resource_type="image", overwrite=False)

    async def delete(self, key: str) -> None:
        self._sdk()
        import cloudinary.uploader

        await asyncio.to_thread(cloudinary.uploader.destroy, key, resource_type="image")

    def get_url(self, key: str) -> str:
        self._sdk()
        from cloudinary.utils import cloudinary_url

        return cloudinary_url(key, secure=True)[0]

    def get_thumbnail_url(self, key: str, thumb_key: str | None = None) -> str:
        self._sdk()
        from cloudinary.utils import cloudinary_url

        # Cloudinary builds the thumbnail on the fly from the original - no second upload needed.
        return cloudinary_url(key, secure=True, width=480, height=480, crop="limit", quality="auto", fetch_format="auto")[0]

    async def read(self, key: str) -> bytes:
        url = self.get_url(key)
        return await asyncio.to_thread(lambda: urllib.request.urlopen(url, timeout=30).read())

    async def usage(self) -> dict:
        self._sdk()
        import cloudinary.api

        raw = await asyncio.to_thread(cloudinary.api.usage)
        storage = raw.get("storage", {}) or {}
        return {"used_bytes": int(storage.get("usage", 0) or 0), "plan": raw.get("plan"),
                "note": "Account-wide usage reported by Cloudinary"}
