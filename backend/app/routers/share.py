import html
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse

from app.database import db
from app.deps import get_current_user
from app.schemas.share import SharePublicOut, ShareIn, ShareOut
from app.services.notify import notify
from app.services.photo_service import _urls
from app.utils.ids import now, oid, oids

router = APIRouter(prefix="/share", tags=["Sharing"])
public_page = APIRouter(tags=["Sharing"])  # /s/{token} -> a simple HTML gallery anyone can open


def _is_expired(share: dict) -> bool:
    return bool(share.get("expires_at")) and share["expires_at"] <= now()


async def _share_photos(share: dict, limit: int = 500) -> list[dict]:
    if share["kind"] == "album":
        flt = {"user_id": share["user_id"], "album_id": share["album_id"], "deleted": False}
    else:
        flt = {"_id": {"$in": share["photo_ids"]}, "user_id": share["user_id"], "deleted": False}
    return await db.photos.find(flt).sort([("taken_at", -1), ("_id", -1)]).to_list(limit)


async def _share_title(share: dict, count: int) -> str:
    if share["kind"] == "album":
        album = await db.albums.find_one({"_id": share["album_id"]}, {"name": 1})
        return album["name"] if album else "Album"
    return "1 photo" if count == 1 else f"{count} photos"


async def _out(share: dict) -> dict:
    count = (await db.photos.count_documents({"user_id": share["user_id"], "album_id": share["album_id"], "deleted": False})
             if share["kind"] == "album" else len(share["photo_ids"]))
    return {"id": str(share["_id"]), "token": share["token"], "path": f"/s/{share['token']}", "kind": share["kind"],
            "title": await _share_title(share, count), "count": count, "views": share.get("views", 0),
            "expires_at": share.get("expires_at"), "expired": _is_expired(share), "created_at": share["created_at"]}


@router.post("", response_model=ShareOut, status_code=201, summary="Create a share link")
async def create_share(body: ShareIn, user: dict = Depends(get_current_user)):
    doc = {"user_id": user["_id"], "token": secrets.token_urlsafe(12), "kind": body.kind, "photo_ids": [],
           "album_id": None, "views": 0, "created_at": now(), "last_notified_at": None,
           "expires_at": now() + timedelta(days=body.expires_in_days) if body.expires_in_days else None}
    if body.kind == "album":
        if not body.album_id:
            raise HTTPException(422, "album_id is required for kind=album")
        album_id = oid(body.album_id, "album id")
        if not await db.albums.find_one({"_id": album_id, "user_id": user["_id"]}):
            raise HTTPException(404, "Album not found")
        doc["album_id"] = album_id
    else:
        ids = oids(body.photo_ids)
        if not ids:
            raise HTTPException(422, "photo_ids is required")
        owned = await db.photos.distinct("_id", {"_id": {"$in": ids}, "user_id": user["_id"]})
        if not owned:
            raise HTTPException(404, "Photos not found")
        doc["photo_ids"] = owned
    doc["_id"] = (await db.shares.insert_one(doc)).inserted_id
    return await _out(doc)


@router.get("", response_model=list[ShareOut], summary="Links I created")
async def list_shares(user: dict = Depends(get_current_user)):
    shares = await db.shares.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(500)
    return [await _out(s) for s in shares]


@router.delete("/{share_id}", status_code=204, summary="Revoke a share link")
async def revoke_share(share_id: str, user: dict = Depends(get_current_user)):
    res = await db.shares.delete_one({"_id": oid(share_id, "share id"), "user_id": user["_id"]})
    if not res.deleted_count:
        raise HTTPException(404, "Share not found")


async def _load_public(token: str) -> tuple[dict, list[dict], dict]:
    share = await db.shares.find_one({"token": token})
    if not share:
        raise HTTPException(404, "This link does not exist or was revoked")
    if _is_expired(share):
        raise HTTPException(410, "This link has expired")
    owner = await db.users.find_one({"_id": share["user_id"]}, {"name": 1}) or {"name": "Someone"}
    photos = await _share_photos(share)
    await db.shares.update_one({"_id": share["_id"]}, {"$inc": {"views": 1}})
    last = share.get("last_notified_at")
    if not last or last < now() - timedelta(hours=1):  # at most 1 notification / hour / link
        await db.shares.update_one({"_id": share["_id"]}, {"$set": {"last_notified_at": now()}})
        await notify(share["user_id"], "share_viewed", "Your shared link was opened",
                     f"\"{await _share_title(share, len(photos))}\" was viewed.")
    return share, photos, owner


@router.get("/{token}", response_model=SharePublicOut, summary="Public: open a shared link (no login needed)")
async def open_share(token: str):
    share, photos, owner = await _load_public(token)
    items = []
    for p in photos:
        url, thumb = _urls(p)
        items.append({"id": str(p["_id"]), "name": p["name"], "url": url, "thumb_url": thumb,
                      "width": p.get("width"), "height": p.get("height")})
    return {"title": await _share_title(share, len(photos)), "owner": owner["name"],
            "expires_at": share.get("expires_at"), "photos": items}


@public_page.get("/s/{token}", response_class=HTMLResponse, summary="Public HTML page for a share link",
                 include_in_schema=False)
async def share_page(token: str, request: Request):
    base = str(request.base_url).rstrip("/")
    try:
        share, photos, owner = await _load_public(token)
    except HTTPException as e:
        return HTMLResponse(f"<h2 style='font-family:sans-serif;text-align:center;margin-top:20vh'>{html.escape(str(e.detail))}</h2>",
                            status_code=e.status_code)
    cells = []
    for p in photos:
        url, thumb = _urls(p)
        # local files are relative (/files/...) -> make them absolute
        if url.startswith("/"):
            url, thumb = base + url, base + thumb
        cells.append(f"<a href='{html.escape(url)}' target='_blank'><img loading='lazy' src='{html.escape(thumb)}' "
                     f"alt='{html.escape(p['name'])}'></a>")
    title = html.escape(await _share_title(share, len(photos)))
    page = f"""<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>{title} - CloudGallery</title><style>
body{{margin:0;font-family:system-ui,sans-serif;background:#0f1115;color:#e8eaed}}
header{{padding:20px 24px}} h1{{margin:0;font-size:22px}} p{{margin:4px 0 0;color:#9aa0a6;font-size:14px}}
main{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px;padding:0 24px 24px}}
img{{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block}}</style></head>
<body><header><h1>{title}</h1><p>Shared by {html.escape(owner['name'])} via CloudGallery</p></header>
<main>{''.join(cells)}</main></body></html>"""
    return HTMLResponse(page)
