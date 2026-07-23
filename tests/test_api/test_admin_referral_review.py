"""API tests for referral approve/reject endpoints."""

from datetime import datetime, timezone

import pytest
from httpx import AsyncClient

from app.models.user import User
from app.models.referral_payout_review import ReferralPayoutReview, ReferralPayoutStatus
from app.models.credit import CreditTransaction


@pytest.mark.asyncio
async def test_admin_approve_referral_payout(admin_client: AsyncClient, db_session, super_admin_user):
    referrer = User(id="api-ref", google_id="g-api-r", email="apiref@test.com", name="R", consent_accepted=True)
    referred = User(
        id="api-referred", google_id="g-api-d", email="apireferred@test.com", name="D",
        consent_accepted=True, referred_by_user_id="api-ref",
        referral_bonus_granted=True, referral_bonus_status="held",
    )
    db_session.add_all([referrer, referred])
    review = ReferralPayoutReview(
        referrer_id="api-ref", referred_id="api-referred",
        signals=["ip_match"], bonus_amount=2, status=ReferralPayoutStatus.PENDING,
    )
    db_session.add(review)
    await db_session.commit()

    resp = await admin_client.post(f"/admin/referrals/{review.id}/approve")
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"

    txns = (await db_session.execute(
        __import__("sqlalchemy").select(CreditTransaction)
    )).scalars().all()
    assert len(txns) == 2
