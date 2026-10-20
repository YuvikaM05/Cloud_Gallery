import io
import zipfile
import asyncio

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from app.core.config import get_settings
from app.database import db
from app.deps import get_current_user, user_settings
from app.schemas.photo import (BulkIn, BulkOut, PhotoIds, PhotoOut, PhotoPage, PhotoPatch, PresignIn, PresignOut,
                               RegisterIn, SortKey, UploadOut, ZipIn)
from app.services.photo_service import (SORTS, build_filter, ingest_bytes, photo_out, purge_photos, read_limited)
from app.services.storage import ProviderNotConfigured, get_provider
from app.utils.files import content_disposition, sanitize_filename, unique_name
from app.utils.ids import now, oid, oids

router = APIRouter(prefix="/photos", tags=["Photos"])


async def _album_name(user_id, album_id) -> str | None:
    if not album_id:
        return None
    a = await db.albums.find_one({"_id": album_id, "user_id": user_id}, {"name": 1})
    return a["name"] if a else None


async def _owned(user: dict, photo_id: str) -> dict:
    doc = await db.photos.find_one({"_id": oid(photo_id, "photo id"), "user_id": user["_id"]})
    if not doc:
        raise HTTPException(404, "Photo not found")
    return doc


@router.post("/upload", response_model=UploadOut, status_code=201, summary="Upload one or many photos")
async def upload_photos(files: list[UploadFile] = File(...), compress: bool | None = Form(None),
                        user: dict = Depends(get_current_user)):
    """Images are validated by content, thumbnailed, stored with the active storage provider and saved in MongoDB."""
    s = get_settings()
    flag = compress if compress is not None else user_settings(user)["upload_quality"] == "compressed"
    items, rejected = [], []
    for f in files:
        try:
            raw = await read_limited(f, s.max_upload_bytes)
            doc = await ingest_bytes(user, raw, f.filename or "photo", flag)
            items.append(photo_out(doc, user_settings(user)["bin_days"]))
        except HTTPException as e:
            rejected.append({"name": f.filename or "file", "reason": str(e.detail)})
    if not items and rejected:
        raise HTTPException(rejected_status(rejected), rejected[0]["reason"])
    return {"items": items, "rejected": rejected}


def rejected_status(rejected) -> int:
    reason = rejected[0]["reason"].lower()
    if "larger" in reason:
        return 413
    if "quota" in reason:
        return 507
    if "not a valid" in reason or "unsupported" in reason:
        return 415
    return 400


@router.post("/register", response_model=PhotoOut, status_code=201,
             summary="Finish a direct-to-bucket upload (after using /storage/presign)")
async def register_direct_upload(body: RegisterIn, user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    if not body.key.startswith(f"{uid}/") or ".." in body.key:
        raise HTTPException(403, "Key does not belong to you")
    provider = get_provider(user_settings(user)["storage_provider"])
    try:
        raw = await provider.read(body.key)
    except Exception:
        raise HTTPException(404, "Uploaded object not found in the bucket")
    try:
        doc = await ingest_bytes(user, raw, body.name, compress=False, existing_key=body.key)
    except HTTPException:
        await provider.delete(body.key)  # don't leave rejected files lying in the bucket
        raise
    return photo_out(doc, user_settings(user)["bin_days"])


@router.get("", response_model=PhotoPage, summary="List photos (filter, search, sort, paginate)")
async def list_photos(favorite: bool | None = None, deleted: bool = False, album_id: str | None = None,
                      q: str | None = Query(None, description="Search name, tags and album names"),
                      sort: SortKey = "date-new", page: int = Query(1, ge=1), limit: int = Query(60, ge=1, le=200),
                      user: dict = Depends(get_current_user)):
    flt = await build_filter(user, favorite, deleted, oid(album_id, "album id") if album_id else None, q)
    total = await db.photos.count_documents(flt)
    kwargs = {"collation": {"locale": "en", "strength": 2}} if sort.startswith("name") else {}
    cursor = db.photos.find(flt, **kwargs).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit)
    bin_days = user_settings(user)["bin_days"]
    items = [photo_out(d, bin_days) async for d in cursor]
    return {"items": items, "total": total, "page": page, "limit": limit, "has_more": page * limit < total}


@router.get("/ids", response_model=PhotoIds, summary="All ids matching a filter (powers 'Select all')")
async def list_ids(favorite: bool | None = None, deleted: bool = False, album_id: str | None = None,
                   q: str | None = None, user: dict = Depends(get_current_user)):
    flt = await build_filter(user, favorite, deleted, oid(album_id, "album id") if album_id else None, q)
    ids = [str(d["_id"]) async for d in db.photos.find(flt, {"_id": 1}).limit(20000)]
    return {"ids": ids, "total": len(ids)}


@router.post("/bulk", response_model=BulkOut, summary="Apply ONE action to MANY photos in a single request")
async def bulk(body: BulkIn, user: dict = Depends(get_current_user)):
    ids = oids(body.ids)
    base = {"_id": {"$in": ids}, "user_id": user["_id"]}
    action = body.action
    matched = await db.photos.count_documents(base)

    if action in ("favorite", "unfavorite"):
        res = await db.photos.update_many({**base, "deleted": False}, {"$set": {"favorite": action == "favorite"}})
        return {"matched": matched, "modified": res.modified_count}
    if action == "delete":
        res = await db.photos.update_many({**base, "deleted": False}, {"$set": {"deleted": True, "deleted_at": now()}})
        return {"matched": matched, "modified": res.modified_count}
    if action == "restore":
        res = await db.photos.update_many({**base, "deleted": True}, {"$set": {"deleted": False, "deleted_at": None}})
        return {"matched": matched, "modified": res.modified_count}
    if action == "delete_forever":
        docs = await db.photos.find({**base, "deleted": True}).to_list(5000)
        return {"matched": matched, "modified": await purge_photos(docs)}
    if action == "remove_from_album":
        res = await db.photos.update_many(base, {"$set": {"album_id": None}})
        return {"matched": matched, "modified": res.modified_count}
    if action == "move":
        if not body.album_id:
            raise HTTPException(422, "album_id is required for action=move")
        album_id = oid(body.album_id, "album id")
        if not await db.albums.find_one({"_id": album_id, "user_id": user["_id"]}):
            raise HTTPException(404, "Album not found")
        res = await db.photos.update_many({**base, "deleted": False}, {"$set": {"album_id": album_id}})
        return {"matched": matched, "modified": res.modified_count}
    raise HTTPException(400, "Unknown action")


@router.post("/download-zip", summary="Download many photos as one ZIP")
async def download_zip(body: ZipIn, user: dict = Depends(get_current_user)):
    docs = await db.photos.find({"_id": {"$in": oids(body.ids)}, "user_id": user["_id"]}).to_list(500)
    if not docs:
        raise HTTPException(404, "No photos found")
    buf, used = io.BytesIO(), set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as zf:  # images are already compressed -> STORED is fastest
        for d in docs:
            data = await get_provider(d["provider"]).read(d["key"])
            zf.writestr(unique_name(d["name"], used), data)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip",
                             headers={"Content-Disposition": content_disposition("cloudgallery-photos.zip")})


@router.get("/{photo_id}", response_model=PhotoOut, summary="One photo with full details")
async def get_photo(photo_id: str, user: dict = Depends(get_current_user)):
    doc = await _owned(user, photo_id)
    return photo_out(doc, user_settings(user)["bin_days"], await _album_name(user["_id"], doc.get("album_id")))


@router.patch("/{photo_id}", response_model=PhotoOut, summary="Rename, (un)favourite, tag")
async def patch_photo(photo_id: str, body: PhotoPatch, user: dict = Depends(get_current_user)):
    doc = await _owned(user, photo_id)
    updates = {}
    if body.name is not None:
        updates["name"] = sanitize_filename(body.name, doc["name"])
    if body.favorite is not None:
        updates["favorite"] = body.favorite
    if body.tags is not None:
        updates["tags"] = [t.strip()[:30] for t in body.tags if t.strip()][:20]
    if updates:
        await db.photos.update_one({"_id": doc["_id"]}, {"$set": updates})
        doc.update(updates)
    return photo_out(doc, user_settings(user)["bin_days"], await _album_name(user["_id"], doc.get("album_id")))


@router.get("/{photo_id}/download", summary="Download the original file")
async def download_photo(photo_id: str, user: dict = Depends(get_current_user)):
    doc = await _owned(user, photo_id)
    try:
        data = await get_provider(doc["provider"]).read(doc["key"])
    except ProviderNotConfigured as e:
        raise HTTPException(503, str(e))
    return StreamingResponse(io.BytesIO(data), media_type=doc["mime"],
                             headers={"Content-Disposition": content_disposition(doc["name"])})
