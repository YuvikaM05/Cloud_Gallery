"""Provider registry: get_provider("s3") returns a ready-to-use instance."""
from app.services.storage.base import ProviderNotConfigured, StorageProvider
from app.services.storage.cloudinary_provider import CloudinaryProvider
from app.services.storage.local import LocalStorageProvider
from app.services.storage.s3 import S3Provider

_CLASSES: dict[str, type[StorageProvider]] = {
    "local": LocalStorageProvider,
    "cloudinary": CloudinaryProvider,
    "s3": S3Provider,
}
_instances: dict[str, StorageProvider] = {}


def get_provider(name: str) -> StorageProvider:
    if name not in _CLASSES:
        raise ValueError(f"Unknown storage provider: {name}")
    if name not in _instances:
        _instances[name] = _CLASSES[name]()
    provider = _instances[name]
    if not provider.is_configured():
        raise ProviderNotConfigured(f"{provider.label} is not configured. Add its keys to backend/.env")
    return provider


def provider_infos(active: str) -> list[dict]:
    infos = []
    for name, cls in _CLASSES.items():
        inst = _instances.setdefault(name, cls())
        infos.append({"id": name, "name": inst.label, "description": inst.description,
                      "configured": inst.is_configured(), "active": name == active, "env_vars": inst.env_vars})
    return infos


__all__ = ["get_provider", "provider_infos", "ProviderNotConfigured", "StorageProvider"]
