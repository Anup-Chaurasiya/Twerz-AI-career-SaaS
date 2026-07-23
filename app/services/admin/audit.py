"""Admin action audit logging."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_audit_log import AdminAuditLog
from app.models.user import User


async def log_admin_action(
    db: AsyncSession,
    *,
    admin_user_id: str | None,
    action: str,
    target_type: str,
    target_id: str | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    note: str | None = None,
) -> AdminAuditLog:
    row = AdminAuditLog(
        admin_user_id=admin_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        before=before,
        after=after,
        note=note,
    )
    db.add(row)
    await db.flush()
    return row


async def list_audit_logs(
    db: AsyncSession,
    *,
    page: int,
    size: int,
    admin_user_id: str | None = None,
    target_user_id: str | None = None,
    action: str | None = None,
) -> tuple[list[dict], int]:
    base = select(AdminAuditLog, User.email.label("admin_email")).outerjoin(
        User, AdminAuditLog.admin_user_id == User.id
    )
    count_base = select(func.count(AdminAuditLog.id))

    if admin_user_id:
        base = base.where(AdminAuditLog.admin_user_id == admin_user_id)
        count_base = count_base.where(AdminAuditLog.admin_user_id == admin_user_id)
    if target_user_id:
        filt = or_(
            (AdminAuditLog.target_type == "user") & (AdminAuditLog.target_id == target_user_id),
            AdminAuditLog.target_id == target_user_id,
        )
        base = base.where(filt)
        count_base = count_base.where(filt)
    if action:
        base = base.where(AdminAuditLog.action == action)
        count_base = count_base.where(AdminAuditLog.action == action)

    total = (await db.execute(count_base)).scalar() or 0
    offset = (page - 1) * size
    rows = (await db.execute(
        base.order_by(AdminAuditLog.created_at.desc()).offset(offset).limit(size)
    )).all()

    items = [
        {
            "id": log.id,
            "admin_user_id": log.admin_user_id,
            "admin_email": admin_email,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "before": log.before,
            "after": log.after,
            "note": log.note,
            "created_at": log.created_at.isoformat(),
        }
        for log, admin_email in rows
    ]
    return items, total
