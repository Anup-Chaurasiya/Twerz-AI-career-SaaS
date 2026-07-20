"""In-app notifications (resume ready, follow-up due, pass expiring, etc.)."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import ApplicationStatus, Job
from app.models.notification import Notification

_TERMINAL_APPLICATION = {
    ApplicationStatus.OFFER,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
}


class NotificationService:
    async def notify(
        self,
        db: AsyncSession,
        user_id: str,
        *,
        title: str,
        body: str,
        kind: str = "info",
        link: str | None = None,
        commit: bool = True,
    ) -> Notification:
        row = Notification(
            user_id=user_id,
            title=title,
            body=body,
            kind=kind,
            link=link,
            is_read=False,
        )
        db.add(row)
        if commit:
            await db.commit()
            await db.refresh(row)
        else:
            await db.flush()
        return row

    async def list_for_user(
        self, db: AsyncSession, user_id: str, *, limit: int = 50, unread_only: bool = False
    ) -> list[Notification]:
        stmt = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            stmt = stmt.where(Notification.is_read.is_(False))
        stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def mark_read(self, db: AsyncSession, user_id: str, notification_id: int) -> Notification | None:
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id, Notification.user_id == user_id
            )
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        row.is_read = True
        await db.commit()
        await db.refresh(row)
        return row

    async def emit_due_follow_ups(self, db: AsyncSession, *, user_id: str | None = None) -> int:
        """Create at most one follow-up notification per due job. Returns count created.

        Idempotent via ``jobs.follow_up_notified_at``. Skips terminal application statuses.
        When ``user_id`` is set, only that user's jobs are scanned (request-scoped path).
        """
        now = datetime.now(timezone.utc)
        stmt = select(Job).where(
            Job.follow_up_at.is_not(None),
            Job.follow_up_at <= now,
            Job.follow_up_notified_at.is_(None),
            Job.application_status.notin_(_TERMINAL_APPLICATION),
        )
        if user_id is not None:
            stmt = stmt.where(Job.user_id == user_id)
        result = await db.execute(stmt)
        jobs = list(result.scalars().all())
        if not jobs:
            return 0

        created = 0
        for job in jobs:
            jd = job.job_description or {}
            role = jd.get("role") or "role"
            company = jd.get("company") or "company"
            await self.notify(
                db,
                job.user_id,
                title="Follow-up due",
                body=f"Follow up on {role} at {company}",
                kind="follow_up",
                link=f"/dashboard/jobs/{job.id}",
                commit=False,
            )
            job.follow_up_notified_at = now
            created += 1
        await db.commit()
        return created
