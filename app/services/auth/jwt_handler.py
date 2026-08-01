from datetime import datetime, timedelta, timezone

import jwt
from jwt.exceptions import ExpiredSignatureError, PyJWTError

from app.config import get_settings
from app.exceptions import AuthenticationError


def _access_token_ttl() -> timedelta:
    settings = get_settings()
    return timedelta(minutes=settings.JWT_ACCESS_EXPIRY_MINUTES)


def create_guest_token(profile_id: int) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.GUEST_PROFILE_TTL_HOURS)
    payload = {
        "typ": "guest",
        "profile_id": profile_id,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_guest_token(token: str) -> int:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except ExpiredSignatureError:
        raise AuthenticationError("guest_token_expired") from None
    except PyJWTError:
        raise AuthenticationError("guest_token_invalid") from None
    if payload.get("typ") != "guest":
        raise AuthenticationError("guest_token_invalid")
    profile_id = payload.get("profile_id")
    if not isinstance(profile_id, int):
        raise AuthenticationError("guest_token_invalid")
    return profile_id


def create_access_token(user_id: str, email: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + _access_token_ttl()
    payload = {
        "sub": user_id,
        "email": email,
        "typ": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except ExpiredSignatureError:
        raise AuthenticationError("token_expired") from None
    except PyJWTError:
        raise AuthenticationError("token_invalid") from None

    token_type = payload.get("typ")
    if token_type is not None and token_type != "access":
        raise AuthenticationError("token_invalid")
    return payload
