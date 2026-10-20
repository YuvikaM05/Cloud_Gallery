import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.services.photo_service import purge_expired_bin, warn_expiring_bin

log = logging.getLogger("cloudgallery.scheduler")
scheduler = AsyncIOScheduler(timezone="UTC")


async def _safe(fn):
    try:
        await fn()
    except Exception:
        log.exception("scheduled job %s failed", fn.__name__)


def start_scheduler() -> None:
    scheduler.add_job(_safe, "interval", hours=6, args=[purge_expired_bin], id="purge_bin", replace_existing=True)
    scheduler.add_job(_safe, "interval", hours=12, args=[warn_expiring_bin], id="warn_bin", replace_existing=True)
    scheduler.start()
    log.info("scheduler started (bin purge every 6h)")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
