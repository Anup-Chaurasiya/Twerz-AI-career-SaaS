"""Referral fraud detection and payout hold/review workflow."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User
from app.models.referral_flag import ReferralFlag
from app.models.referral_payout_review import ReferralPayoutReview, ReferralPayoutStatus
from app.models.credit import CreditTransaction, TransactionType


async def detect_referral_signals(
    db: AsyncSession,
    *,
    referrer_id: str,
    referred_id: str,
) -> list[str]:
    """Read-only fraud signal detection. Does not mutate DB."""
    settings = get_settings()
    signals: list[str] = []

    referrer = await db.get(User, referrer_id)
    referred = await db.get(User, referred_id)
    if not referrer or not referred:
        return signals

    if (
        referrer.signup_ip
        and referred.signup_ip
        and referrer.signup_ip == referred.signup_ip
    ):
        signals.append("ip_match")

    window_start = datetime.now(timezone.utc) - timedelta(hours=settings.REFERRAL_VELOCITY_WINDOW_HOURS)
    velocity_count = (await db.execute(
        select(func.count(CreditTransaction.id)).where(
            CreditTransaction.user_id == referrer_id,
            CreditTransaction.type == TransactionType.PROMO_CREDIT,
            CreditTransaction.description.ilike("%referral reward%"),
            CreditTransaction.created_at >= window_start,
        )
    )).scalar() or 0
    if velocity_count >= settings.REFERRAL_VELOCITY_MAX:
        signals.append("velocity")

    return signals


async def create_payout_hold(
    db: AsyncSession,
    *,
    referrer_id: str,
    referred_id: str,
    signals: list[str],
    bonus_amount: int,
) -> ReferralPayoutReview:
    """Create hold record + audit flags. Caller must not grant credits yet."""
    for signal in signals:
        existing = await db.execute(
            select(ReferralFlag).where(
                ReferralFlag.referrer_id == referrer_id,
                ReferralFlag.referred_id == referred_id,
                ReferralFlag.signal == signal,
            )
        )
        if existing.scalar_one_or_none():
            continue
        db.add(ReferralFlag(
            referrer_id=referrer_id,
            referred_id=referred_id,
            signal=signal,
        ))

    existing_review = await db.execute(
        select(ReferralPayoutReview).where(
            ReferralPayoutReview.referrer_id == referrer_id,
            ReferralPayoutReview.referred_id == referred_id,
        )
    )
    review = existing_review.scalar_one_or_none()
    if review:
        review.signals = signals
        review.bonus_amount = bonus_amount
        review.status = ReferralPayoutStatus.PENDING
        review.reviewed_by_admin_id = None
        review.reviewed_at = None
    else:
        review = ReferralPayoutReview(
            referrer_id=referrer_id,
            referred_id=referred_id,
            signals=signals,
            bonus_amount=bonus_amount,
            status=ReferralPayoutStatus.PENDING,
        )
        db.add(review)

    await db.flush()
    return review


async def get_pending_review_for_referred(
    db: AsyncSession, referred_id: str,
) -> ReferralPayoutReview | None:
    result = await db.execute(
        select(ReferralPayoutReview).where(
            ReferralPayoutReview.referred_id == referred_id,
            ReferralPayoutReview.status == ReferralPayoutStatus.PENDING,
        )
    )
    return result.scalar_one_or_none()


async def list_referral_reviews(
    db: AsyncSession,
    *,
    page: int,
    size: int,
    status: ReferralPayoutStatus | None = None,
) -> tuple[list[dict], int]:
    base = select(ReferralPayoutReview)
    count_base = select(func.count(ReferralPayoutReview.id))
    if status is not None:
        base = base.where(ReferralPayoutReview.status == status)
        count_base = count_base.where(ReferralPayoutReview.status == status)

    total = (await db.execute(count_base)).scalar() or 0
    offset = (page - 1) * size
    reviews = (await db.execute(
        base.order_by(ReferralPayoutReview.created_at.desc()).offset(offset).limit(size)
    )).scalars().all()

    items = []
    for review in reviews:
        referrer = await db.get(User, review.referrer_id)
        referred = await db.get(User, review.referred_id)
        items.append({
            "id": review.id,
            "referrer_id": review.referrer_id,
            "referrer_email": referrer.email if referrer else None,
            "referred_id": review.referred_id,
            "referred_email": referred.email if referred else None,
            "signals": review.signals,
            "bonus_amount": review.bonus_amount,
            "status": review.status.value,
            "referrer_signup_ip": referrer.signup_ip if referrer else None,
            "referred_signup_ip": referred.signup_ip if referred else None,
            "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None,
            "created_at": review.created_at.isoformat(),
        })
    return items, total


# Backwards-compatible alias used by older admin code paths
async def list_flagged_referrals(
    db: AsyncSession,
    *,
    page: int,
    size: int,
    reviewed: bool | None = None,
) -> tuple[list[dict], int]:
    if reviewed is True:
        count_base = select(func.count(ReferralPayoutReview.id)).where(
            ReferralPayoutReview.status != ReferralPayoutStatus.PENDING
        )
        total = (await db.execute(count_base)).scalar() or 0
        offset = (page - 1) * size
        reviews = (await db.execute(
            select(ReferralPayoutReview)
            .where(ReferralPayoutReview.status != ReferralPayoutStatus.PENDING)
            .order_by(ReferralPayoutReview.created_at.desc())
            .offset(offset)
            .limit(size)
        )).scalars().all()
        items = []
        for review in reviews:
            referrer = await db.get(User, review.referrer_id)
            referred = await db.get(User, review.referred_id)
            items.append({
                "id": review.id,
                "referrer_id": review.referrer_id,
                "referrer_email": referrer.email if referrer else None,
                "referred_id": review.referred_id,
                "referred_email": referred.email if referred else None,
                "signals": review.signals,
                "bonus_amount": review.bonus_amount,
                "status": review.status.value,
                "referrer_signup_ip": referrer.signup_ip if referrer else None,
                "referred_signup_ip": referred.signup_ip if referred else None,
                "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None,
                "created_at": review.created_at.isoformat(),
            })
        return items, total
    if reviewed is False:
        return await list_referral_reviews(db, page=page, size=size, status=ReferralPayoutStatus.PENDING)
    return await list_referral_reviews(db, page=page, size=size, status=ReferralPayoutStatus.PENDING)


async def check_and_flag_referral(
    db: AsyncSession,
    *,
    referrer_id: str,
    referred_id: str,
) -> list[str]:
    """Deprecated: use detect_referral_signals + create_payout_hold instead."""
    signals = await detect_referral_signals(db, referrer_id=referrer_id, referred_id=referred_id)
    if signals:
        settings = get_settings()
        await create_payout_hold(
            db,
            referrer_id=referrer_id,
            referred_id=referred_id,
            signals=signals,
            bonus_amount=settings.REFERRAL_BONUS_CREDITS,
        )
    return signals
