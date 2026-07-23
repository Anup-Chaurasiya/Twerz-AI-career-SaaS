"""Tests for admin public usage endpoint (Phase B)."""

import pytest
from httpx import AsyncClient

from app.models.public_request_log import PublicRequestLog


@pytest.mark.asyncio
async def test_public_usage_endpoint(admin_client: AsyncClient, db_session):
    db_session.add(PublicRequestLog(path="/public/ats-check", ip="10.0.0.1", status_code=200))
    db_session.add(PublicRequestLog(path="/public/ats-check", ip="10.0.0.1", status_code=429))
    await db_session.commit()

    resp = await admin_client.get("/admin/public-usage")
    assert resp.status_code == 200
    data = resp.json()
    assert "24h" in data
    assert "7d" in data
    assert data["24h"]["total_requests"] >= 2
