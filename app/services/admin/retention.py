"""Weekly signup cohort retention."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.job import Job, JobStatus


def _week_start(dt: datetime) -> datetime:
    d = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return d - timedelta(days=d.weekday())


async def get_cohort_retention(db: AsyncSession, weeks: int = 8) -> dict:
    now = datetime.now(timezone.utc)
    cohorts = []

    for w in range(weeks):
        start = _week_start(now) - timedelta(weeks=w)
        end = start + timedelta(weeks=1)
        label = start.strftime("%Y-%m-%d")

        signup_rows = (await db.execute(
            select(User.id).where(User.created_at >= start, User.created_at < end)
        )).all()
        signup_ids = [r[0] for r in signup_rows]
        cohort_size = len(signup_ids)

        if cohort_size == 0:
            cohorts.append({
                "cohort_week": label,
                "signup_count": 0,
                "retention": [0.0, 0.0, 0.0, 0.0],
            })
            continue

        retention = []
        for offset in range(4):
            w_start = start + timedelta(weeks=offset)
            w_end = w_start + timedelta(weeks=1)
            active = (await db.execute(
                select(func.count(func.distinct(Job.user_id))).where(
                    Job.user_id.in_(signup_ids),
                    Job.created_at >= w_start,
                    Job.created_at < w_end,
                    Job.status.in_([
                        JobStatus.RESUME_GENERATED,
                        JobStatus.GENERATING_PDF,
                        JobStatus.READY,
                    ]),
                )
            )).scalar() or 0
            retention.append(round((active / cohort_size) * 100, 1))

        cohorts.append({
            "cohort_week": label,
            "signup_count": cohort_size,
            "retention": retention,
        })

    return {"cohorts": list(reversed(cohorts)), "week_labels": ["W0", "W+1", "W+2", "W+3"]}
