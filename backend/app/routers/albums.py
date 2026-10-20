from fastapi import APIRouter, Depends, HTTPException

from app.database import db
from app.deps import get_current_user
from app.schemas.album import AlbumAddIn, AlbumIn, AlbumOut, AlbumPatch
from app.services.photo_service import thumb_url
from app.utils.ids import now, oid, oids

router = APIRouter(prefix="/albums", tags=["Albums"])


async def _owned(user: dict, album_id: str) -> dict:
    a = await db.albums.find_one({"_id": oid(album_id, "album id"), "user_id": user["_id"]})
    if not a:
        raise HTTPException(404, "Album not found")
    return a


async def _serialize(user_id, albums: list[dict]) -> list[dict]:
    if not albums:
        return []
    stats = {}
    async for row in db.photos.aggregate([
        {"$match": {"user_id": user_id, "deleted": False, "album_id": {"$in": [a["_id"] for a in albums]}}},
        {"$sort": {"taken_at": -1, "_id": -1}},
        {"$group": {"_id": "$album_id", "count": {"$sum": 1}, "size": {"$sum": "$size"},
                    "cover": {"$first": {"key": "$key", "thumb_key": "$thumb_key", "provider": "$provider", "id": "$_id"}}}},
    ]):
        stats[row["_id"]] = row
    pinned_ids = [a["cover_photo_id"] for a in albums if a.get("cover_photo_id")]
    pinned = {d["_id"]: d async for d in db.photos.find({"_id": {"$in": pinned_ids}, "deleted": False})} if pinned_ids else {}

    out = []
    for a in albums:
        st = stats.get(a["_id"], {})
        cover_doc = pinned.get(a.get("cover_photo_id")) or st.get("cover")
        out.append({
            "id": str(a["_id"]), "name": a["name"], "created_at": a["created_at"],
            "photo_count": st.get("count", 0), "total_size": st.get("size", 0),
            "cover_url": thumb_url(cover_doc) if cover_doc else None,
            "cover_photo_id": str(a["cover_photo_id"]) if a.get("cover_photo_id") else None,
        })
    return out


@router.get("", response_model=list[AlbumOut], summary="List my albums")
async def list_albums(user: dict = Depends(get_current_user)):
    albums = await db.albums.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(1000)
    return await _serialize(user["_id"], albums)


@router.post("", response_model=AlbumOut, status_code=201, summary="Create an album (optionally with photos)")
async def create_album(body: AlbumIn, user: dict = Depends(get_current_user)):
    name = body.name.strip()
    if await db.albums.find_one({"user_id": user["_id"], "name": name}):
        raise HTTPException(409, "You already have an album with this name")
    doc = {"user_id": user["_id"], "name": name, "cover_photo_id": None, "created_at": now()}
    doc["_id"] = (await db.albums.insert_one(doc)).inserted_id
    if body.photo_ids:
        await db.photos.update_many({"_id": {"$in": oids(body.photo_ids)}, "user_id": user["_id"], "deleted": False},
                                    {"$set": {"album_id": doc["_id"]}})
    return (await _serialize(user["_id"], [doc]))[0]


@router.get("/{album_id}", response_model=AlbumOut, summary="One album")
async def get_album(album_id: str, user: dict = Depends(get_current_user)):
    return (await _serialize(user["_id"], [await _owned(user, album_id)]))[0]


@router.patch("/{album_id}", response_model=AlbumOut, summary="Rename album / set cover photo")
async def patch_album(album_id: str, body: AlbumPatch, user: dict = Depends(get_current_user)):
    album = await _owned(user, album_id)
    updates = {}
    if body.name is not None:
        name = body.name.strip()
        if name != album["name"] and await db.albums.find_one({"user_id": user["_id"], "name": name}):
            raise HTTPException(409, "You already have an album with this name")
        updates["name"] = name
    if body.cover_photo_id is not None:
        pid = oid(body.cover_photo_id, "photo id")
        if not await db.photos.find_one({"_id": pid, "user_id": user["_id"], "album_id": album["_id"]}):
            raise HTTPException(400, "The cover photo must be inside this album")
        updates["cover_photo_id"] = pid
    if updates:
        await db.albums.update_one({"_id": album["_id"]}, {"$set": updates})
        album.update(updates)
    return (await _serialize(user["_id"], [album]))[0]


@router.delete("/{album_id}", status_code=204, summary="Delete an album (photos are kept)")
async def delete_album(album_id: str, user: dict = Depends(get_current_user)):
    album = await _owned(user, album_id)
    await db.photos.update_many({"user_id": user["_id"], "album_id": album["_id"]}, {"$set": {"album_id": None}})
    await db.albums.delete_one({"_id": album["_id"]})


@router.post("/{album_id}/photos", response_model=AlbumOut, summary="Add photos to an album")
async def add_photos(album_id: str, body: AlbumAddIn, user: dict = Depends(get_current_user)):
    album = await _owned(user, album_id)
    await db.photos.update_many({"_id": {"$in": oids(body.photo_ids)}, "user_id": user["_id"], "deleted": False},
                                {"$set": {"album_id": album["_id"]}})
    return (await _serialize(user["_id"], [album]))[0]
