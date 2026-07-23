"""Referral code helpers shared by auth and user endpoints."""

from __future__ import annotations

import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def generate_unique_referral_code(db: AsyncSession) -> str:
    """Return a URL-safe referral code that is not already in use."""
    for _ in range(8):
        candidate = secrets.token_urlsafe(6)
        existing = await db.execute(
            select(User.id).where(User.referral_code == candidate)
        )
        if not existing.scalar_one_or_none():
            return candidate
    return secrets.token_urlsafe(10)


async def ensure_user_referral_code(db: AsyncSession, user: User) -> bool:
    """Assign a referral code to legacy users. Returns True if a new code was assigned."""
    if user.referral_code:
        return False
    user.referral_code = await generate_unique_referral_code(db)
    return True
