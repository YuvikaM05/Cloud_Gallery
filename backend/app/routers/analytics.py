from datetime import datetime

from fastapi import APIRouter, Depends

from app.database import db
from app.deps import get_current_user
from app.services.photo_service import photo_out, thumb_url
from app.utils.ids import now

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _month_range(n: int = 12) -> list[str]:
    d = now()
    y, m = d.year, d.month
    out = []
    for _ in range(n):
        out.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(out))


async def _by_month(uid) -> dict[str, dict]:
    rows = db.photos.aggregate([
        {"$match": {"user_id": uid, "deleted": False}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}},
                    "count": {"$sum": 1}, "bytes": {"$sum": "$size"}}}])
    return {r["_id"]: r async for r in rows}


@router.get("/overview", summary="Headline numbers")
async def overview(user: dict = Depends(get_current_user)):
    uid = user["_id"]
    live = {"user_id": uid, "deleted": False}
    sizes = await db.photos.aggregate([
        {"$match": {"user_id": uid}},
        {"$group": {"_id": "$deleted", "count": {"$sum": 1}, "bytes": {"$sum": "$size"}}}]).to_list(2)
    by_deleted = {r["_id"]: r for r in sizes}
    dup = await db.photos.aggregate([
        {"$match": live}, {"$group": {"_id": "$hash", "n": {"$sum": 1}, "size": {"$first": "$size"}}},
        {"$match": {"n": {"$gt": 1}}},
        {"$group": {"_id": None, "groups": {"$sum": 1}, "wasted": {"$sum": {"$multiply": [{"$subtract": ["$n", 1]}, "$size"]}}}},
    ]).to_list(1)
    live_row = by_deleted.get(False, {"count": 0, "bytes": 0})
    return {
        "photos": live_row["count"], "live_bytes": live_row["bytes"],
        "bin_photos": by_deleted.get(True, {}).get("count", 0), "bin_bytes": by_deleted.get(True, {}).get("bytes", 0),
        "favorites": await db.photos.count_documents({**live, "favorite": True}),
        "albums": await db.albums.count_documents({"user_id": uid}),
        "active_shares": await db.shares.count_documents(
            {"user_id": uid, "$or": [{"expires_at": None}, {"expires_at": {"$gt": now()}}]}),
        "avg_size": int(live_row["bytes"] / live_row["count"]) if live_row["count"] else 0,
        "duplicate_groups": dup[0]["groups"] if dup else 0, "duplicate_bytes": dup[0]["wasted"] if dup else 0,
    }


@router.get("/uploads-by-month", summary="Uploads per month (last 12 months)")
async def uploads_by_month(user: dict = Depends(get_current_user)):
    data = await _by_month(user["_id"])
    return [{"month": m, "count": data.get(m, {}).get("count", 0), "bytes": data.get(m, {}).get("bytes", 0)}
            for m in _month_range()]


@router.get("/storage-over-time", summary="Cumulative storage used per month")
async def storage_over_time(user: dict = Depends(get_current_user)):
    data = await _by_month(user["_id"])
    window = _month_range()
    running = sum(v["bytes"] for k, v in data.items() if k < window[0])
    out = []
    for m in window:
        running += data.get(m, {}).get("bytes", 0)
        out.append({"month": m, "bytes": running})
    return out


@router.get("/by-type", summary="Files by image type")
async def by_type(user: dict = Depends(get_current_user)):
    rows = db.photos.aggregate([
        {"$match": {"user_id": user["_id"], "deleted": False}},
        {"$group": {"_id": "$mime", "count": {"$sum": 1}, "bytes": {"$sum": "$size"}}}, {"$sort": {"bytes": -1}}])
    return [{"type": r["_id"].split("/")[-1].upper(), "count": r["count"], "bytes": r["bytes"]} async for r in rows]


@router.get("/albums", summary="Storage used per album")
async def album_sizes(user: dict = Depends(get_current_user)):
    albums = {a["_id"]: a["name"] async for a in db.albums.find({"user_id": user["_id"]}, {"name": 1})}
    rows = db.photos.aggregate([
        {"$match": {"user_id": user["_id"], "deleted": False}},
        {"$group": {"_id": "$album_id", "count": {"$sum": 1}, "bytes": {"$sum": "$size"}}}, {"$sort": {"bytes": -1}}])
    return [{"album": albums.get(r["_id"], "No album") if r["_id"] else "No album", "count": r["count"], "bytes": r["bytes"]}
            async for r in rows]


@router.get("/suggestions", summary="Ways to free up space: duplicates and the biggest files")
async def suggestions(user: dict = Depends(get_current_user)):
    live = {"user_id": user["_id"], "deleted": False}
    groups = []
    async for g in db.photos.aggregate([
        {"$match": live},
        {"$group": {"_id": "$hash", "n": {"$sum": 1}, "items": {"$push": "$$ROOT"}}},
        {"$match": {"n": {"$gt": 1}}},
        {"$addFields": {"wasted": {"$multiply": [{"$subtract": ["$n", 1]}, {"$first": "$items.size"}]}}},
        {"$sort": {"wasted": -1}}, {"$limit": 20}]):
        items = sorted(g["items"], key=lambda d: d["created_at"])
        groups.append({"hash": g["_id"], "wasted_bytes": g["wasted"], "photos": [photo_out(d) for d in items]})
    biggest = [photo_out(d) async for d in db.photos.find(live).sort("size", -1).limit(10)]
    return {"duplicates": groups, "largest": biggest}
