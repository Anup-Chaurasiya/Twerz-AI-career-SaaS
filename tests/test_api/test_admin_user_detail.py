"""Tests for admin user detail endpoint (Phase A)."""

from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.user import User
from app.models.job import Job, JobStatus
from app.models.profile import Profile
from app.models.credit import UserCredit, CreditTransaction, TransactionType


@pytest.mark.asyncio
async def test_user_detail_returns_all_sections(admin_client: AsyncClient, db_session, super_admin_user):
    # Create a target user with job and credit data
    target = User(
        id="target-user-id",
        google_id="google-target",
        email="target@example.com",
        name="Target User",
        consent_accepted=True,
        referral_code="REFCODE01",
    )
    db_session.add(target)
    db_session.add(UserCredit(
        user_id=target.id, balance=5, daily_free_used=1,
        daily_free_reset_date=datetime.now(timezone.utc).date(),
    ))
    db_session.add(Profile(user_id=target.id, resume_info={}, is_active=True))
    await db_session.flush()

    profile = (await db_session.execute(
        select(Profile).where(Profile.user_id == target.id)
    )).scalar_one()
    db_session.add(Job(
        user_id=target.id,
        profile_id=profile.id,
        job_description={"title": "Engineer"},
        status=JobStatus.READY,
        fit_score=75,
        fit_label="GOOD",
        ats_score_before=40,
        ats_score_after=72,
    ))
    db_session.add(CreditTransaction(
        user_id=target.id,
        amount=2,
        type=TransactionType.PROMO_CREDIT,
        description="Referral sign-up bonus (+2 credits)",
    ))
    await db_session.commit()

    resp = await admin_client.get(f"/admin/users/{target.id}/detail")
    assert resp.status_code == 200
    data = resp.json()

    assert "account" in data
    assert data["account"]["email"] == "target@example.com"
    assert "jobs" in data and len(data["jobs"]) == 1
    assert data["jobs"][0]["fit_score"] == 75
    assert "referrals" in data
    assert data["referrals"]["referral_code"] == "REFCODE01"
    assert "credits" in data
    assert data["credits"]["balance"] == 5
    assert "financials" in data
    assert "failures" in data
    assert "roasts" in data


@pytest.mark.asyncio
async def test_user_detail_not_found(admin_client: AsyncClient):
    resp = await admin_client.get("/admin/users/nonexistent-id/detail")
    assert resp.status_code == 404
