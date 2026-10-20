from fastapi import APIRouter, Depends

from app.database import db
from app.deps import get_current_user
from app.services.photo_service import purge_photos

router = APIRouter(prefix="/bin", tags=["Bin"])


@router.delete("", summary="Empty the bin (delete all binned photos forever)")
async def empty_bin(user: dict = Depends(get_current_user)):
    docs = await db.photos.find({"user_id": user["_id"], "deleted": True}).to_list(20000)
    return {"deleted": await purge_photos(docs)}
