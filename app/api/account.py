"""Account export / delete and notifications."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.profile import Profile
from app.models.job import Job
from app.models.roast import Roast
from app.models.credit import UserCredit, UserTimePass, CreditTransaction, PromoRedemption
from app.models.notification import Notification
from app.models.subscription import UserSubscription
from app.models.data_request_log import DataRequestLog
from app.services.notifications.service import NotificationService

router = APIRouter(tags=["account"])
notify_service = NotificationService()


from app.utils.client_ip import client_ip as _client_ip
async def list_notifications(
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Emit due follow-up reminders on read (works with Cloud Run scale-to-zero).
    await notify_service.emit_due_follow_ups(db, user_id=current_user.id)
    rows = await notify_service.list_for_user(
        db, current_user.id, unread_only=unread_only
    )
    return {
        "items": [
            {
                "id": n.id,
                "title": n.title,
                "body": n.body,
                "kind": n.kind,
                "link": n.link,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
            }
            for n in rows
        ]
    }


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await notify_service.mark_read(db, current_user.id, notification_id)
    if not row:
        from app.exceptions import NotFoundError
        raise NotFoundError("Notification not found")
    return {"success": True}


@router.get("/account/export")
async def export_account(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """GDPR-style data export for the current user."""
    db.add(DataRequestLog(
        user_id=current_user.id,
        action="export",
        ip=_client_ip(request),
    ))
    await db.flush()
    profiles = (
        await db.execute(select(Profile).where(Profile.user_id == current_user.id))
    ).scalars().all()
    jobs = (
        await db.execute(select(Job).where(Job.user_id == current_user.id))
    ).scalars().all()
    roasts = (
        await db.execute(select(Roast).where(Roast.user_id == current_user.id))
    ).scalars().all()

    payload = {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        },
        "profiles": [
            {
                "id": p.id,
                "status": p.status.value,
                "resume_info": p.resume_info,
                "created_at": p.created_at.isoformat(),
            }
            for p in profiles
        ],
        "jobs": [
            {
                "id": j.id,
                "job_description": j.job_description,
                "custom_resume_data": j.custom_resume_data,
                "fit_score": j.fit_score,
                "fit_label": j.fit_label,
                "cover_letter": j.cover_letter,
                "status": j.status.value,
                "application_status": j.application_status.value if j.application_status else None,
            }
            for j in jobs
        ],
        "roasts": [{"id": r.id, "status": r.status.value, "share_id": getattr(r, "share_id", None)} for r in roasts],
    }
    await db.commit()
    return payload


@router.delete("/account")
async def delete_account(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Hard-delete user data (profiles, jobs, credits, notifications) then the user."""
    uid = current_user.id
    db.add(DataRequestLog(user_id=uid, action="delete", ip=_client_ip(request)))
    await db.flush()
    await db.execute(delete(Notification).where(Notification.user_id == uid))
    await db.execute(delete(UserSubscription).where(UserSubscription.user_id == uid))
    await db.execute(delete(PromoRedemption).where(PromoRedemption.user_id == uid))
    await db.execute(delete(CreditTransaction).where(CreditTransaction.user_id == uid))
    await db.execute(delete(UserTimePass).where(UserTimePass.user_id == uid))
    await db.execute(delete(UserCredit).where(UserCredit.user_id == uid))
    await db.execute(delete(Job).where(Job.user_id == uid))
    await db.execute(delete(Roast).where(Roast.user_id == uid))
    await db.execute(delete(Profile).where(Profile.user_id == uid))
    await db.execute(delete(User).where(User.id == uid))
    await db.commit()
    return {"success": True, "message": "Account and associated data deleted"}
