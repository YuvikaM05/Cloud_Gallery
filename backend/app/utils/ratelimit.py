"""Tiny in-memory sliding-window rate limiter for auth routes (per client IP)."""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.core.config import get_settings

_hits: dict[str, deque] = defaultdict(deque)


def auth_rate_limit(request: Request) -> None:
    limit = get_settings().AUTH_RATE_LIMIT_PER_MIN
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait a minute and try again.")
    q.append(now)
