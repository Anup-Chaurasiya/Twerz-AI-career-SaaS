"""System health metrics for admin panel."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.job import Job, JobStatus
from app.models.credit import CreditTransaction, TransactionType


async def _window_counts(db: AsyncSession, since: datetime) -> dict:
    total_jobs = (await db.execute(
        select(func.count(Job.id)).where(Job.created_at >= since)
    )).scalar() or 0

    phase1_failures = (await db.execute(
        select(func.count(Job.id)).where(
            Job.created_at >= since,
            Job.status == JobStatus.FAILED,
            Job.custom_resume_data.is_(None),
        )
    )).scalar() or 0

    pdf_failures = (await db.execute(
        select(func.count(Job.id)).where(
            Job.created_at >= since,
            or_(
                Job.pdf_error_log.isnot(None),
                (Job.status == JobStatus.FAILED) & Job.custom_resume_data.isnot(None),
            ),
        )
    )).scalar() or 0

    unreadable = (await db.execute(
        select(func.count(Job.id)).where(
            Job.created_at >= since,
            Job.pdf_verified_readable.is_(False),
        )
    )).scalar() or 0

    refund_count = (await db.execute(
        select(func.count(CreditTransaction.id)).where(
            CreditTransaction.created_at >= since,
            CreditTransaction.type == TransactionType.REFUND,
        )
    )).scalar() or 0

    refund_amount = (await db.execute(
        select(func.coalesce(func.sum(CreditTransaction.amount), 0)).where(
            CreditTransaction.created_at >= since,
            CreditTransaction.type == TransactionType.REFUND,
        )
    )).scalar() or 0

    return {
        "total_jobs": total_jobs,
        "phase1_failures": phase1_failures,
        "pdf_failures": pdf_failures,
        "unreadable_pdfs": unreadable,
        "refund_count": refund_count,
        "refund_amount": int(refund_amount),
        "refund_rate_pct": round((refund_count / total_jobs) * 100, 1) if total_jobs else 0.0,
    }


async def get_health_metrics(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    settings = get_settings()
    return {
        "windows": {
            "24h": await _window_counts(db, now - timedelta(hours=24)),
            "7d": await _window_counts(db, now - timedelta(days=7)),
        },
        "models": {
            "llm_flash_model": settings.LLM_FLASH_MODEL,
            "llm_pro_model": settings.LLM_PRO_MODEL,
        },
    }
