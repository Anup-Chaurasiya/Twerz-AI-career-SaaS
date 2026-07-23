"""Log public endpoint requests for admin abuse monitoring."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.public_request_log import PublicRequestLog

logger = logging.getLogger(__name__)


async def log_public_request(db: AsyncSession, *, path: str, ip: str, status_code: int) -> None:
    try:
        db.add(PublicRequestLog(path=path, ip=ip, status_code=status_code))
        await db.commit()
    except Exception:
        logger.debug("Failed to log public request", exc_info=True)
        await db.rollback()


async def get_public_usage_stats(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)

    async def _stats(since: datetime) -> dict:
        total = (await db.execute(
            select(func.count(PublicRequestLog.id)).where(PublicRequestLog.created_at >= since)
        )).scalar() or 0
        unique_ips = (await db.execute(
            select(func.count(distinct(PublicRequestLog.ip))).where(PublicRequestLog.created_at >= since)
        )).scalar() or 0
        rate_limited = (await db.execute(
            select(func.count(PublicRequestLog.id)).where(
                PublicRequestLog.created_at >= since,
                PublicRequestLog.status_code == 429,
            )
        )).scalar() or 0
        by_path_rows = (await db.execute(
            select(PublicRequestLog.path, func.count(PublicRequestLog.id))
            .where(PublicRequestLog.created_at >= since)
            .group_by(PublicRequestLog.path)
        )).all()
        return {
            "total_requests": total,
            "unique_ips": unique_ips,
            "rate_limited": rate_limited,
            "rate_limit_pct": round((rate_limited / total) * 100, 1) if total else 0.0,
            "by_path": {path: count for path, count in by_path_rows},
        }

    # Daily trend last 7 days
    seven_days_ago = now - timedelta(days=7)
    day_rows = (await db.execute(
        select(func.date(PublicRequestLog.created_at), func.count(PublicRequestLog.id))
        .where(PublicRequestLog.created_at >= seven_days_ago)
        .group_by(func.date(PublicRequestLog.created_at))
        .order_by(func.date(PublicRequestLog.created_at))
    )).all()

    return {
        "24h": await _stats(now - timedelta(hours=24)),
        "7d": await _stats(now - timedelta(days=7)),
        "daily_trend": [{"date": str(d), "count": c} for d, c in day_rows],
    }
