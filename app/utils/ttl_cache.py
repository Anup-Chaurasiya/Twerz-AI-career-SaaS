"""Simple in-process TTL cache for rarely-changing API responses."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")


class TTLCache:
    """Thread-safe async TTL cache (single-instance deployments)."""

    def __init__(self, ttl_seconds: float) -> None:
        self.ttl = ttl_seconds
        self._value: T | None = None
        self._expires_at: float = 0.0
        self._lock = asyncio.Lock()

    async def get_or_set(self, factory: Callable[[], T | Awaitable[T]]) -> T:
        now = time.monotonic()
        if self._value is not None and now < self._expires_at:
            return self._value

        async with self._lock:
            now = time.monotonic()
            if self._value is not None and now < self._expires_at:
                return self._value

            result = factory()
            if asyncio.iscoroutine(result):
                result = await result
            self._value = result
            self._expires_at = time.monotonic() + self.ttl
            return self._value

    def invalidate(self) -> None:
        self._value = None
        self._expires_at = 0.0
