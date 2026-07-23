"""LLM cost estimation and aggregation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.token_usage import LLMRequest
from app.models.credit import CreditTransaction, TransactionType


def estimate_cost(model_name: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate USD cost for an LLM API call."""
    rates = {
        "gemini-3-flash-preview": {"input": 0.10, "output": 0.40},
        "gemini-3.1-pro-preview": {"input": 1.25, "output": 5.00},
    }
    bare = model_name.split("/")[-1] if "/" in model_name else model_name
    r = rates.get(bare, rates.get(model_name, {"input": 0.50, "output": 1.50}))
    return (input_tokens * r["input"] + output_tokens * r["output"]) / 1_000_000


async def user_llm_cost_usd(db: AsyncSession, user_id: str) -> float:
    rows = (await db.execute(
        select(
            LLMRequest.model_name,
            func.coalesce(func.sum(LLMRequest.input_tokens), 0),
            func.coalesce(func.sum(LLMRequest.output_tokens), 0),
        )
        .where(LLMRequest.user_id == user_id)
        .group_by(LLMRequest.model_name)
    )).all()
    return round(sum(estimate_cost(m, inp, outp) for m, inp, outp in rows), 4)


async def user_revenue_paise(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(CreditTransaction.amount), 0)).where(
            CreditTransaction.user_id == user_id,
            CreditTransaction.type.in_([
                TransactionType.CREDIT_PURCHASE,
                TransactionType.TIME_PASS_PURCHASE,
            ]),
            CreditTransaction.razorpay_order_id.isnot(None),
        )
    )
    return int(result.scalar() or 0)


async def llm_costs_by_purpose(
    db: AsyncSession,
    *,
    days: int = 7,
) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (await db.execute(
        select(
            LLMRequest.purpose,
            LLMRequest.model_name,
            func.count(LLMRequest.id),
            func.coalesce(func.sum(LLMRequest.input_tokens), 0),
            func.coalesce(func.sum(LLMRequest.output_tokens), 0),
        )
        .where(LLMRequest.created_at >= since)
        .group_by(LLMRequest.purpose, LLMRequest.model_name)
    )).all()

    by_purpose: dict[str, dict] = {}
    for purpose, model_name, count, inp, outp in rows:
        cost = estimate_cost(model_name, inp, outp)
        bucket = by_purpose.setdefault(purpose, {
            "purpose": purpose,
            "request_count": 0,
            "estimated_cost_usd": 0.0,
        })
        bucket["request_count"] += count
        bucket["estimated_cost_usd"] += cost

    return sorted(
        [{**v, "estimated_cost_usd": round(v["estimated_cost_usd"], 4)} for v in by_purpose.values()],
        key=lambda x: x["estimated_cost_usd"],
        reverse=True,
    )
