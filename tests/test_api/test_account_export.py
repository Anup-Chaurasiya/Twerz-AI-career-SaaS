"""Account export/delete compliance tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.main import create_app
from app.database.session import get_db
from app.dependencies import get_current_user
from app.models.data_request_log import DataRequestLog
from app.models.user import User
from app.models.referral_payout_review import ReferralPayoutReview, ReferralPayoutStatus


@pytest.mark.asyncio
async def test_account_export_persists_data_request_log(client, db_session):
    res = await client.get("/account/export")
    assert res.status_code == 200
    assert "user" in res.json()

    logs = (await db_session.execute(select(DataRequestLog))).scalars().all()
    assert len(logs) == 1
    assert logs[0].action == "export"
    assert logs[0].user_id == "test-user-id"


@pytest.mark.asyncio
async def test_delete_account_resolves_pending_referral_hold(async_engine, db_session):
    referrer = User(
        id="api-del-ref",
        google_id="g-adr",
        email="apideref@test.com",
        name="Ref",
        consent_accepted=True,
    )
    referred = User(
        id="api-del-referred",
        google_id="g-add",
        email="apidelreferred@test.com",
        name="Referred",
        consent_accepted=True,
        referred_by_user_id="api-del-ref",
        referral_bonus_granted=True,
        referral_bonus_status="held",
    )
    review = ReferralPayoutReview(
        referrer_id="api-del-ref",
        referred_id="api-del-referred",
        signals=["ip_match"],
        bonus_amount=2,
        status=ReferralPayoutStatus.PENDING,
    )
    db_session.add_all([referrer, referred, review])
    await db_session.commit()

    app = create_app()
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    async def _override_get_current_user():
        return referrer

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.delete("/account")

    assert res.status_code == 200

    db_session.expire_all()
    referred_row = await db_session.get(User, "api-del-referred")
    assert referred_row is not None
    assert referred_row.referral_bonus_status == "denied"

    referrer_row = await db_session.get(User, "api-del-ref")
    assert referrer_row is None
