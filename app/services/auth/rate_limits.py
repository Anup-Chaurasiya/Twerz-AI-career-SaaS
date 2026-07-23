"""Daily LLM call rate limits keyed off llm_requests audit rows."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import UsageLimitExceeded
from app.models.token_usage import LLMRequest
from app.services.credit.service import CreditService


async def enforce_daily_llm_limit(
    db: AsyncSession,
    user_id: str,
    *,
    purpose: str,
    limit: int,
    label: str,
) -> None:
    """Raise UsageLimitExceeded when the user exceeded today's limit for a purpose.

    Locks the user's credit row so concurrent requests cannot bypass the daily cap.
    """
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    await CreditService().ensure_user_credit(db, user_id, for_update=True)
    count = (
        await db.execute(
            select(func.count(LLMRequest.id)).where(
                LLMRequest.user_id == user_id,
                LLMRequest.purpose == purpose,
                LLMRequest.created_at >= today_start,
            )
        )
    ).scalar() or 0
    if count >= limit:
        raise UsageLimitExceeded(
            f"Daily limit reached for {label} ({limit}/day). Try again tomorrow."
        )
