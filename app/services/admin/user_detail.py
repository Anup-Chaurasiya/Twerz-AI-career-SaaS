"""Admin user 360 detail aggregation."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.exceptions import NotFoundError
from app.models.user import User
from app.models.tenant import Tenant
from app.models.job import Job, JobStatus
from app.models.roast import Roast
from app.models.credit import UserCredit, UserTimePass, CreditTransaction, TimePassTier, TransactionType
from app.services.admin.cost import user_llm_cost_usd, user_revenue_paise
from app.services.credit.service import CreditService

credit_service = CreditService()


async def get_user_detail(db: AsyncSession, user_id: str) -> dict:
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundError(f"User {user_id} not found")

    settings = get_settings()
    now = datetime.now(timezone.utc)

    tenant_name = None
    if user.tenant_id:
        tenant = await db.get(Tenant, user.tenant_id)
        tenant_name = tenant.name if tenant else None

    # Jobs
    jobs_result = await db.execute(
        select(Job).where(Job.user_id == user_id).order_by(Job.created_at.desc())
    )
    jobs = jobs_result.scalars().all()

    # Roasts
    roasts_result = await db.execute(
        select(Roast).where(Roast.user_id == user_id).order_by(Roast.created_at.desc())
    )
    roasts = roasts_result.scalars().all()

    # Referrals
    referred_count = (await db.execute(
        select(func.count(User.id)).where(User.referred_by_user_id == user_id)
    )).scalar() or 0

    referrer = None
    if user.referred_by_user_id:
        ref_user = await db.get(User, user.referred_by_user_id)
        if ref_user:
            referrer = {"id": ref_user.id, "email": ref_user.email, "name": ref_user.name}

    referral_txns_result = await db.execute(
        select(CreditTransaction)
        .where(
            CreditTransaction.user_id == user_id,
            CreditTransaction.type == TransactionType.PROMO_CREDIT,
            CreditTransaction.description.ilike("%referral%"),
        )
        .order_by(CreditTransaction.created_at.desc())
        .limit(10)
    )
    referral_transactions = [
        {
            "id": t.id,
            "amount": t.amount,
            "description": t.description,
            "created_at": t.created_at.isoformat(),
        }
        for t in referral_txns_result.scalars().all()
    ]

    # Credits
    balance_info = await credit_service.get_balance(db, user_id)
    uc_result = await db.execute(select(UserCredit).where(UserCredit.user_id == user_id))
    uc = uc_result.scalar_one_or_none()
    daily_free_remaining = balance_info.get("daily_free_remaining", max(0, settings.DAILY_FREE_CREDITS - (uc.daily_free_used if uc else 0)))

    active_pass = balance_info.get("active_time_pass")
    if not active_pass:
        tp_result = await db.execute(
            select(UserTimePass, TimePassTier.name)
            .join(TimePassTier, UserTimePass.tier_id == TimePassTier.id)
            .where(
                UserTimePass.user_id == user_id,
                UserTimePass.starts_at <= now,
                UserTimePass.expires_at > now,
            )
            .order_by(UserTimePass.expires_at.desc())
            .limit(1)
        )
        tp_row = tp_result.first()
        if tp_row:
            utp, tier_name = tp_row
            active_pass = {
                "tier_name": tier_name,
                "starts_at": utp.starts_at.isoformat(),
                "expires_at": utp.expires_at.isoformat(),
            }

    recent_txns_result = await db.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == user_id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(20)
    )
    recent_transactions = [
        {
            "id": t.id,
            "amount": t.amount,
            "type": t.type.value,
            "description": t.description,
            "created_at": t.created_at.isoformat(),
        }
        for t in recent_txns_result.scalars().all()
    ]

    # Failures
    failed_jobs = [
        {
            "id": j.id,
            "status": j.status.value,
            "pdf_error_log": j.pdf_error_log[:500] if j.pdf_error_log else None,
            "pdf_verified_readable": j.pdf_verified_readable,
            "created_at": j.created_at.isoformat(),
        }
        for j in jobs
        if j.status == JobStatus.FAILED or j.pdf_error_log
    ]

    refund_txns_result = await db.execute(
        select(CreditTransaction)
        .where(
            CreditTransaction.user_id == user_id,
            CreditTransaction.type == TransactionType.REFUND,
        )
        .order_by(CreditTransaction.created_at.desc())
        .limit(10)
    )
    refund_transactions = [
        {
            "id": t.id,
            "amount": t.amount,
            "description": t.description,
            "created_at": t.created_at.isoformat(),
        }
        for t in refund_txns_result.scalars().all()
    ]

    total_llm_cost = await user_llm_cost_usd(db, user_id)
    total_revenue = await user_revenue_paise(db, user_id)

    return {
        "account": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_super_admin": user.is_super_admin,
            "tenant_id": user.tenant_id,
            "tenant_name": tenant_name,
            "signup_source": user.signup_source,
            "signup_ip": user.signup_ip,
            "onboarding_completed": user.onboarding_completed,
            "created_at": user.created_at.isoformat(),
        },
        "jobs": [
            {
                "id": j.id,
                "status": j.status.value,
                "fit_score": j.fit_score,
                "fit_label": j.fit_label,
                "ats_score_before": j.ats_score_before,
                "ats_score_after": j.ats_score_after,
                "application_status": j.application_status.value if j.application_status else None,
                "applied_via": j.applied_via,
                "pdf_verified_readable": j.pdf_verified_readable,
                "pdf_error_log": j.pdf_error_log[:200] if j.pdf_error_log else None,
                "created_at": j.created_at.isoformat(),
            }
            for j in jobs
        ],
        "roasts": [
            {
                "id": r.id,
                "status": r.status.value,
                "share_id": getattr(r, "share_id", None),
                "created_at": r.created_at.isoformat(),
            }
            for r in roasts
        ],
        "referrals": {
            "referral_code": user.referral_code,
            "referred_count": referred_count,
            "referred_by": referrer,
            "bonus_granted": user.referral_bonus_granted,
            "bonus_status": user.referral_bonus_status,
            "referral_transactions": referral_transactions,
        },
        "credits": {
            "balance": balance_info["balance"],
            "daily_free_remaining": daily_free_remaining,
            "active_time_pass": active_pass,
            "recent_transactions": recent_transactions,
        },
        "financials": {
            "total_llm_cost_usd": total_llm_cost,
            "total_revenue_paise": total_revenue,
            "cost_negative": total_llm_cost > 0 and total_revenue == 0,
        },
        "failures": {
            "failed_jobs": failed_jobs,
            "refund_transactions": refund_transactions,
        },
    }
