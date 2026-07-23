"""Apply or reject held referral bonus payouts."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError
from app.models.user import User
from app.models.referral_payout_review import ReferralPayoutReview, ReferralPayoutStatus
from app.models.credit import TransactionType
from app.services.credit.service import CreditService

credit_service = CreditService()


async def apply_referral_bonus_credits(
    db: AsyncSession,
    *,
    referred_id: str,
    referrer_id: str,
    bonus_amount: int,
) -> None:
    """Grant referral bonus to both users (no fraud re-check)."""
    uc_referred = await credit_service.ensure_user_credit(db, referred_id, for_update=True)
    uc_referred.balance += bonus_amount
    await credit_service._record_transaction(
        db, referred_id, bonus_amount, TransactionType.PROMO_CREDIT,
        description=f"Referral sign-up bonus (+{bonus_amount} credits)",
    )

    uc_referrer = await credit_service.ensure_user_credit(db, referrer_id, for_update=True)
    uc_referrer.balance += bonus_amount
    await credit_service._record_transaction(
        db, referrer_id, bonus_amount, TransactionType.PROMO_CREDIT,
        description=f"Referral reward for inviting user ({bonus_amount} credits)",
    )


async def approve_payout_review(
    db: AsyncSession,
    review_id: int,
    admin_user_id: str,
) -> ReferralPayoutReview:
    result = await db.execute(
        select(ReferralPayoutReview)
        .where(ReferralPayoutReview.id == review_id)
        .with_for_update()
    )
    review = result.scalar_one_or_none()
    if not review:
        raise NotFoundError(f"Referral review {review_id} not found")
    if review.status != ReferralPayoutStatus.PENDING:
        raise ValueError(f"Review is already {review.status.value}")

    referred_result = await db.execute(
        select(User).where(User.id == review.referred_id).with_for_update()
    )
    referred = referred_result.scalar_one_or_none()
    if not referred or referred.referral_bonus_status != "held":
        raise ValueError("Referred user is not in held bonus state")

    await apply_referral_bonus_credits(
        db,
        referred_id=review.referred_id,
        referrer_id=review.referrer_id,
        bonus_amount=review.bonus_amount,
    )

    referred.referral_bonus_status = "paid"
    review.status = ReferralPayoutStatus.APPROVED
    review.reviewed_by_admin_id = admin_user_id
    review.reviewed_at = datetime.now(timezone.utc)

    # Mark related flags reviewed
    from app.models.referral_flag import ReferralFlag
    flags = (await db.execute(
        select(ReferralFlag).where(
            ReferralFlag.referrer_id == review.referrer_id,
            ReferralFlag.referred_id == review.referred_id,
        )
    )).scalars().all()
    for flag in flags:
        flag.reviewed = True

    await db.flush()
    return review


async def reject_payout_review(
    db: AsyncSession,
    review_id: int,
    admin_user_id: str,
) -> ReferralPayoutReview:
    result = await db.execute(
        select(ReferralPayoutReview)
        .where(ReferralPayoutReview.id == review_id)
        .with_for_update()
    )
    review = result.scalar_one_or_none()
    if not review:
        raise NotFoundError(f"Referral review {review_id} not found")
    if review.status != ReferralPayoutStatus.PENDING:
        raise ValueError(f"Review is already {review.status.value}")

    referred_result = await db.execute(
        select(User).where(User.id == review.referred_id).with_for_update()
    )
    referred = referred_result.scalar_one_or_none()
    if referred:
        referred.referral_bonus_status = "denied"

    review.status = ReferralPayoutStatus.REJECTED
    review.reviewed_by_admin_id = admin_user_id
    review.reviewed_at = datetime.now(timezone.utc)

    from app.models.referral_flag import ReferralFlag
    flags = (await db.execute(
        select(ReferralFlag).where(
            ReferralFlag.referrer_id == review.referrer_id,
            ReferralFlag.referred_id == review.referred_id,
        )
    )).scalars().all()
    for flag in flags:
        flag.reviewed = True

    await db.flush()
    return review
