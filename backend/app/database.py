from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings

_s = get_settings()

# tz_aware=True -> every datetime we read back is timezone-aware (UTC)
client = AsyncIOMotorClient(_s.MONGODB_URI, tz_aware=True, serverSelectionTimeoutMS=8000)
db = client[_s.DATABASE_NAME]


async def init_indexes() -> None:
    """Indexes make queries fast. Creating an index that already exists is a no-op."""
    await db.users.create_index("email", unique=True)
    await db.photos.create_index([("user_id", 1), ("deleted", 1), ("created_at", -1)])
    await db.photos.create_index([("user_id", 1), ("deleted", 1), ("taken_at", -1)])
    await db.photos.create_index([("user_id", 1), ("album_id", 1)])
    await db.photos.create_index([("user_id", 1), ("hash", 1)])
    await db.photos.create_index([("name", "text"), ("tags", "text")], name="photo_text")
    await db.albums.create_index([("user_id", 1), ("name", 1)])
    await db.shares.create_index("token", unique=True)
    await db.shares.create_index([("user_id", 1), ("created_at", -1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
