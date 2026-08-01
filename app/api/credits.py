import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.models.user import User
from app.models.credit import CreditPack, TimePassTier
from app.dependencies import get_current_user
from app.services.credit.service import CreditService
from app.schemas.credit import RedeemPromoRequest, CreditBalanceResponse
from app.utils.ttl_cache import TTLCache

router = APIRouter(prefix="/credits", tags=["credits"])
credit_service = CreditService()
_packs_cache = TTLCache(ttl_seconds=300)
_subscriptions_cache = TTLCache(ttl_seconds=300)


@router.get("/packs")
async def list_packs(db: AsyncSession = Depends(get_db)):
    """Public: list active credit packs and time passes."""

    async def _fetch():
        packs_result = await db.execute(
            select(CreditPack)
            .where(CreditPack.is_active == True)
            .order_by(CreditPack.sort_order, CreditPack.price_paise)
        )
        tiers_result = await db.execute(
            select(TimePassTier)
            .where(TimePassTier.is_active == True)
            .order_by(TimePassTier.sort_order, TimePassTier.price_paise)
        )
        packs = packs_result.scalars().all()
        tiers = tiers_result.scalars().all()
        return {
            "credit_packs": [
                {
                    "id": p.id, "name": p.name, "credits": p.credits,
                    "price_paise": p.price_paise, "sort_order": p.sort_order,
                }
                for p in packs
            ],
            "time_passes": [
                {
                    "id": t.id, "name": t.name, "duration_days": t.duration_days,
                    "price_paise": t.price_paise, "sort_order": t.sort_order,
                }
                for t in tiers
            ],
        }

    return await _packs_cache.get_or_set(_fetch)


@router.get("/me")
async def get_balance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Current user's credit balance and status."""
    balance = await credit_service.get_balance(db, current_user.id)
    # Persist daily reset + optional monthly Pro credit grant
    await db.commit()
    return balance


@router.get("/history")
async def get_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query("", max_length=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Paginated transaction history for current user."""
    offset = (page - 1) * limit
    txns, total = await credit_service.get_transactions(
        db, current_user.id, offset=offset, limit=limit, search=search
    )
    return {
        "items": [
            {
                "id": t.id, "amount": t.amount, "type": t.type.value,
                "reference_id": t.reference_id,
                "razorpay_order_id": t.razorpay_order_id,
                "description": t.description,
                "created_at": t.created_at.isoformat(),
            }
            for t in txns
        ],
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if total > 0 else 1,
        "limit": limit,
    }


@router.post("/redeem-promo")
async def redeem_promo(
    body: RedeemPromoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Redeem a promo code."""
    result = await credit_service.redeem_promo(db, current_user.id, body.code)
    balance = await credit_service.get_balance(db, current_user.id)
    return {**result, "balance": balance}


@router.get("/subscriptions")
async def list_subscription_plans(db: AsyncSession = Depends(get_db)):
    """Public: list active Job Hunt Pro-style subscription plans."""
    from app.models.subscription import SubscriptionPlan

    async def _fetch():
        result = await db.execute(
            select(SubscriptionPlan)
            .where(SubscriptionPlan.is_active == True)
            .order_by(SubscriptionPlan.sort_order, SubscriptionPlan.price_paise)
        )
        plans = result.scalars().all()
        return {
            "plans": [
                {
                    "id": p.id,
                    "name": p.name,
                    "monthly_credits": p.monthly_credits,
                    "price_paise": p.price_paise,
                    "includes_tracker": p.includes_tracker,
                    "includes_interview_packets": p.includes_interview_packets,
                    "includes_extension": p.includes_extension,
                }
                for p in plans
            ]
        }

    return await _subscriptions_cache.get_or_set(_fetch)


@router.get("/subscriptions/me")
async def my_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    from app.models.subscription import UserSubscription, SubscriptionPlan

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(UserSubscription, SubscriptionPlan)
        .join(SubscriptionPlan, UserSubscription.plan_id == SubscriptionPlan.id)
        .where(
            UserSubscription.user_id == current_user.id,
            UserSubscription.is_active == True,
            UserSubscription.expires_at > now,
        )
        .order_by(UserSubscription.expires_at.desc())
        .limit(1)
    )
    row = result.first()
    if not row:
        return {"active": False, "subscription": None}
    sub, plan = row
    return {
        "active": True,
        "subscription": {
            "id": sub.id,
            "plan_name": plan.name,
            "monthly_credits": plan.monthly_credits,
            "starts_at": sub.starts_at.isoformat(),
            "expires_at": sub.expires_at.isoformat(),
            "credits_last_granted_at": (
                sub.credits_last_granted_at.isoformat()
                if sub.credits_last_granted_at
                else None
            ),
            "includes_tracker": plan.includes_tracker,
            "includes_interview_packets": plan.includes_interview_packets,
            "includes_extension": plan.includes_extension,
        },
    }


@router.post("/subscriptions/{plan_id}/activate-dev")
async def activate_subscription_dev(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """DEV helper: activate a subscription without Razorpay (ENVIRONMENT=DEV only)."""
    from datetime import datetime, timezone, timedelta
    from app.config import get_settings
    from app.models.subscription import SubscriptionPlan, UserSubscription
    from app.exceptions import BadRequestError, NotFoundError
    from app.models.credit import TransactionType

    settings = get_settings()
    if settings.ENVIRONMENT.upper() != "DEV":
        raise BadRequestError("Dev subscription activate is only available in DEV")

    plan = await db.get(SubscriptionPlan, plan_id)
    if not plan or not plan.is_active:
        raise NotFoundError("Subscription plan not found")

    now = datetime.now(timezone.utc)
    sub = UserSubscription(
        user_id=current_user.id,
        plan_id=plan.id,
        starts_at=now,
        expires_at=now + timedelta(days=30),
        credits_last_granted_at=now,
        is_active=True,
    )
    db.add(sub)
    await credit_service.add_credits(
        db,
        current_user.id,
        plan.monthly_credits,
        txn_type=TransactionType.CREDIT_PURCHASE,
        description=f"Subscription: {plan.name}",
    )
    await db.commit()
    await db.refresh(sub)
    return {
        "success": True,
        "subscription_id": sub.id,
        "expires_at": sub.expires_at.isoformat(),
        "credits_granted": plan.monthly_credits,
    }
