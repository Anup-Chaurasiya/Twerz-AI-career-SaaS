from datetime import datetime, date, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select, func, or_
from app.models.credit import (
    UserCredit, UserTimePass, CreditTransaction, CreditPack,
    TimePassTier, PromoCode, PromoRedemption,
    TransactionType, PromoType,
)
from app.models.user import User
from app.config import get_settings
from app.exceptions import UsageLimitExceeded
from logging import getLogger

logger = getLogger(__name__)


def _utc_today() -> date:
    """Return today's date in UTC (timezone-independent)."""
    return datetime.now(timezone.utc).date()


class CreditService:

    # ── Balance management ──────────────────────────────────────

    async def ensure_user_credit(
        self, db: AsyncSession, user_id: str, *, for_update: bool = False
    ) -> UserCredit:
        """Get or create the UserCredit row for a user.
        Uses flush (not commit) so callers control transaction boundaries.
        Pass for_update=True to acquire a row-level lock (SELECT ... FOR UPDATE).
        Handles concurrent insert race with IntegrityError retry.
        """
        query = select(UserCredit).where(UserCredit.user_id == user_id)
        if for_update:
            query = query.with_for_update()
        result = await db.execute(query)
        uc = result.scalar_one_or_none()
        if not uc:
            try:
                uc = UserCredit(
                    user_id=user_id,
                    balance=0,
                    daily_free_used=0,
                    daily_free_reset_date=_utc_today(),
                )
                db.add(uc)
                await db.flush()
            except IntegrityError:
                # Concurrent insert won the race — rollback and re-fetch
                await db.rollback()
                query = select(UserCredit).where(UserCredit.user_id == user_id)
                if for_update:
                    query = query.with_for_update()
                result = await db.execute(query)
                uc = result.scalar_one_or_none()
                if not uc:
                    raise  # Should never happen — re-raise if still missing
        return uc

    async def get_balance(self, db: AsyncSession, user_id: str) -> dict:
        """Return full credit status for a user."""
        settings = get_settings()
        uc = await self.ensure_user_credit(db, user_id)
        self._reset_daily_if_needed(uc)
        await db.flush()

        # Idempotent monthly Pro credit grant (calendar-month rollover)
        await self.maybe_grant_subscription_credits(db, user_id)

        active_pass = await self._get_active_time_pass(db, user_id)
        active_pass_info = None
        if active_pass:
            tier = await db.get(TimePassTier, active_pass.tier_id)
            active_pass_info = {
                "tier_name": tier.name if tier else "Unknown",
                "expires_at": active_pass.expires_at.isoformat(),
            }

        sub_info = await self._active_subscription_summary(db, user_id)

        return {
            "balance": uc.balance,
            "daily_free_remaining": max(0, settings.DAILY_FREE_CREDITS - uc.daily_free_used),
            "daily_free_total": settings.DAILY_FREE_CREDITS,
            "active_time_pass": active_pass_info,
            "has_unlimited": active_pass is not None,
            "subscription": sub_info,
        }

    # ── Consumption ─────────────────────────────────────────────

    async def has_credits_available(self, db: AsyncSession, user_id: str) -> bool:
        """Lightweight check — returns True if the user can afford one generation."""
        settings = get_settings()
        uc = await self.ensure_user_credit(db, user_id)
        self._reset_daily_if_needed(uc)
        if await self._get_active_time_pass(db, user_id):
            return True
        if uc.daily_free_used < settings.DAILY_FREE_CREDITS:
            return True
        if uc.balance > 0:
            return True
        return False

    async def check_and_deduct(
        self, db: AsyncSession, user_id: str, job_id: int
    ) -> str:
        """Deduct one credit. Returns source: 'time_pass', 'daily_free', or 'purchased'.
        Raises UsageLimitExceeded if no credits available.
        """
        settings = get_settings()
        uc = await self.ensure_user_credit(db, user_id, for_update=True)
        self._reset_daily_if_needed(uc)

        # Priority 1: Active time pass (unlimited)
        active_pass = await self._get_active_time_pass(db, user_id)
        if active_pass:
            await self._record_transaction(
                db, user_id, -1, TransactionType.CONSUMPTION,
                reference_id=str(job_id),
                description="Resume generation (time pass)",
            )
            await db.commit()
            return "time_pass"

        # Priority 2: Daily free
        if uc.daily_free_used < settings.DAILY_FREE_CREDITS:
            uc.daily_free_used += 1
            await self._record_transaction(
                db, user_id, -1, TransactionType.CONSUMPTION,
                reference_id=str(job_id),
                description="Resume generation (daily free)",
            )
            await db.commit()
            return "daily_free"

        # Priority 3: Purchased credits
        if uc.balance > 0:
            uc.balance -= 1
            await self._record_transaction(
                db, user_id, -1, TransactionType.CONSUMPTION,
                reference_id=str(job_id),
                description="Resume generation (purchased credit)",
            )
            await db.commit()
            return "purchased"

        raise UsageLimitExceeded(
            "No credits available. Purchase a credit pack or time pass to continue."
        )

    async def refund_credit(
        self, db: AsyncSession, user_id: str, job_id: int, source: str = "purchased"
    ) -> None:
        """Refund 1 credit if generation fails after deduction.
        Refunds to the correct bucket based on source.
        Time pass consumption is unlimited, so no refund needed — just record it.
        """
        uc = await self.ensure_user_credit(db, user_id, for_update=True)
        if source == "time_pass":
            # Time pass is unlimited — no balance to restore, just record the reversal
            pass
        elif source == "daily_free":
            uc.daily_free_used = max(0, uc.daily_free_used - 1)
        else:
            uc.balance += 1
        await self._record_transaction(
            db, user_id, 1, TransactionType.REFUND,
            reference_id=str(job_id),
            description=f"Refund: resume generation failed ({source})",
        )
        await db.commit()

    async def refund_stuck_generation_if_needed(
        self, db: AsyncSession, user_id: str, job_id: int
    ) -> bool:
        """Refund a credit spent on a job that was killed mid-GENERATING_RESUME.

        Looks up the latest CONSUMPTION for this job; skips if already refunded or
        time-pass (unlimited). Returns True if a refund was issued.
        """
        from sqlalchemy import select
        from app.models.credit import CreditTransaction

        ref = str(job_id)
        result = await db.execute(
            select(CreditTransaction)
            .where(
                CreditTransaction.user_id == user_id,
                CreditTransaction.reference_id == ref,
            )
            .order_by(CreditTransaction.created_at.desc())
        )
        txns = list(result.scalars().all())
        if any(t.type == TransactionType.REFUND for t in txns):
            return False
        consumption = next((t for t in txns if t.type == TransactionType.CONSUMPTION), None)
        if not consumption:
            return False
        desc = (consumption.description or "").lower()
        if "time pass" in desc:
            source = "time_pass"
        elif "daily free" in desc:
            source = "daily_free"
        else:
            source = "purchased"
        if source == "time_pass":
            # Record reversal note only (no balance change) for audit trail.
            await self.refund_credit(db, user_id, job_id, source)
            return False
        await self.refund_credit(db, user_id, job_id, source)
        return True

    # ── Credit addition ─────────────────────────────────────────

    async def add_credits(
        self, db: AsyncSession, user_id: str, amount: int,
        txn_type: TransactionType, *,
        razorpay_order_id: str | None = None,
        description: str | None = None,
    ) -> UserCredit:
        """Add credits to user balance and record transaction.
        Uses flush so callers (e.g. redeem_promo) can batch into one commit.
        """
        if amount <= 0:
            raise ValueError("Credit amount must be positive")
        uc = await self.ensure_user_credit(db, user_id, for_update=True)
        uc.balance += amount
        await self._record_transaction(
            db, user_id, amount, txn_type,
            razorpay_order_id=razorpay_order_id,
            description=description,
        )
        await db.flush()
        await db.refresh(uc)
        return uc

    # ── Time pass activation ────────────────────────────────────

    async def activate_time_pass(
        self, db: AsyncSession, user_id: str, tier_id: int, *,
        razorpay_order_id: str | None = None,
    ) -> UserTimePass:
        """Activate a time pass. Stacks: new pass starts after the latest existing pass expires.
        Uses flush so callers can batch into one commit.
        """
        tier = await db.get(TimePassTier, tier_id)
        if not tier:
            raise ValueError(f"Time pass tier {tier_id} not found")

        now = datetime.now(timezone.utc)
        # Find the pass with the latest expires_at in the future (including scheduled ones)
        latest_pass = await self._get_latest_future_pass(db, user_id)

        if latest_pass and latest_pass.expires_at.replace(tzinfo=None) > now.replace(tzinfo=None):
            starts_at = latest_pass.expires_at
        else:
            starts_at = now

        expires_at = starts_at + timedelta(days=tier.duration_days)

        utp = UserTimePass(
            user_id=user_id,
            tier_id=tier_id,
            starts_at=starts_at,
            expires_at=expires_at,
            razorpay_order_id=razorpay_order_id,
        )
        db.add(utp)

        await self._record_transaction(
            db, user_id, 0, TransactionType.TIME_PASS_PURCHASE,
            razorpay_order_id=razorpay_order_id,
            description=f"Time pass: {tier.name} ({tier.duration_days} days)",
        )
        await db.flush()
        await db.refresh(utp)
        return utp

    async def activate_subscription(
        self,
        db: AsyncSession,
        user_id: str,
        plan_id: int,
        *,
        razorpay_order_id: str | None = None,
        razorpay_payment_id: str | None = None,
        grant_credits: bool = True,
    ):
        """Activate/extend Job Hunt Pro for 30 days. Stacks after current expiry."""
        from app.models.subscription import SubscriptionPlan, UserSubscription

        plan = await db.get(SubscriptionPlan, plan_id)
        if not plan or not plan.is_active:
            raise ValueError(f"Subscription plan {plan_id} not found or inactive")

        # Idempotency via unique razorpay_order_id
        if razorpay_order_id:
            existing = await db.execute(
                select(UserSubscription).where(
                    UserSubscription.razorpay_order_id == razorpay_order_id
                )
            )
            found = existing.scalar_one_or_none()
            if found:
                return found

        now = datetime.now(timezone.utc)
        # Stack: start at latest future expiry if still active/scheduled
        latest = await db.execute(
            select(UserSubscription)
            .where(
                UserSubscription.user_id == user_id,
                UserSubscription.is_active == True,  # noqa: E712
                UserSubscription.expires_at > now,
            )
            .order_by(UserSubscription.expires_at.desc())
            .limit(1)
        )
        current = latest.scalar_one_or_none()
        starts_at = current.expires_at if current else now
        expires_at = starts_at + timedelta(days=30)

        sub = UserSubscription(
            user_id=user_id,
            plan_id=plan.id,
            starts_at=starts_at,
            expires_at=expires_at,
            razorpay_order_id=razorpay_order_id,
            razorpay_subscription_id=razorpay_payment_id,
            credits_last_granted_at=now if grant_credits else None,
            is_active=True,
        )
        db.add(sub)

        if grant_credits and plan.monthly_credits > 0:
            await self.add_credits(
                db,
                user_id,
                plan.monthly_credits,
                TransactionType.CREDIT_PURCHASE,
                razorpay_order_id=razorpay_order_id,
                description=f"Subscription: {plan.name} ({plan.monthly_credits} credits)",
            )
        elif razorpay_order_id:
            # Ensure verify idempotency has a ledger row even if plan grants 0 credits
            await self._record_transaction(
                db,
                user_id,
                0,
                TransactionType.CREDIT_PURCHASE,
                razorpay_order_id=razorpay_order_id,
                description=f"Job Hunt Pro activated: {plan.name} (30 days)",
            )

        await db.flush()
        await db.refresh(sub)
        return sub

    async def maybe_grant_subscription_credits(
        self, db: AsyncSession, user_id: str
    ) -> bool:
        """If active Pro and calendar month rolled since last grant, grant once. Idempotent."""
        from app.models.subscription import SubscriptionPlan, UserSubscription

        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(UserSubscription, SubscriptionPlan)
            .join(SubscriptionPlan, UserSubscription.plan_id == SubscriptionPlan.id)
            .where(
                UserSubscription.user_id == user_id,
                UserSubscription.is_active == True,  # noqa: E712
                UserSubscription.expires_at > now,
                UserSubscription.starts_at <= now,
            )
            .order_by(UserSubscription.expires_at.desc())
            .limit(1)
        )
        row = result.first()
        if not row:
            return False
        sub, plan = row
        last = sub.credits_last_granted_at
        if last is not None:
            last_utc = last if last.tzinfo else last.replace(tzinfo=timezone.utc)
            if (last_utc.year, last_utc.month) == (now.year, now.month):
                return False

        if plan.monthly_credits <= 0:
            sub.credits_last_granted_at = now
            await db.flush()
            return False

        await self.add_credits(
            db,
            user_id,
            plan.monthly_credits,
            TransactionType.CREDIT_PURCHASE,
            description=f"Monthly Pro grant: {plan.name} ({plan.monthly_credits} credits)",
        )
        sub.credits_last_granted_at = now
        await db.flush()
        return True

    async def _active_subscription_summary(
        self, db: AsyncSession, user_id: str
    ) -> dict | None:
        from app.models.subscription import SubscriptionPlan, UserSubscription

        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(UserSubscription, SubscriptionPlan)
            .join(SubscriptionPlan, UserSubscription.plan_id == SubscriptionPlan.id)
            .where(
                UserSubscription.user_id == user_id,
                UserSubscription.is_active == True,  # noqa: E712
                UserSubscription.expires_at > now,
            )
            .order_by(UserSubscription.expires_at.desc())
            .limit(1)
        )
        row = result.first()
        if not row:
            return None
        sub, plan = row
        last = sub.credits_last_granted_at
        next_grant_hint = None
        if last is not None:
            last_utc = last if last.tzinfo else last.replace(tzinfo=timezone.utc)
            # Hint: first day of next calendar month
            if last_utc.month == 12:
                next_grant_hint = datetime(last_utc.year + 1, 1, 1, tzinfo=timezone.utc).isoformat()
            else:
                next_grant_hint = datetime(
                    last_utc.year, last_utc.month + 1, 1, tzinfo=timezone.utc
                ).isoformat()
        elif sub.starts_at <= now:
            next_grant_hint = "due_now"
        return {
            "active": True,
            "plan_name": plan.name,
            "monthly_credits": plan.monthly_credits,
            "expires_at": sub.expires_at.isoformat(),
            "credits_last_granted_at": last.isoformat() if last else None,
            "next_credit_grant_hint": next_grant_hint,
        }

    # ── Promo redemption ────────────────────────────────────────

    async def redeem_promo(self, db: AsyncSession, user_id: str, code: str) -> dict:
        """Validate and apply a promo code atomically. Returns result summary.
        Uses row-level locking on PromoCode to prevent concurrent redemption races.
        """
        code = code.strip().upper()

        # Lock the promo code row to prevent concurrent redemption races
        result = await db.execute(
            select(PromoCode).where(PromoCode.code == code).with_for_update()
        )
        promo = result.scalar_one_or_none()
        if not promo:
            raise ValueError("Invalid promo code")
        if not promo.is_active:
            raise ValueError("This promo code is no longer active")
        if promo.expires_at and promo.expires_at.replace(tzinfo=None) < datetime.now(timezone.utc).replace(tzinfo=None):
            raise ValueError("This promo code has expired")
        if promo.max_redemptions > 0 and promo.current_redemptions >= promo.max_redemptions:
            raise ValueError("This promo code has reached its redemption limit")

        # Check if user already redeemed
        existing = await db.execute(
            select(PromoRedemption).where(
                PromoRedemption.user_id == user_id,
                PromoRedemption.promo_code_id == promo.id,
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("You have already redeemed this promo code")

        # Apply (add_credits/activate_time_pass use flush, not commit)
        if promo.type == PromoType.CREDITS:
            await self.add_credits(
                db, user_id, promo.value, TransactionType.PROMO_CREDIT,
                description=f"Promo code: {promo.code} (+{promo.value} credits)",
            )
            result_msg = f"Added {promo.value} credits"
        elif promo.type == PromoType.TIME_PASS:
            await self.activate_time_pass(db, user_id, promo.value)
            result_msg = "Time pass activated"
        else:
            raise ValueError("Invalid promo type")

        # Record redemption — all flushed changes commit atomically
        redemption = PromoRedemption(user_id=user_id, promo_code_id=promo.id)
        db.add(redemption)
        promo.current_redemptions += 1
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            raise ValueError("You have already redeemed this promo code")

        return {"message": result_msg, "code": promo.code}

    # ── Transaction queries ─────────────────────────────────────

    async def get_transactions(
        self, db: AsyncSession, user_id: str, *, offset: int = 0, limit: int = 20, search: str = ""
    ) -> tuple[list[CreditTransaction], int]:
        """Paginated user transactions with optional ILIKE search."""
        base = select(CreditTransaction).where(CreditTransaction.user_id == user_id)
        if search:
            pattern = f"%{search}%"
            base = base.where(
                or_(
                    CreditTransaction.description.ilike(pattern),
                    CreditTransaction.type.cast(str).ilike(pattern),
                )
            )
        count_result = await db.execute(select(func.count()).select_from(base.subquery()))
        total = count_result.scalar() or 0
        result = await db.execute(
            base.order_by(CreditTransaction.created_at.desc()).offset(offset).limit(limit)
        )
        return list(result.scalars().all()), total

    async def get_all_transactions(
        self, db: AsyncSession, *, offset: int = 0, limit: int = 20, search: str = ""
    ) -> tuple[list, int]:
        """Admin: all transactions with search on description/type/user_id/razorpay_order_id.
        Returns list of (CreditTransaction, user_email, user_name) tuples.
        """
        base = (
            select(CreditTransaction, User.email, User.name)
            .join(User, CreditTransaction.user_id == User.id)
        )
        if search:
            pattern = f"%{search}%"
            base = base.where(
                or_(
                    CreditTransaction.description.ilike(pattern),
                    CreditTransaction.type.cast(str).ilike(pattern),
                    CreditTransaction.user_id.ilike(pattern),
                    CreditTransaction.razorpay_order_id.ilike(pattern),
                    User.email.ilike(pattern),
                )
            )
        count_q = select(func.count()).select_from(base.subquery())
        count_result = await db.execute(count_q)
        total = count_result.scalar() or 0
        result = await db.execute(
            base.order_by(CreditTransaction.created_at.desc()).offset(offset).limit(limit)
        )
        return list(result.all()), total

    # ── Internal helpers ────────────────────────────────────────

    def _reset_daily_if_needed(self, uc: UserCredit) -> None:
        """Reset daily free counter if the date has rolled over (UTC)."""
        today = _utc_today()
        if uc.daily_free_reset_date < today:
            uc.daily_free_used = 0
            uc.daily_free_reset_date = today

    async def _get_latest_future_pass(self, db: AsyncSession, user_id: str) -> UserTimePass | None:
        """Return the time pass with the latest expires_at in the future (including scheduled).
        Used for stacking: new passes chain after the latest one.
        """
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(UserTimePass)
            .where(
                UserTimePass.user_id == user_id,
                UserTimePass.expires_at > now,
            )
            .order_by(UserTimePass.expires_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _get_active_time_pass(self, db: AsyncSession, user_id: str) -> UserTimePass | None:
        """Return the active time pass with the latest expiry, or None."""
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(UserTimePass)
            .where(
                UserTimePass.user_id == user_id,
                UserTimePass.starts_at <= now,
                UserTimePass.expires_at > now,
            )
            .order_by(UserTimePass.expires_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _record_transaction(
        self, db: AsyncSession, user_id: str, amount: int,
        txn_type: TransactionType, *,
        reference_id: str | None = None,
        razorpay_order_id: str | None = None,
        description: str | None = None,
    ) -> CreditTransaction:
        txn = CreditTransaction(
            user_id=user_id,
            amount=amount,
            type=txn_type,
            reference_id=reference_id,
            razorpay_order_id=razorpay_order_id,
            description=description,
        )
        db.add(txn)
        return txn

    async def grant_referral_bonus_if_eligible(
        self, db: AsyncSession, user_id: str
    ) -> bool:
        """Grant referral bonus after first successful generation.

        Fraud signals hold payout until admin approves. Idempotent via referral_bonus_status.
        Returns True only when credits were granted immediately (not held).
        """
        result = await db.execute(select(User).where(User.id == user_id).with_for_update())
        user = result.scalar_one_or_none()
        if not user or not user.referred_by_user_id:
            return False

        # Legacy + new status guard
        if user.referral_bonus_status != "none":
            return False
        if user.referral_bonus_granted:
            return False

        referrer_id = user.referred_by_user_id
        if referrer_id == user_id:
            user.referral_bonus_granted = True
            user.referral_bonus_status = "denied"
            await db.commit()
            return False

        settings = get_settings()
        bonus_amount = settings.REFERRAL_BONUS_CREDITS

        from app.services.referral.fraud import detect_referral_signals, create_payout_hold

        signals = await detect_referral_signals(
            db, referrer_id=referrer_id, referred_id=user_id,
        )

        if signals:
            await create_payout_hold(
                db,
                referrer_id=referrer_id,
                referred_id=user_id,
                signals=signals,
                bonus_amount=bonus_amount,
            )
            user.referral_bonus_granted = True
            user.referral_bonus_status = "held"
            await db.commit()
            logger.warning(
                "Referral bonus HELD pending review for %s (referrer %s) signals=%s",
                user_id, referrer_id, signals,
            )
            return False

        from app.services.referral.payout import apply_referral_bonus_credits
        await apply_referral_bonus_credits(
            db,
            referred_id=user_id,
            referrer_id=referrer_id,
            bonus_amount=bonus_amount,
        )
        user.referral_bonus_granted = True
        user.referral_bonus_status = "paid"
        await db.commit()
        logger.info("Granted referral bonus (%d credits) to %s and referrer %s", bonus_amount, user_id, referrer_id)
        return True

