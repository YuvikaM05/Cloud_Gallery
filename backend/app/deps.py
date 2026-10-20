from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.core.security import decode_token
from app.database import db

bearer = HTTPBearer(auto_error=False)

DEFAULT_SETTINGS = {
    "theme": "system",
    "default_view": "medium",
    "default_sort": "date-new",
    "bin_days": 30,
    "upload_quality": "original",
    "storage_provider": None,
}


def user_settings(user: dict) -> dict:
    merged = {**DEFAULT_SETTINGS, **(user.get("settings") or {})}
    if not merged.get("storage_provider"):
        merged["storage_provider"] = get_settings().STORAGE_PROVIDER
    return merged


async def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    unauthorized = HTTPException(status_code=401, detail="Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise unauthorized
    uid = decode_token(creds.credentials)
    if not uid:
        raise unauthorized
    try:
        user = await db.users.find_one({"_id": ObjectId(uid)})
    except InvalidId:
        raise unauthorized
    if not user:
        raise unauthorized
    return user
