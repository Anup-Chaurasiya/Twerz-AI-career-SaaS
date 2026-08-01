"""Auth cookie helpers shared by auth routes."""

from fastapi import Response

from app.config import get_settings
from app.services.auth.refresh_tokens import REFRESH_TOKEN_COOKIE


def set_refresh_token_cookie(response: Response, raw_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value=raw_token,
        httponly=True,
        secure=settings.ENVIRONMENT.upper() != "DEV",
        samesite="lax",
        max_age=settings.JWT_REFRESH_EXPIRY_DAYS * 86400,
        path="/",
    )


def clear_refresh_token_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        REFRESH_TOKEN_COOKIE,
        path="/",
        secure=settings.ENVIRONMENT.upper() != "DEV",
        samesite="lax",
    )
