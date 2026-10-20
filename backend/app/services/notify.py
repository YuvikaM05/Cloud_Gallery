from app.database import db
from app.utils.ids import now


async def notify(user_id, kind: str, title: str, body: str = "") -> None:
    await db.notifications.insert_one({"user_id": user_id, "kind": kind, "title": title, "body": body,
                                       "read": False, "created_at": now()})
