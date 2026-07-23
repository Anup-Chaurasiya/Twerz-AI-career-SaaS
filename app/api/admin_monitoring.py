"""Admin monitoring endpoints — NEXT2 phases A–F."""

import math
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database.session import async_session_factory, get_db
from app.dependencies import get_super_admin
from app.models.user import User
from app.models.profile import Profile
from app.models.job import Job, JobStatus
from app.models.credit import CreditTransaction, TransactionType
from app.models.data_request_log import DataRequestLog
from app.models.golden_matrix_run import GoldenMatrixRun
from app.models.token_usage import LLMRequest
from app.services.admin.audit import list_audit_logs
from app.services.admin.cost import llm_costs_by_purpose
from app.services.admin.health import get_health_metrics
from app.services.admin.public_usage import get_public_usage_stats
from app.services.admin.retention import get_cohort_retention
from app.services.admin.user_detail import get_user_detail
from app.services.admin.golden_matrix import (
    get_latest_run,
    is_running,
    run_golden_matrix_background,
)
from app.services.referral.fraud import list_referral_reviews
from app.services.referral.payout import approve_payout_review, reject_payout_review
from app.services.admin.audit import log_admin_action
from app.exceptions import BadRequestError
from app.services.alerting import alert

router = APIRouter(prefix="/admin", tags=["admin-monitoring"])


def _paginate(items, total, page, size):
    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": math.ceil(total / size) if total > 0 else 1,
        "limit": size,
    }


# ── Phase A: User 360 + Audit Log ────────────────────────────────

@router.get("/users/{user_id}/detail")
async def admin_user_detail(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_super_admin),
):
    return await get_user_detail(db, user_id)


@router.get("/audit-log")
async def admin_audit_log(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    admin_user_id: str | None = Query(None),
    target_user_id: str | None = Query(None),
    action: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_super_admin),
):
    items, total = await list_audit_logs(
        db,
        page=page,
        size=size,
        admin_user_id=admin_user_id,
        target_user_id=target_user_id,
        action=action,
    )
    return _paginate(items, total, page, size)


# ── Phase B: Referral fraud + Calibration + Public usage ───────────

@router.get("/referrals/flagged")
async def admin_flagged_referrals(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    status: str = Query("pending", max_length=16),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_super_admin),
):
    from app.models.referral_payout_review import ReferralPayoutStatus
    if status == "all":
        payout_status = None
    else:
        try:
            payout_status = ReferralPayoutStatus(status)
        except ValueError as exc:
            raise BadRequestError(
                f"Invalid status '{status}'. Must be one of: pending, approved, rejected, all"
            ) from exc
    if payout_status:
        items, total = await list_referral_reviews(db, page=page, size=size, status=payout_status)
    else:
        items, total = await list_referral_reviews(db, page=page, size=size, status=None)
    return _paginate(items, total, page, size)


@router.post("/referrals/{review_id}/approve")
async def admin_approve_referral(
    review_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_super_admin),
):
    review = await approve_payout_review(db, review_id, admin.id)
    await log_admin_action(
        db, admin_user_id=admin.id, action="referral_approve", target_type="referral_review",
        target_id=str(review_id),
        after={"referrer_id": review.referrer_id, "referred_id": review.referred_id, "bonus_amount": review.bonus_amount},
    )
    await db.commit()
    return {"success": True, "review_id": review_id, "status": "approved"}


@router.post("/referrals/{review_id}/reject")
async def admin_reject_referral(
    review_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_super_admin),
):
    review = await reject_payout_review(db, review_id, admin.id)
    await log_admin_action(
        db, admin_user_id=admin.id, action="referral_reject", target_type="referral_review",
        target_id=str(review_id),
        after={"referrer_id": review.referrer_id, "referred_id": review.referred_id},
    )
    await db.commit()
    return {"success": True, "review_id": review_id, "status": "rejected"}


@router.get("/public-usage")
async def admin_public_usage(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_super_admin),
):
    return await get_public_usage_stats(db)


# ── Phase C: Health + Golden Matrix + Alerts ─────────────────────

@router.get("/health-metrics")
async def admin_health_metrics(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_super_admin),
):
    metrics = await get_health_metrics(db)
    latest = await get_latest_run(db)
    metrics["golden_matrix"] = {
        "is_running": is_running(),
        "last_run": {
            "id": latest.id,
            "status": latest.status,
            "passed": latest.passed,
            "started_at": latest.started_at.isoformat(),
            "completed_at": latest.completed_at.isoformat() if latest.completed_at else None,
            "result_json": latest.result_json,
        } if latest else None,
    }
    return metrics


@router.post("/golden-matrix/run")
async def trigger_golden_matrix(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_super_admin),
):
    if is_running():
        return {"success": False, "message": "Golden matrix run already in progress"}

    run = GoldenMatrixRun(
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    background_tasks.add_task(run_golden_matrix_background, async_session_factory, run.id)
    return {"success": True, "run_id": run.id, "status": "running"}


@router.get("/golden-matrix/status")
async def golden_matrix_status(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_super_admin),
):
    latest = await get_latest_run(db)
    if not latest:
        return {"is_running": is_running(), "last_run": None}
    return {
        "is_running": is_running(),
        "last_run": {
            "id": latest.id,
            "status": latest.status,
            "passed": latest.passed,
            "started_at": latest.started_at.isoformat(),
            "completed_at": latest.completed_at.isoformat() if latest.completed_at else None,
            "result_json": latest.result_json,
            "error_message": latest.error_message,
        },
    }


@router.post("/alerts/test")
async def test_alert(
    _admin: User = Depends(get_super_admin),
):
    await alert(
        "ATS Beater admin alert test — delivery confirmed",
        level="info",
        context={"source": "admin_test_button", "admin_email": _admin.email},
    )
    return {"success": True, "message": "Test alert dispatched (check Slack/Sentry if configured)"}


# ── Phase D: Cost breakdown + Free tier ──────────────────────────

@router.get("/llm-costs")
async def admin_llm_costs(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_super_admin),
):
    return {
        "days": days,
        "by_purpose": await llm_costs_by_purpose(db, days=days),
    }


@router.get("/free-tier-usage")
async def admin_free_tier_usage(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_super_admin),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days_ago = now - timedelta(days=7)

    daily_free_today = (await db.execute(
        select(func.count(CreditTransaction.id)).where(
            CreditTransaction.type == TransactionType.CONSUMPTION,
            CreditTransaction.description.ilike("%daily free%"),
            CreditTransaction.created_at >= today_start,
        )
    )).scalar() or 0

    daily_free_7d = (await db.execute(
        select(func.count(CreditTransaction.id)).where(
            CreditTransaction.type == TransactionType.CONSUMPTION,
            CreditTransaction.description.ilike("%daily free%"),
            CreditTransaction.created_at >= seven_days_ago,
        )
    )).scalar() or 0

    enhance_active = (await db.execute(
        select(func.count(Profile.id)).where(Profile.enhance_count_today > 0)
    )).scalar() or 0

    public_ats_7d = (await db.execute(
        select(func.count(LLMRequest.id)).where(
            LLMRequest.purpose == "public_ats_check",
            LLMRequest.created_at >= seven_days_ago,
        )
    )).scalar() or 0

    return {
        "daily_free_credits_today": daily_free_today,
        "daily_free_credits_7d": daily_free_7d,
        "profiles_with_enhance_today": enhance_active,
        "public_ats_checks_7d": public_ats_7d,
    }


# ── Phase E: Compliance + Flagged accounts ───────────────────────

@router.get("/data-requests")
async def admin_data_requests(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_super_admin),
):
    total = (await db.execute(select(func.count(DataRequestLog.id)))).scalar() or 0
    offset = (page - 1) * size
    rows = (await db.execute(
        select(DataRequestLog, User.email)
        .outerjoin(User, DataRequestLog.user_id == User.id)
        .order_by(DataRequestLog.created_at.desc())
        .offset(offset)
        .limit(size)
    )).all()
    items = [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_email": email,
            "action": log.action,
            "ip": log.ip,
            "created_at": log.created_at.isoformat(),
        }
        for log, email in rows
    ]
    return _paginate(items, total, page, size)


@router.get("/accounts/flagged")
async def admin_flagged_accounts(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_super_admin),
):
    settings = get_settings()
    window_start = datetime.now(timezone.utc) - timedelta(hours=24)

    # IP collision: multiple signups from same IP
    ip_rows = (await db.execute(
        select(User.signup_ip, func.count(User.id))
        .where(User.signup_ip.isnot(None), User.created_at >= window_start)
        .group_by(User.signup_ip)
        .having(func.count(User.id) > 1)
    )).all()
    ip_collisions = [
        {"signup_ip": ip, "count": count, "signal": "ip_collision"}
        for ip, count in ip_rows
    ]

    # Refund clustering: users with 3+ refunds in 7 days
    refund_window = datetime.now(timezone.utc) - timedelta(days=7)
    refund_rows = (await db.execute(
        select(CreditTransaction.user_id, func.count(CreditTransaction.id))
        .where(
            CreditTransaction.type == TransactionType.REFUND,
            CreditTransaction.created_at >= refund_window,
        )
        .group_by(CreditTransaction.user_id)
        .having(func.count(CreditTransaction.id) >= 3)
    )).all()

    refund_clustering = []
    for user_id, count in refund_rows:
        user = await db.get(User, user_id)
        refund_clustering.append({
            "user_id": user_id,
            "email": user.email if user else None,
            "refund_count_7d": count,
            "signal": "refund_clustering",
        })

    return {
        "ip_collisions": ip_collisions,
        "refund_clustering": refund_clustering,
        "referral_velocity_max": settings.REFERRAL_VELOCITY_MAX,
    }


# ── Phase F: Live Ops + Cohort Retention ─────────────────────────

@router.get("/ops/live")
async def admin_ops_live(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_super_admin),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    one_hour_ago = now - timedelta(hours=1)

    generating = (await db.execute(
        select(Job.id, Job.user_id, Job.status, Job.created_at).where(
            Job.status.in_([JobStatus.GENERATING_RESUME, JobStatus.GENERATING_PDF])
        ).order_by(Job.created_at.desc()).limit(20)
    )).all()

    signups_today = (await db.execute(
        select(func.count(User.id)).where(User.created_at >= today_start)
    )).scalar() or 0

    revenue_today = (await db.execute(
        select(func.coalesce(func.sum(CreditTransaction.amount), 0)).where(
            CreditTransaction.created_at >= today_start,
            CreditTransaction.type.in_([
                TransactionType.CREDIT_PURCHASE,
                TransactionType.TIME_PASS_PURCHASE,
            ]),
        )
    )).scalar() or 0

    jobs_last_hour = (await db.execute(
        select(func.count(Job.id)).where(Job.created_at >= one_hour_ago)
    )).scalar() or 0
    failures_last_hour = (await db.execute(
        select(func.count(Job.id)).where(
            Job.created_at >= one_hour_ago,
            Job.status == JobStatus.FAILED,
        )
    )).scalar() or 0

    return {
        "timestamp": now.isoformat(),
        "jobs_generating": [
            {
                "id": j.id,
                "user_id": j.user_id,
                "status": j.status.value,
                "created_at": j.created_at.isoformat(),
            }
            for j in generating
        ],
        "jobs_generating_count": len(generating),
        "signups_today": signups_today,
        "revenue_credits_today": int(revenue_today),
        "error_rate_1h_pct": round((failures_last_hour / jobs_last_hour) * 100, 1) if jobs_last_hour else 0.0,
        "jobs_last_hour": jobs_last_hour,
        "failures_last_hour": failures_last_hour,
    }


@router.get("/retention/cohorts")
async def admin_retention_cohorts(
    weeks: int = Query(8, ge=4, le=16),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_super_admin),
):
    return await get_cohort_retention(db, weeks=weeks)
