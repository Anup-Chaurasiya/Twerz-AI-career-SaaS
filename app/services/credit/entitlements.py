"""Feature gates: Job Hunt Pro subscription or unlimited time pass."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions import PaymentRequiredError
from app.models.subscription import UserSubscription
from app.services.credit.service import CreditService


credit_service = CreditService()

PAYWALL = {
    "code": "job_hunt_pro_required",
    "upgrade_path": "/dashboard/credits",
    "plan": "Job Hunt Pro",
}


async def has_active_time_pass(db: AsyncSession, user_id: str) -> bool:
    return await credit_service._get_active_time_pass(db, user_id) is not None


async def get_active_subscription(
    db: AsyncSession, user_id: str
) -> UserSubscription | None:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(UserSubscription)
        .options(selectinload(UserSubscription.plan))
        .where(
            UserSubscription.user_id == user_id,
            UserSubscription.is_active == True,  # noqa: E712
            UserSubscription.expires_at > now,
        )
        .order_by(UserSubscription.expires_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def has_pro_access(db: AsyncSession, user_id: str) -> bool:
    """Active Job Hunt Pro subscription OR unlimited time pass."""
    if await has_active_time_pass(db, user_id):
        return True
    return await get_active_subscription(db, user_id) is not None


async def require_pro_or_pass(
    db: AsyncSession,
    user_id: str,
    *,
    feature: str,
    message: str | None = None,
) -> None:
    """Raise PaymentRequiredError (402) unless user has Pro or time pass."""
    if await has_pro_access(db, user_id):
        return
    raise PaymentRequiredError(
        message
        or f"{feature} requires Job Hunt Pro or an active time pass.",
        paywall={**PAYWALL, "feature": feature},
    )
