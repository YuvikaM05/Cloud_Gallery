"""All photo business logic: ingest uploads, serialise documents, purge from storage."""
import asyncio
import logging
import re
from datetime import timedelta

from fastapi import HTTPException, UploadFile

from app.core.config import get_settings
from app.database import db
from app.deps import user_settings
from app.services.image_service import InvalidImage, process_image
from app.services.storage import ProviderNotConfigured, get_provider
from app.utils.files import sanitize_filename
from app.utils.ids import now

log = logging.getLogger("cloudgallery.photos")

SORTS = {
    "date-new": [("taken_at", -1), ("_id", -1)],
    "date-old": [("taken_at", 1), ("_id", 1)],
    "name-asc": [("name", 1), ("_id", 1)],
    "name-desc": [("name", -1), ("_id", -1)],
    "size-large": [("size", -1), ("_id", -1)],
    "size-small": [("size", 1), ("_id", 1)],
}


# ----------------------------------------------------------------- serialising
def _urls(doc: dict) -> tuple[str, str]:
    try:
        p = get_provider(doc.get("provider", "local"))
        return p.get_url(doc["key"]), p.get_thumbnail_url(doc["key"], doc.get("thumb_key"))
    except (ProviderNotConfigured, ValueError):
        return "", ""


def thumb_url(doc: dict) -> str | None:
    return _urls(doc)[1] or None


def photo_out(doc: dict, bin_days: int = 30, album_name: str | None = None) -> dict:
    url, thumb = _urls(doc)
    days_left = None
    if doc.get("deleted") and doc.get("deleted_at"):
        days_left = max(0, bin_days - (now() - doc["deleted_at"]).days)
    return {
        "id": str(doc["_id"]), "name": doc["name"], "url": url, "thumb_url": thumb,
        "size": doc.get("size", 0), "mime": doc.get("mime", "image/jpeg"),
        "width": doc.get("width"), "height": doc.get("height"), "exif": doc.get("exif") or {},
        "hash": doc.get("hash"), "favorite": doc.get("favorite", False), "deleted": doc.get("deleted", False),
        "deleted_at": doc.get("deleted_at"), "days_left": days_left,
        "album_id": str(doc["album_id"]) if doc.get("album_id") else None, "album_name": album_name,
        "tags": doc.get("tags") or [], "taken_at": doc.get("taken_at") or doc.get("created_at"),
        "created_at": doc["created_at"], "provider": doc.get("provider", "local"),
        "is_duplicate": doc.get("is_duplicate", False),
    }


# ----------------------------------------------------------------- queries
async def build_filter(user: dict, favorite: bool | None, deleted: bool, album_id, q: str | None) -> dict:
    flt: dict = {"user_id": user["_id"], "deleted": deleted}
    if favorite is not None:
        flt["favorite"] = favorite
    if album_id is not None:
        flt["album_id"] = album_id
    if q and q.strip():
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        album_ids = [a["_id"] async for a in db.albums.find({"user_id": user["_id"], "name": pattern}, {"_id": 1})]
        flt["$or"] = [{"name": pattern}, {"tags": pattern}] + ([{"album_id": {"$in": album_ids}}] if album_ids else [])
    return flt


async def storage_used(user_id) -> int:
    rows = await db.photos.aggregate([{"$match": {"user_id": user_id}},
                                      {"$group": {"_id": None, "bytes": {"$sum": "$size"}}}]).to_list(1)
    return rows[0]["bytes"] if rows else 0


# ----------------------------------------------------------------- ingest
async def read_limited(file: UploadFile, limit: int) -> bytes:
    chunks, total = [], 0
    while chunk := await file.read(1024 * 1024):
        total += len(chunk)
        if total > limit:
            raise HTTPException(413, f"File is larger than {limit // (1024 * 1024)} MB")
        chunks.append(chunk)
    return b"".join(chunks)


async def ingest_bytes(user: dict, raw: bytes, filename: str, compress: bool, existing_key: str | None = None) -> dict:
    """Validate -> process -> store original + thumbnail -> insert Mongo document."""
    s = get_settings()
    if len(raw) > s.max_upload_bytes:
        raise HTTPException(413, f"File is larger than {s.MAX_UPLOAD_MB} MB")
    try:
        processed = await asyncio.to_thread(process_image, raw, compress)
    except InvalidImage as e:
        raise HTTPException(415, str(e))

    used = await storage_used(user["_id"])
    if used + len(processed.data) > s.quota_bytes:
        raise HTTPException(507, "Storage quota exceeded. Delete some photos or empty the bin.")

    provider_name = user_settings(user)["storage_provider"]
    try:
        provider = get_provider(provider_name)
    except (ProviderNotConfigured, ValueError) as e:
        raise HTTPException(503, str(e))

    uid = str(user["_id"])
    if existing_key:                      # direct-to-bucket upload: original is already stored
        key = existing_key
    else:
        key = provider.make_key(uid, processed.ext)
        await provider.upload(key, processed.data, processed.mime)

    thumb_key = None
    if not provider.supports_transforms:  # Cloudinary makes thumbs itself
        thumb_key = f"{uid}/thumbs/{key.rsplit('/', 1)[-1].rsplit('.', 1)[0]}.jpg"
        await provider.upload(thumb_key, processed.thumb, "image/jpeg")

    duplicate = await db.photos.find_one({"user_id": user["_id"], "hash": processed.sha256, "deleted": False}, {"_id": 1})
    created = now()
    doc = {
        "user_id": user["_id"], "name": sanitize_filename(filename), "key": key, "thumb_key": thumb_key,
        "provider": provider.name, "size": len(raw) if existing_key else len(processed.data), "mime": processed.mime,
        "width": processed.width, "height": processed.height, "exif": processed.exif, "hash": processed.sha256,
        "favorite": False, "deleted": False, "deleted_at": None, "album_id": None, "tags": [],
        "taken_at": processed.taken_at or created, "created_at": created, "is_duplicate": bool(duplicate),
    }
    result = await db.photos.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


# ----------------------------------------------------------------- purge
async def purge_photos(docs: list[dict]) -> int:
    """Remove files from the storage provider, then the documents. Used by 'delete forever' and auto-purge."""
    if not docs:
        return 0
    for d in docs:
        try:
            provider = get_provider(d.get("provider", "local"))
            await provider.delete(d["key"])
            if d.get("thumb_key"):
                await provider.delete(d["thumb_key"])
        except Exception as e:  # keep going: a missing file must not block deleting the record
            log.warning("could not delete %s from storage: %s", d.get("key"), e)
    ids = [d["_id"] for d in docs]
    res = await db.photos.delete_many({"_id": {"$in": ids}})
    await db.albums.update_many({"cover_photo_id": {"$in": ids}}, {"$set": {"cover_photo_id": None}})
    return res.deleted_count


async def purge_expired_bin() -> int:
    """Scheduled job: permanently delete photos that have been in the bin longer than the user's bin_days."""
    total = 0
    user_ids = await db.photos.distinct("user_id", {"deleted": True})
    for uid in user_ids:
        user = await db.users.find_one({"_id": uid})
        if not user:
            continue
        days = user_settings(user)["bin_days"]
        cutoff = now() - timedelta(days=days)
        docs = await db.photos.find({"user_id": uid, "deleted": True, "deleted_at": {"$lte": cutoff}}).to_list(5000)
        total += await purge_photos(docs)
    if total:
        log.info("auto-purge removed %s photos from bins", total)
    return total


async def warn_expiring_bin() -> None:
    """Scheduled job: tell users when binned photos will vanish within 3 days (once per day)."""
    from app.services.notify import notify

    user_ids = await db.photos.distinct("user_id", {"deleted": True})
    for uid in user_ids:
        user = await db.users.find_one({"_id": uid})
        if not user:
            continue
        days = user_settings(user)["bin_days"]
        soon = now() - timedelta(days=max(days - 3, 0))
        n = await db.photos.count_documents({"user_id": uid, "deleted": True, "deleted_at": {"$lte": soon}})
        if not n:
            continue
        since = now() - timedelta(hours=20)
        if await db.notifications.find_one({"user_id": uid, "kind": "bin_warning", "created_at": {"$gte": since}}):
            continue
        await notify(uid, "bin_warning", "Bin is about to be emptied",
                     f"{n} photo{'s' if n != 1 else ''} will be deleted forever within 3 days.")
