"""Redis-backed Rate Limiter — Production-ready for multi-instance Cloud Run.

Uses sliding window algorithm with Redis sorted sets for accurate per-IP limits.
Falls back to in-memory limiting when REDIS_URL is unset (local dev only).
When Redis is configured but unavailable at request time, requests are denied (fail closed).
"""

from __future__ import annotations

import asyncio
import time
import uuid
from collections import defaultdict
from typing import Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import get_settings
from app.utils.client_ip import client_ip
from logging import getLogger

logger = getLogger(__name__)

_PUBLIC_PREFIXES = {"/public/", "/roasts/shared/"}

# Atomic sliding-window check + insert (returns 1 allowed, 0 denied).
_REDIS_SLIDING_WINDOW_LUA = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_start = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local ttl = tonumber(ARGV[5])
redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
local count = redis.call('ZCARD', key)
if count >= limit then
    return 0
end
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, ttl)
return 1
"""


async def _persist_public_request(path: str, ip: str, status_code: int) -> None:
    try:
        from app.database.session import async_session_factory
        from app.models.public_request_log import PublicRequestLog

        async with async_session_factory() as db:
            db.add(PublicRequestLog(path=path, ip=ip, status_code=status_code))
            await db.commit()
    except Exception:
        logger.debug("Failed to persist public request log", exc_info=True)


def _schedule_public_request_log(path: str, ip: str, status_code: int) -> None:
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_persist_public_request(path, ip, status_code))
    except RuntimeError:
        pass


class InMemoryRateLimitMiddleware(BaseHTTPMiddleware):
    """In-memory sliding window IP rate limiter — single-instance dev only."""

    def __init__(self, app, public_paths: set[str] | None = None):
        super().__init__(app)
        self.public_prefix_paths = public_paths or _PUBLIC_PREFIXES
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if not any(path.startswith(prefix) for prefix in self.public_prefix_paths):
            return await call_next(request)

        settings = get_settings()
        limit_rpm = settings.RATE_LIMIT_PUBLIC_RPM
        client_ip_addr = client_ip(request)
        now = time.monotonic()
        window_start = now - 60.0

        async with self._locks[client_ip_addr]:
            timestamps = [ts for ts in self._requests[client_ip_addr] if ts > window_start]
            self._requests[client_ip_addr] = timestamps

            if len(timestamps) >= limit_rpm:
                _schedule_public_request_log(path, client_ip_addr, 429)
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Rate limit exceeded. Maximum {limit_rpm} requests per minute allowed on public endpoints.",
                        "rate_limit_rpm": limit_rpm,
                    },
                    headers={"Retry-After": "60"},
                )

            self._requests[client_ip_addr].append(now)

        response = await call_next(request)
        _schedule_public_request_log(path, client_ip_addr, response.status_code)
        return response


class RedisRateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-backed sliding window IP rate limiter for public routes."""

    def __init__(self, app, public_paths: set[str] | None = None):
        super().__init__(app)
        self.public_prefix_paths = public_paths or _PUBLIC_PREFIXES
        self._redis_client: Optional[object] = None
        self._redis_available = False
        self._initialize_redis()

    def _initialize_redis(self):
        settings = get_settings()
        redis_url = (settings.REDIS_URL or "").strip()
        if not redis_url:
            logger.warning("REDIS_URL not configured — Redis rate limiter inactive")
            return

        try:
            import redis.asyncio as redis

            self._redis_client = redis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            self._redis_available = True
            logger.info("Redis rate limiter initialized successfully")
        except ImportError:
            logger.error("redis package not installed. Install with: uv add redis")
        except Exception as e:
            logger.error("Failed to initialize Redis client: %s", e)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if not any(path.startswith(prefix) for prefix in self.public_prefix_paths):
            return await call_next(request)

        settings = get_settings()
        limit_rpm = settings.RATE_LIMIT_PUBLIC_RPM

        if not self._redis_available or not self._redis_client:
            logger.error("Redis rate limiter unavailable — denying public request (fail closed)")
            return JSONResponse(
                status_code=503,
                content={"detail": "Rate limiting service temporarily unavailable. Please retry shortly."},
                headers={"Retry-After": "30"},
            )

        client_ip_addr = client_ip(request)
        now = time.time()
        window_start = now - 60.0
        redis_key = f"rate_limit:{client_ip_addr}"

        try:
            allowed = await self._redis_client.eval(
                _REDIS_SLIDING_WINDOW_LUA,
                1,
                redis_key,
                str(now),
                str(window_start),
                str(limit_rpm),
                f"{now}:{uuid.uuid4().hex}",
                "65",
            )

            if not allowed:
                _schedule_public_request_log(path, client_ip_addr, 429)
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Rate limit exceeded. Maximum {limit_rpm} requests per minute allowed on public endpoints.",
                        "rate_limit_rpm": limit_rpm,
                    },
                    headers={"Retry-After": "60"},
                )

            response = await call_next(request)
            _schedule_public_request_log(path, client_ip_addr, response.status_code)
            return response

        except Exception as e:
            logger.error("Redis rate limit check failed for IP %s: %s", client_ip_addr, e)
            return JSONResponse(
                status_code=503,
                content={"detail": "Rate limiting service temporarily unavailable. Please retry shortly."},
                headers={"Retry-After": "30"},
            )


# Backwards compatibility alias used by older tests/docs
IPRateLimitMiddleware = InMemoryRateLimitMiddleware
