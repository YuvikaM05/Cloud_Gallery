import asyncio
from pathlib import Path

from app.core.config import UPLOAD_DIR
from app.services.storage.base import StorageProvider


class LocalStorageProvider(StorageProvider):
    name = "local"
    label = "Local disk"
    description = "Files are saved in backend/uploads on this computer. Free, zero setup - perfect for development."
    env_vars: list[str] = []

    def __init__(self) -> None:
        self.root = Path(UPLOAD_DIR).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if self.root not in p.parents:  # blocks "../../etc/passwd" style keys
            raise ValueError("Invalid storage key")
        return p

    async def upload(self, key: str, data: bytes, content_type: str) -> None:
        p = self._path(key)

        def _write() -> None:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)

        await asyncio.to_thread(_write)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(lambda: self._path(key).unlink(missing_ok=True))

    async def read(self, key: str) -> bytes:
        return await asyncio.to_thread(self._path(key).read_bytes)

    def get_url(self, key: str) -> str:
        return f"/files/{key}"  # served by StaticFiles in main.py (frontend prefixes the API origin)

    async def usage(self) -> dict:
        def _sum() -> int:
            return sum(f.stat().st_size for f in self.root.rglob("*") if f.is_file())

        return {"used_bytes": await asyncio.to_thread(_sum), "note": "Size of backend/uploads"}
