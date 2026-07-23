"""Resolve the client IP for rate limiting and audit logs.

In production (behind Cloud Run / a trusted reverse proxy), the leftmost
``X-Forwarded-For`` hop is the original client. In local dev we ignore that
header so it cannot be spoofed against the in-memory limiter.
"""

from __future__ import annotations

from fastapi import Request

from app.config import get_settings


def client_ip(request: Request) -> str:
    settings = get_settings()
    trust_proxy = settings.TRUST_PROXY_HEADERS or settings.ENVIRONMENT.upper() != "DEV"

    if trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        # Cloud Run also sets this when X-Forwarded-For is absent.
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"
