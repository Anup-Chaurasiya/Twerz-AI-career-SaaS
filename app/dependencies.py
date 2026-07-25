import hashlib
import struct
from fastapi import Depends, Header
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database.session import get_db
from app.config import get_settings, Settings
from app.services.auth.jwt_handler import verify_token
from app.models import User
from app.exceptions import AuthenticationError, ForbiddenError

async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthenticationError("Invalid authorization header")
    token = authorization[7:]
    payload = verify_token(token)
    user = await db.get(User, payload["sub"])
    if not user:
        raise AuthenticationError("User not found")
    return user


async def get_super_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_super_admin:
        raise ForbiddenError("Super admin access required")
    return current_user


def _lock_key(session_key: str) -> int:
    """Derive a stable int64 from a string for PostgreSQL advisory locks."""
    return struct.unpack("q", hashlib.md5(session_key.encode()).digest()[:8])[0]


async def try_chat_lock(db: AsyncSession, session_key: str) -> bool:
    """Acquire a PostgreSQL advisory lock for a chat session.

    Returns True if acquired, False if another worker already holds it.
    Falls back to True (no-op) for non-PostgreSQL backends (e.g. SQLite tests).
    """
    try:
        result = await db.execute(
            text("SELECT pg_try_advisory_lock(:k)"), {"k": _lock_key(session_key)}
        )
        return result.scalar()
    except Exception:
        return True


async def release_chat_lock(db: AsyncSession, session_key: str, *, rollback_first: bool = False):
    """Release a PostgreSQL advisory lock for a chat session.

    When *rollback_first* is True, issue a ROLLBACK before the unlock to
    ensure the connection is in a clean transaction state (needed after
    agent runs that may have left uncommitted work on the session).
    Advisory locks are session-level and survive ROLLBACK.
    """
    try:
        if rollback_first:
            try:
                await db.rollback()
            except Exception:
                pass
        await db.execute(
            text("SELECT pg_advisory_unlock(:k)"), {"k": _lock_key(session_key)}
        )
    except Exception:
        pass


__all__ = ["get_db", "get_settings", "get_current_user", "get_super_admin", "try_chat_lock", "release_chat_lock"]
