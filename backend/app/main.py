import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import UPLOAD_DIR, get_settings
from app.database import client, init_indexes
from app.routers import albums, analytics, auth, bin as bin_router, notifications, photos, share, storage
from app.services.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s | %(message)s")
log = logging.getLogger("cloudgallery")
settings = get_settings()

TAGS = [
    {"name": "Auth", "description": "Register, log in and manage your profile/settings. Click **Authorize** (top right) and paste the token."},
    {"name": "Photos", "description": "Upload, list, search, bulk actions, download."},
    {"name": "Albums", "description": "Group photos into albums."},
    {"name": "Sharing", "description": "Public share links with optional expiry."},
    {"name": "Bin", "description": "Empty the bin. Binned photos are auto-purged after `bin_days`."},
    {"name": "Storage", "description": "Quota, providers (Local / Cloudinary / S3-R2) and presigned uploads."},
    {"name": "Analytics", "description": "Numbers behind the Storage Analytics page."},
    {"name": "Notifications", "description": "Upload finished, link opened, bin purge warnings."},
    {"name": "System", "description": "Health check."},
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await client.admin.command("ping")
        log.info("Connected to MongoDB Atlas")
        await init_indexes()
    except Exception as e:  # keep the API up so /docs still opens and the error is visible
        log.error("MongoDB connection failed: %s", e)
    start_scheduler()
    yield
    stop_scheduler()
    client.close()


app = FastAPI(
    title="CloudGallery API",
    version="2.0.0",
    description="Backend for CloudGallery - a Google-Photos-style app. Swagger UI lives at `/docs`.",
    openapi_tags=TAGS,
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"], expose_headers=["Content-Disposition"])


@app.middleware("http")
async def access_log(request: Request, call_next):
    rid, start = uuid.uuid4().hex[:8], time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = rid
    log.info("%s %s %s -> %s (%.0f ms)", rid, request.method, request.url.path, response.status_code, ms)
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/files", StaticFiles(directory=str(UPLOAD_DIR)), name="files")  # used by the Local storage provider

for r in (auth.router, photos.router, albums.router, share.router, share.public_page, bin_router.router,
          storage.router, analytics.router, notifications.router):
    app.include_router(r)


@app.get("/", tags=["System"], summary="Is the API alive?")
async def home():
    return {"message": "CloudGallery API is running", "docs": "/docs"}


@app.get("/health", tags=["System"], summary="Health check (also pings MongoDB)")
async def health():
    try:
        await client.admin.command("ping")
        return {"status": "ok", "database": "up"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "down"})
