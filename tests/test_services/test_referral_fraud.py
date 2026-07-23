"""Tests for referral fraud detection (Phase B)."""

import pytest
from sqlalchemy import select

from app.models.user import User
from app.models.referral_flag import ReferralFlag
from app.services.referral.fraud import check_and_flag_referral


@pytest.mark.asyncio
async def test_ip_match_flag(db_session):
    referrer = User(id="ref-1", google_id="g1", email="ref@test.com", name="Ref", consent_accepted=True, signup_ip="1.2.3.4")
    referred = User(id="ref-2", google_id="g2", email="referred@test.com", name="Referred", consent_accepted=True, signup_ip="1.2.3.4")
    db_session.add_all([referrer, referred])
    await db_session.commit()

    signals = await check_and_flag_referral(db_session, referrer_id="ref-1", referred_id="ref-2")
    await db_session.commit()

    assert "ip_match" in signals
    flags = (await db_session.execute(select(ReferralFlag))).scalars().all()
    assert len(flags) == 1
    assert flags[0].signal == "ip_match"


@pytest.mark.asyncio
async def test_no_flag_for_different_ips(db_session):
    referrer = User(id="ref-3", google_id="g3", email="ref3@test.com", name="Ref3", consent_accepted=True, signup_ip="1.2.3.4")
    referred = User(id="ref-4", google_id="g4", email="ref4@test.com", name="Referred4", consent_accepted=True, signup_ip="5.6.7.8")
    db_session.add_all([referrer, referred])
    await db_session.commit()

    signals = await check_and_flag_referral(db_session, referrer_id="ref-3", referred_id="ref-4")
    assert signals == []
