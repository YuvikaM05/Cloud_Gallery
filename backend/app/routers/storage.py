import uuid
from pathlib import PurePosixPath

from fastapi import APIRouter, Depends, HTTPException

from app.core.config import get_settings
from app.database import db
from app.deps import get_current_user, user_settings
from app.schemas.misc import ProviderSwitch, StorageSummary
from app.schemas.photo import PresignIn, PresignOut
from app.services.storage import ProviderNotConfigured, get_provider, provider_infos
from app.utils.files import sanitize_filename

router = APIRouter(prefix="/storage", tags=["Storage"])


def _label(mime: str) -> str:
    return {"image/jpeg": "JPEG", "image/png": "PNG", "image/gif": "GIF", "image/webp": "WebP", "image/bmp": "BMP"}.get(mime, mime)


@router.get("/summary", response_model=StorageSummary, summary="Quota, usage and available providers")
async def summary(include_provider: bool = False, user: dict = Depends(get_current_user)):
    s = get_settings()
    active = user_settings(user)["storage_provider"]
    by_type = [{"type": _label(r["_id"]), "count": r["count"], "bytes": r["bytes"]} async for r in db.photos.aggregate([
        {"$match": {"user_id": user["_id"]}},
        {"$group": {"_id": "$mime", "count": {"$sum": 1}, "bytes": {"$sum": "$size"}}}, {"$sort": {"bytes": -1}}])]
    used = sum(t["bytes"] for t in by_type)
    count = sum(t["count"] for t in by_type)
    bin_rows = await db.photos.aggregate([{"$match": {"user_id": user["_id"], "deleted": True}},
                                          {"$group": {"_id": None, "bytes": {"$sum": "$size"}}}]).to_list(1)
    provider_usage = None
    if include_provider:
        try:
            provider_usage = await get_provider(active).usage()
        except Exception as e:  # network/credential problems must not break the page
            provider_usage = {"error": str(e)}
    provider_ok = True
    try:
        provider_ok = get_provider(active).supports_presign
    except Exception:
        provider_ok = False
    return {"provider": active, "used_bytes": used, "quota_bytes": s.quota_bytes,
            "free_bytes": max(0, s.quota_bytes - used), "photo_count": count,
            "bin_bytes": bin_rows[0]["bytes"] if bin_rows else 0, "by_type": by_type,
            "providers": provider_infos(active), "direct_upload": provider_ok, "provider_usage": provider_usage}


@router.post("/provider", summary="Switch the storage provider used for NEW uploads")
async def switch_provider(body: ProviderSwitch, user: dict = Depends(get_current_user)):
    try:
        get_provider(body.provider)
    except ProviderNotConfigured as e:
        raise HTTPException(400, str(e))
    except ValueError as e:
        raise HTTPException(404, str(e))
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"settings.storage_provider": body.provider}})
    return {"provider": body.provider}


@router.post("/presign", response_model=PresignOut, summary="Get a presigned URL so the browser uploads straight to S3/R2")
async def presign(body: PresignIn, user: dict = Depends(get_current_user)):
    provider = get_provider(user_settings(user)["storage_provider"])
    if not provider.supports_presign:
        raise HTTPException(400, f"{provider.label} does not support direct uploads")
    if not body.content_type.startswith("image/"):
        raise HTTPException(415, "Only images can be uploaded")
    ext = PurePosixPath(sanitize_filename(body.filename)).suffix.lower() or ".jpg"
    key = f"{user['_id']}/{uuid.uuid4().hex}{ext}"
    url = provider.presign_put(key, body.content_type)
    return {"upload_url": url, "method": "PUT", "headers": {"Content-Type": body.content_type}, "key": key}
