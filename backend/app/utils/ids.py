from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException


def oid(value: str, label: str = "id") -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail=f"Invalid {label}")


def oids(values: list[str]) -> list[ObjectId]:
    return [oid(v) for v in values]


def now() -> datetime:
    return datetime.now(timezone.utc)
