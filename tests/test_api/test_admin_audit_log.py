"""Tests for admin audit log (Phase A)."""

from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.admin_audit_log import AdminAuditLog
from app.models.user import User
from app.models.credit import UserCredit


@pytest.mark.asyncio
async def test_credit_grant_creates_audit_log(admin_client: AsyncClient, db_session, super_admin_user):
    target = User(
        id="audit-target-id",
        google_id="google-audit",
        email="audit@example.com",
        name="Audit Target",
        consent_accepted=True,
    )
    db_session.add(target)
    db_session.add(UserCredit(
        user_id=target.id, balance=0,
        daily_free_reset_date=datetime.now(timezone.utc).date(),
    ))
    await db_session.commit()

    resp = await admin_client.post("/admin/credits/grant", json={
        "user_id": target.id,
        "amount": 10,
        "description": "Test audit grant",
    })
    assert resp.status_code == 200

    logs = (await db_session.execute(
        select(AdminAuditLog).where(AdminAuditLog.action == "credit_grant")
    )).scalars().all()
    assert len(logs) == 1
    assert logs[0].admin_user_id == super_admin_user.id
    assert logs[0].target_type == "user"
    assert logs[0].target_id == target.id
    assert logs[0].after["amount"] == 10


@pytest.mark.asyncio
async def test_tenant_create_creates_audit_log(admin_client: AsyncClient, db_session):
    resp = await admin_client.post("/admin/tenants", json={"name": "Audit Test Tenant"})
    assert resp.status_code == 201

    logs = (await db_session.execute(
        select(AdminAuditLog).where(AdminAuditLog.action == "tenant_create")
    )).scalars().all()
    assert len(logs) == 1
    assert logs[0].after["name"] == "Audit Test Tenant"


@pytest.mark.asyncio
async def test_audit_log_list_endpoint(admin_client: AsyncClient, db_session, super_admin_user):
    await admin_client.post("/admin/tenants", json={"name": "List Test Tenant"})

    resp = await admin_client.get("/admin/audit-log")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["total"] >= 1
    assert any(item["action"] == "tenant_create" for item in data["items"])
