import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from app.core.security import create_access_token, hash_password, verify_password
from app.database import db
from app.deps import get_current_user, user_settings
from app.schemas.auth import LoginIn, RegisterIn, TokenOut, UserOut, UserUpdate
from app.utils.ids import now
from app.utils.ratelimit import auth_rate_limit

router = APIRouter(prefix="/auth", tags=["Auth"])


def user_out(doc: dict) -> dict:
    return {"id": str(doc["_id"]), "name": doc["name"], "email": doc["email"],
            "settings": user_settings(doc), "created_at": doc.get("created_at")}


def token_out(doc: dict) -> dict:
    return {"access_token": create_access_token(str(doc["_id"])), "token_type": "bearer", "user": user_out(doc)}


@router.post("/register", response_model=TokenOut, status_code=201, summary="Create an account",
             dependencies=[Depends(auth_rate_limit)])
async def register(body: RegisterIn):
    if await db.users.find_one({"email": body.email}):
        raise HTTPException(409, "An account with this email already exists")
    pw = await asyncio.to_thread(hash_password, body.password)  # scrypt is CPU heavy -> keep it off the event loop
    doc = {"name": body.name.strip(), "email": body.email, "password": pw, "settings": {}, "created_at": now()}
    try:
        doc["_id"] = (await db.users.insert_one(doc)).inserted_id
    except DuplicateKeyError:
        raise HTTPException(409, "An account with this email already exists")
    return token_out(doc)


@router.post("/login", response_model=TokenOut, summary="Log in and get a JWT", dependencies=[Depends(auth_rate_limit)])
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.strip().lower()})
    ok = bool(user) and await asyncio.to_thread(verify_password, body.password, user["password"])
    if not ok:
        raise HTTPException(401, "Incorrect email or password")
    return token_out(user)


@router.get("/me", response_model=UserOut, summary="Current user + settings")
async def me(user: dict = Depends(get_current_user)):
    return user_out(user)


@router.patch("/me", response_model=UserOut, summary="Update name and/or settings")
async def update_me(body: UserUpdate, user: dict = Depends(get_current_user)):
    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.settings is not None:
        for k, v in body.settings.model_dump(exclude_none=True).items():
            updates[f"settings.{k}"] = v
    if updates:
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
        user = await db.users.find_one({"_id": user["_id"]})
    return user_out(user)
