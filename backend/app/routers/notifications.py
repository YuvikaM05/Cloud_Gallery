from fastapi import APIRouter, Depends

from app.database import db
from app.deps import get_current_user
from app.schemas.misc import NotificationIn, NotificationList
from app.services.notify import notify

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationList, summary="Latest notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    docs = await db.notifications.find({"user_id": user["_id"]}).sort("created_at", -1).limit(30).to_list(30)
    unread = await db.notifications.count_documents({"user_id": user["_id"], "read": False})
    items = [{"id": str(d["_id"]), "kind": d["kind"], "title": d["title"], "body": d.get("body", ""),
              "read": d["read"], "created_at": d["created_at"]} for d in docs]
    return {"items": items, "unread": unread}


@router.post("", status_code=201, summary="Create a notification (used by the app after an upload batch)")
async def create_notification(body: NotificationIn, user: dict = Depends(get_current_user)):
    await notify(user["_id"], body.kind, body.title, body.body)
    return {"ok": True}


@router.post("/read-all", summary="Mark everything as read")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["_id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}
