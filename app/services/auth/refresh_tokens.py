"""Opaque refresh tokens — stored hashed, rotated on each use."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.exceptions import AuthenticationError
from app.models.refresh_token import RefreshToken
from app.models.user import User

REFRESH_TOKEN_COOKIE = "refresh_token"
_TOKEN_BYTES = 32


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def create_refresh_token(
    db: AsyncSession,
    user_id: str,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> str:
    """Persist a new refresh token and return the raw value (send to client once)."""
    settings = get_settings()
    raw = secrets.token_urlsafe(_TOKEN_BYTES)
    row = RefreshToken(
        user_id=user_id,
        token_hash=hash_refresh_token(raw),
        expires_at=_utcnow() + timedelta(days=settings.JWT_REFRESH_EXPIRY_DAYS),
        user_agent=(user_agent or "")[:512] or None,
        ip_address=(ip_address or "")[:64] or None,
    )
    db.add(row)
    await db.flush()
    return raw


async def rotate_refresh_token(db: AsyncSession, raw_token: str) -> tuple[str, User]:
    """Validate refresh token, revoke it, issue a rotated replacement."""
    if not raw_token.strip():
        raise AuthenticationError("refresh_token_invalid")

    token_hash = hash_refresh_token(raw_token.strip())
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise AuthenticationError("refresh_token_invalid")

    now = _utcnow()
    if row.revoked_at is not None:
        # Reuse of a revoked token — possible theft; revoke all sessions for this user.
        await revoke_all_for_user(db, row.user_id)
        await db.flush()
        raise AuthenticationError("refresh_token_invalid")

    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= now:
        row.revoked_at = now
        raise AuthenticationError("refresh_token_expired")

    user = await db.get(User, row.user_id)
    if not user:
        row.revoked_at = now
        raise AuthenticationError("refresh_token_invalid")

    new_raw = secrets.token_urlsafe(_TOKEN_BYTES)
    new_row = RefreshToken(
        user_id=row.user_id,
        token_hash=hash_refresh_token(new_raw),
        expires_at=now + timedelta(days=get_settings().JWT_REFRESH_EXPIRY_DAYS),
        user_agent=row.user_agent,
        ip_address=row.ip_address,
    )
    db.add(new_row)
    await db.flush()

    row.revoked_at = now
    row.replaced_by_id = new_row.id
    return new_raw, user


async def revoke_refresh_token(db: AsyncSession, raw_token: str) -> None:
    if not raw_token.strip():
        return
    token_hash = hash_refresh_token(raw_token.strip())
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    row = result.scalar_one_or_none()
    if row and row.revoked_at is None:
        row.revoked_at = _utcnow()


async def revoke_all_for_user(db: AsyncSession, user_id: str) -> None:
    now = _utcnow()
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
    )
    for row in result.scalars():
        row.revoked_at = now
