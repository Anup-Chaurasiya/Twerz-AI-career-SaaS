"""Automatic threshold alerting when aggregate error rates spike."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.job import Job, JobStatus
from app.services.alerting import alert

logger = logging.getLogger(__name__)

_last_alert_at: datetime | None = None


async def maybe_alert_on_error_rate_spike(db: AsyncSession) -> None:
    """Fire alert if rolling 1h job failure rate exceeds configured threshold.

    Debounced to at most once per ALERT_ERROR_RATE_COOLDOWN_MINUTES.
    """
    global _last_alert_at
    settings = get_settings()
    if settings.ALERT_ERROR_RATE_THRESHOLD_PCT <= 0:
        return

    now = datetime.now(timezone.utc)
    if _last_alert_at:
        cooldown = timedelta(minutes=settings.ALERT_ERROR_RATE_COOLDOWN_MINUTES)
        if now - _last_alert_at < cooldown:
            return

    one_hour_ago = now - timedelta(hours=1)
    total = (await db.execute(
        select(func.count(Job.id)).where(Job.created_at >= one_hour_ago)
    )).scalar() or 0
    if total < settings.ALERT_ERROR_RATE_MIN_JOBS_1H:
        return

    failures = (await db.execute(
        select(func.count(Job.id)).where(
            Job.created_at >= one_hour_ago,
            Job.status == JobStatus.FAILED,
        )
    )).scalar() or 0

    rate_pct = round((failures / total) * 100, 1)
    if rate_pct < settings.ALERT_ERROR_RATE_THRESHOLD_PCT:
        return

    _last_alert_at = now
    await alert(
        f"Rolling 1h job error rate spike: {rate_pct}% ({failures}/{total} jobs failed)",
        level="error",
        context={
            "error_rate_1h_pct": rate_pct,
            "failures_last_hour": failures,
            "jobs_last_hour": total,
            "threshold_pct": settings.ALERT_ERROR_RATE_THRESHOLD_PCT,
        },
    )
    logger.warning("Threshold alert fired: 1h error rate %s%%", rate_pct)
