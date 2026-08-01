"""Auth cookie helpers shared by auth routes."""

from fastapi import Response

from app.config import get_settings
from app.services.auth.google_oauth import OAUTH_CSRF_COOKIE
from app.services.auth.refresh_tokens import REFRESH_TOKEN_COOKIE


def _shared_cookie_domain() -> str | None:
    """Share auth cookies across www.twerz.com and api.twerz.com when configured."""
    settings = get_settings()
    if settings.ENVIRONMENT.upper() == "DEV":
        return None
    domain = (settings.COOKIE_DOMAIN or "").strip()
    return domain or None


def set_refresh_token_cookie(response: Response, raw_token: str) -> None:
    settings = get_settings()
    cookie_kwargs: dict = {
        "key": REFRESH_TOKEN_COOKIE,
        "value": raw_token,
        "httponly": True,
        "secure": settings.ENVIRONMENT.upper() != "DEV",
        "samesite": "lax",
        "max_age": settings.JWT_REFRESH_EXPIRY_DAYS * 86400,
        "path": "/",
    }
    domain = _shared_cookie_domain()
    if domain:
        cookie_kwargs["domain"] = domain
    response.set_cookie(**cookie_kwargs)


def clear_refresh_token_cookie(response: Response) -> None:
    settings = get_settings()
    delete_kwargs: dict = {
        "key": REFRESH_TOKEN_COOKIE,
        "path": "/",
        "secure": settings.ENVIRONMENT.upper() != "DEV",
        "samesite": "lax",
    }
    domain = _shared_cookie_domain()
    if domain:
        delete_kwargs["domain"] = domain
    response.delete_cookie(**delete_kwargs)


def set_oauth_csrf_cookie(response: Response, csrf: str) -> None:
    settings = get_settings()
    cookie_kwargs: dict = {
        "key": OAUTH_CSRF_COOKIE,
        "value": csrf,
        "httponly": True,
        "secure": settings.ENVIRONMENT.upper() != "DEV",
        "samesite": "lax",
        "max_age": 600,
        "path": "/",
    }
    domain = _shared_cookie_domain()
    if domain:
        cookie_kwargs["domain"] = domain
    response.set_cookie(**cookie_kwargs)


def clear_oauth_csrf_cookie(response: Response) -> None:
    settings = get_settings()
    delete_kwargs: dict = {
        "key": OAUTH_CSRF_COOKIE,
        "path": "/",
        "secure": settings.ENVIRONMENT.upper() != "DEV",
        "samesite": "lax",
    }
    domain = _shared_cookie_domain()
    if domain:
        delete_kwargs["domain"] = domain
    response.delete_cookie(**delete_kwargs)
