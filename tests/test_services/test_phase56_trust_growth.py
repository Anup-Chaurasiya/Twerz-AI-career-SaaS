"""Phase 5–6 unit/API coverage: fit breakdown, roast views, Pro gates, attribution."""

from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import select

from app.models.credit import UserCredit, TimePassTier, CreditTransaction, TransactionType
from app.models.job import Job, JobStatus
from app.models.profile import Profile, ProfileStatus
from app.models.roast import Roast, RoastStatus
from app.models.roast_view import RoastView
from app.models.subscription import SubscriptionPlan, UserSubscription
from app.models.user import User
from app.schemas.tailor import (
    EvidenceItem,
    EvidenceMap,
    EvidenceSupport,
    JDAnalysis,
)
from app.services.credit.service import CreditService
from app.services.job.tailor_pipeline import (
    build_fit_score_breakdown,
    compute_fit_verdict,
    evidence_counts_from_map,
)


def test_fit_score_breakdown_matches_compute_fit_verdict():
    jd = JDAnalysis(
        role_title="Full Stack Engineer",
        role_family="Full-Stack",
        seniority="mid",
        must_haves=["React", "Node.js", "PostgreSQL", "GraphQL"],
        keywords=["React"],
        responsibilities=["Ship features"],
        summary="Full-stack product engineer",
    )
    evidence = EvidenceMap(
        items=[
            EvidenceItem(requirement="React", support=EvidenceSupport.SUPPORTED),
            EvidenceItem(requirement="Node.js", support=EvidenceSupport.SUPPORTED),
            EvidenceItem(requirement="PostgreSQL", support=EvidenceSupport.PARTIAL),
            EvidenceItem(requirement="GraphQL", support=EvidenceSupport.MISSING),
        ],
        candidate_seniority_estimate="junior",
        gaps=["GraphQL"],
    )
    verdict = compute_fit_verdict(jd, evidence)
    breakdown = build_fit_score_breakdown(jd, evidence)

    assert breakdown["final_score"] == verdict.fit_score
    assert breakdown["weights"]["SUPPORTED"] == 1.0
    assert breakdown["weights"]["PARTIAL"] == 0.55
    assert breakdown["weights"]["MISSING"] == 0.0
    assert breakdown["seniority"]["penalty"] == 8  # mid vs junior
    assert breakdown["counts"]["supported"] == 2
    assert breakdown["counts"]["partial"] == 1
    assert breakdown["counts"]["missing"] == 1
    # coverage: (1+1+0.55+0)/4 = 0.6375 → 64; minus 8 = 56
    assert breakdown["coverage_score"] == 64
    assert breakdown["raw_score"] == 56
    assert breakdown["final_score"] == 56


def test_evidence_counts_from_map():
    em = EvidenceMap(
        items=[
            EvidenceItem(requirement="A", support=EvidenceSupport.SUPPORTED),
            EvidenceItem(requirement="B", support=EvidenceSupport.PARTIAL),
            EvidenceItem(requirement="C", support=EvidenceSupport.MISSING),
        ]
    )
    counts = evidence_counts_from_map(em)
    assert counts == {"supported": 1, "partial": 1, "missing": 1}


@pytest.mark.asyncio
async def test_shared_roast_creates_roast_view(client, async_engine, test_user):
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as db:
        roast = Roast(
            user_id=test_user.id,
            file_hash="abc123hash",
            share_id="sharetest01",
            status=RoastStatus.READY,
            roast_data={"score": 42, "headline": "Meh", "verdict": "ok", "roast_points": []},
        )
        db.add(roast)
        await db.commit()

    res = await client.get(
        "/roasts/shared/sharetest01",
        headers={"User-Agent": "Mozilla/5.0 Chrome/120.0", "Referer": "https://twitter.com"},
    )
    assert res.status_code == 200
    assert res.json()["share_id"] == "sharetest01"

    async with session_factory() as db:
        views = (await db.execute(select(RoastView).where(RoastView.share_id == "sharetest01"))).scalars().all()
        assert len(views) == 1
        assert views[0].browser == "Chrome"


@pytest.mark.asyncio
async def test_signup_source_set_once(client, async_engine, test_user):
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

    res1 = await client.post("/auth/attribution", json={"source": "roast_share", "share_id": "abc"})
    assert res1.status_code == 200
    assert res1.json()["updated"] is True
    assert res1.json()["signup_source"] == "roast_share"

    res2 = await client.post("/auth/attribution", json={"source": "other", "share_id": "zzz"})
    assert res2.status_code == 200
    assert res2.json()["updated"] is False
    assert res2.json()["signup_source"] == "roast_share"
    assert res2.json()["signup_share_id"] == "abc"

    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as db:
        user = await db.get(User, test_user.id)
        assert user.signup_source == "roast_share"
        assert user.signup_share_id == "abc"


@pytest.mark.asyncio
async def test_onboarding_complete(client, async_engine, test_user):
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

    assert test_user.onboarding_completed is False
    res = await client.post("/auth/onboarding-complete")
    assert res.status_code == 200
    assert res.json()["onboarding_completed"] is True

    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as db:
        user = await db.get(User, test_user.id)
        assert user.onboarding_completed is True


@pytest.mark.asyncio
async def test_interview_packet_gated_without_pro(client, async_engine, test_user):
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as db:
        profile = Profile(
            user_id=test_user.id,
            status=ProfileStatus.READY,
            resume_info={"name": "T", "email": "t@e.com"},
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        job = Job(
            user_id=test_user.id,
            profile_id=profile.id,
            job_description={"company": "X", "role": "Y", "description": "Z" * 30},
            status=JobStatus.RESUME_GENERATED,
            custom_resume_data={"name": "T"},
            fit_score=80,
            fit_label="STRONG",
        )
        db.add(job)
        db.add(UserCredit(user_id=test_user.id, balance=5, daily_free_used=0, daily_free_reset_date=datetime.now(timezone.utc).date()))
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    res = await client.post(f"/jobs/{job_id}/interview-packet")
    assert res.status_code == 402
    body = res.json()
    assert "paywall" in body
    assert body["paywall"]["feature"] == "interview_packets"


@pytest.mark.asyncio
async def test_extension_capture_gated_without_pro(client, async_engine, test_user):
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as db:
        profile = Profile(
            user_id=test_user.id,
            status=ProfileStatus.READY,
            resume_info={"name": "T"},
        )
        db.add(profile)
        db.add(UserCredit(user_id=test_user.id, balance=5, daily_free_used=0, daily_free_reset_date=datetime.now(timezone.utc).date()))
        await db.commit()
        await db.refresh(profile)
        profile_id = profile.id

    res = await client.post(
        "/extension/capture-job",
        json={
            "profile_id": profile_id,
            "company": "Acme",
            "role": "Engineer",
            "description": "Build cool products with React and TypeScript every day.",
        },
    )
    assert res.status_code == 402


@pytest.mark.asyncio
async def test_subscription_activate_and_monthly_grant_idempotent(db_session, test_user):
    service = CreditService()
    plan = SubscriptionPlan(
        name="Job Hunt Pro",
        monthly_credits=40,
        price_paise=39900,
        includes_tracker=True,
        includes_interview_packets=True,
        includes_extension=True,
        is_active=True,
    )
    db_session.add(plan)
    await db_session.commit()
    await db_session.refresh(plan)

    sub = await service.activate_subscription(
        db_session,
        test_user.id,
        plan.id,
        razorpay_order_id="order_test_sub_1",
        grant_credits=True,
    )
    await db_session.commit()
    assert sub.credits_last_granted_at is not None

    uc = await service.ensure_user_credit(db_session, test_user.id)
    await db_session.refresh(uc)
    balance_after_activate = uc.balance
    assert balance_after_activate == 40

    # Same calendar month → no second grant
    granted = await service.maybe_grant_subscription_credits(db_session, test_user.id)
    assert granted is False
    await db_session.refresh(uc)
    assert uc.balance == balance_after_activate

    # Simulate previous month
    sub.credits_last_granted_at = datetime.now(timezone.utc) - timedelta(days=40)
    await db_session.commit()
    granted2 = await service.maybe_grant_subscription_credits(db_session, test_user.id)
    assert granted2 is True
    await db_session.refresh(uc)
    assert uc.balance == balance_after_activate + 40

    # Idempotent again same month
    granted3 = await service.maybe_grant_subscription_credits(db_session, test_user.id)
    assert granted3 is False


@pytest.mark.asyncio
async def test_payment_verify_subscription(client, async_engine, test_user):
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as db:
        plan = SubscriptionPlan(
            name="Job Hunt Pro",
            monthly_credits=40,
            price_paise=39900,
            is_active=True,
        )
        db.add(plan)
        db.add(UserCredit(user_id=test_user.id, balance=0, daily_free_used=0, daily_free_reset_date=datetime.now(timezone.utc).date()))
        await db.commit()
        await db.refresh(plan)
        plan_id = plan.id

    mock_rzp = MagicMock()
    mock_rzp.verify_payment.return_value = True
    mock_rzp.fetch_order.return_value = {
        "notes": {
            "type": "subscription",
            "plan_id": str(plan_id),
            "user_id": test_user.id,
        }
    }

    with patch("app.api.payments.RazorpayService", return_value=mock_rzp):
        res = await client.post(
            "/payments/verify",
            json={
                "razorpay_order_id": "order_sub_xyz",
                "razorpay_payment_id": "pay_sub_xyz",
                "razorpay_signature": "sig",
            },
        )
    assert res.status_code == 200
    assert res.json()["status"] == "success"

    async with session_factory() as db:
        subs = (
            await db.execute(
                select(UserSubscription).where(UserSubscription.user_id == test_user.id)
            )
        ).scalars().all()
        assert len(subs) == 1
        assert subs[0].razorpay_order_id == "order_sub_xyz"
        uc = (
            await db.execute(select(UserCredit).where(UserCredit.user_id == test_user.id))
        ).scalar_one()
        assert uc.balance == 40


@pytest.mark.asyncio
async def test_job_detail_includes_fit_breakdown(client, async_engine, test_user):
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as db:
        profile = Profile(
            user_id=test_user.id,
            status=ProfileStatus.READY,
            resume_info={"name": "T"},
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        job = Job(
            user_id=test_user.id,
            profile_id=profile.id,
            job_description={"company": "X", "role": "Y", "description": "desc"},
            status=JobStatus.PENDING,
            fit_score=56,
            fit_label="STRETCH",
            jd_analysis={
                "role_title": "Eng",
                "role_family": "Full-Stack",
                "seniority": "mid",
                "must_haves": ["React", "Node.js", "PostgreSQL", "GraphQL"],
                "keywords": [],
                "responsibilities": [],
                "summary": "x",
            },
            evidence_map={
                "items": [
                    {"requirement": "React", "support": "SUPPORTED"},
                    {"requirement": "Node.js", "support": "SUPPORTED"},
                    {"requirement": "PostgreSQL", "support": "PARTIAL"},
                    {"requirement": "GraphQL", "support": "MISSING"},
                ],
                "candidate_seniority_estimate": "junior",
                "gaps": ["GraphQL"],
            },
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    res = await client.get(f"/jobs/{job_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["fit_score_breakdown"] is not None
    assert data["fit_score_breakdown"]["final_score"] == data["fit_score"]
    assert data["evidence_counts"]["supported"] == 2

    list_res = await client.get("/jobs/")
    assert list_res.status_code == 200
    item = list_res.json()["items"][0]
    assert item["evidence_counts"]["missing"] == 1
