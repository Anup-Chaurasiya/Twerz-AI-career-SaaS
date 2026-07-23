"""Tests for referral payout hold-before-grant and admin approve/reject."""

from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.user import User
from app.models.referral_payout_review import ReferralPayoutReview, ReferralPayoutStatus
from app.models.credit import UserCredit, CreditTransaction, TransactionType
from app.services.credit.service import CreditService
from app.services.referral.payout import (
    approve_payout_review,
    reject_payout_review,
    resolve_pending_referral_holds_on_user_delete,
)


@pytest.mark.asyncio
async def test_referral_bonus_held_on_ip_match(db_session):
    referrer = User(
        id="hold-ref", google_id="g-hr", email="holdref@test.com", name="Ref",
        consent_accepted=True, signup_ip="9.9.9.9", referral_code="HOLDREF1",
    )
    referred = User(
        id="hold-referred", google_id="g-hd", email="holdreferred@test.com", name="Referred",
        consent_accepted=True, signup_ip="9.9.9.9", referred_by_user_id="hold-ref",
    )
    db_session.add_all([referrer, referred])
    db_session.add(UserCredit(user_id="hold-ref", balance=0, daily_free_reset_date=datetime.now(timezone.utc).date()))
    db_session.add(UserCredit(user_id="hold-referred", balance=0, daily_free_reset_date=datetime.now(timezone.utc).date()))
    await db_session.commit()

    svc = CreditService()
    granted = await svc.grant_referral_bonus_if_eligible(db_session, "hold-referred")
    assert granted is False

    await db_session.refresh(referred)
    assert referred.referral_bonus_status == "held"

    review = (await db_session.execute(
        select(ReferralPayoutReview).where(ReferralPayoutReview.referred_id == "hold-referred")
    )).scalar_one()
    assert review.status == ReferralPayoutStatus.PENDING
    assert "ip_match" in review.signals

    # No credits moved yet
    txns = (await db_session.execute(select(CreditTransaction))).scalars().all()
    assert len(txns) == 0


@pytest.mark.asyncio
async def test_referral_bonus_granted_when_clean(db_session):
    referrer = User(
        id="clean-ref", google_id="g-cr", email="cleanref@test.com", name="Ref",
        consent_accepted=True, signup_ip="1.1.1.1", referral_code="CLEANREF",
    )
    referred = User(
        id="clean-referred", google_id="g-cd", email="cleanreferred@test.com", name="Referred",
        consent_accepted=True, signup_ip="2.2.2.2", referred_by_user_id="clean-ref",
    )
    db_session.add_all([referrer, referred])
    db_session.add(UserCredit(user_id="clean-ref", balance=0, daily_free_reset_date=datetime.now(timezone.utc).date()))
    db_session.add(UserCredit(user_id="clean-referred", balance=0, daily_free_reset_date=datetime.now(timezone.utc).date()))
    await db_session.commit()

    svc = CreditService()
    granted = await svc.grant_referral_bonus_if_eligible(db_session, "clean-referred")
    assert granted is True

    await db_session.refresh(referred)
    assert referred.referral_bonus_status == "paid"

    txns = (await db_session.execute(select(CreditTransaction))).scalars().all()
    assert len(txns) == 2


@pytest.mark.asyncio
async def test_admin_approve_grants_held_bonus(db_session, super_admin_user):
    referrer = User(
        id="ap-ref", google_id="g-ar", email="apref@test.com", name="Ref",
        consent_accepted=True, signup_ip="9.9.9.9",
    )
    referred = User(
        id="ap-referred", google_id="g-ad", email="apreferred@test.com", name="Referred",
        consent_accepted=True, signup_ip="9.9.9.9", referred_by_user_id="ap-ref",
        referral_bonus_granted=True, referral_bonus_status="held",
    )
    db_session.add_all([referrer, referred])
    db_session.add(UserCredit(user_id="ap-ref", balance=0, daily_free_reset_date=datetime.now(timezone.utc).date()))
    db_session.add(UserCredit(user_id="ap-referred", balance=0, daily_free_reset_date=datetime.now(timezone.utc).date()))
    review = ReferralPayoutReview(
        referrer_id="ap-ref", referred_id="ap-referred",
        signals=["ip_match"], bonus_amount=2, status=ReferralPayoutStatus.PENDING,
    )
    db_session.add(review)
    await db_session.commit()

    await approve_payout_review(db_session, review.id, super_admin_user.id)
    await db_session.commit()

    await db_session.refresh(referred)
    assert referred.referral_bonus_status == "paid"
    txns = (await db_session.execute(select(CreditTransaction))).scalars().all()
    assert len(txns) == 2


@pytest.mark.asyncio
async def test_admin_reject_denies_bonus(db_session, super_admin_user):
    referred = User(
        id="rj-referred", google_id="g-rd", email="rjreferred@test.com", name="Referred",
        consent_accepted=True, referred_by_user_id="rj-ref",
        referral_bonus_granted=True, referral_bonus_status="held",
    )
    referrer = User(
        id="rj-ref", google_id="g-rr", email="rjref@test.com", name="Ref",
        consent_accepted=True,
    )
    db_session.add_all([referrer, referred])
    review = ReferralPayoutReview(
        referrer_id="rj-ref", referred_id="rj-referred",
        signals=["velocity"], bonus_amount=2, status=ReferralPayoutStatus.PENDING,
    )
    db_session.add(review)
    await db_session.commit()

    await reject_payout_review(db_session, review.id, super_admin_user.id)
    await db_session.commit()

    await db_session.refresh(referred)
    assert referred.referral_bonus_status == "denied"
    txns = (await db_session.execute(select(CreditTransaction))).scalars().all()
    assert len(txns) == 0


@pytest.mark.asyncio
async def test_delete_referrer_resolves_held_bonus_for_referred(db_session):
    referrer = User(
        id="del-ref", google_id="g-dr", email="delref@test.com", name="Ref",
        consent_accepted=True,
    )
    referred = User(
        id="del-referred", google_id="g-dd", email="delreferred@test.com", name="Referred",
        consent_accepted=True, referred_by_user_id="del-ref",
        referral_bonus_granted=True, referral_bonus_status="held",
    )
    db_session.add_all([referrer, referred])
    review = ReferralPayoutReview(
        referrer_id="del-ref",
        referred_id="del-referred",
        signals=["ip_match"],
        bonus_amount=2,
        status=ReferralPayoutStatus.PENDING,
    )
    db_session.add(review)
    await db_session.commit()

    await resolve_pending_referral_holds_on_user_delete(db_session, "del-ref")
    await db_session.commit()

    await db_session.refresh(referred)
    await db_session.refresh(review)
    assert referred.referral_bonus_status == "denied"
    assert review.status == ReferralPayoutStatus.REJECTED
