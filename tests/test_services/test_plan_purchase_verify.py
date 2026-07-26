"""Temporary verification: purchase → credits → features. Safe to delete after review."""
import pytest
from datetime import date
from unittest.mock import MagicMock, patch, AsyncMock

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.credit import CreditPack, UserCredit
from app.models.job import Job, JobStatus
from app.models.profile import Profile, ProfileStatus
from app.models.subscription import SubscriptionPlan
from app.services.credit.service import CreditService


@pytest.mark.asyncio
async def test_credit_pack_purchase_then_tailor_flow(client, async_engine, test_user):
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as db:
        pack = CreditPack(name="Starter", credits=500, price_paise=27900, is_active=True, sort_order=1)
        db.add(pack)
        db.add(UserCredit(user_id=test_user.id, balance=0, daily_free_used=20, daily_free_reset_date=date.today()))
        profile = Profile(
            user_id=test_user.id,
            status=ProfileStatus.READY,
            resume_info={"name": "T", "email": "t@e.com", "past_experience": []},
        )
        db.add(profile)
        await db.commit()
        await db.refresh(pack)
        await db.refresh(profile)
        pack_id, profile_id = pack.id, profile.id

    mock_rzp = MagicMock()
    mock_rzp.verify_payment.return_value = True
    mock_rzp.fetch_order.return_value = {
        "notes": {"type": "credit_pack", "pack_id": str(pack_id), "user_id": test_user.id}
    }
    with patch("app.api.payments.RazorpayService", return_value=mock_rzp):
        res = await client.post(
            "/payments/verify",
            json={"razorpay_order_id": "order_pack_500", "razorpay_payment_id": "pay_1", "razorpay_signature": "sig"},
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "success"
    assert body["balance"]["balance"] == 500

    res = await client.post(
        "/jobs/",
        json={"profile_id": profile_id, "job_description": {"company": "Acme", "role": "Eng", "description": "Build things"}},
    )
    assert res.status_code == 201, res.text
    job_id = res.json()["job_id"]

    service = CreditService()
    async with session_factory() as db:
        uc = (await db.execute(select(UserCredit).where(UserCredit.user_id == test_user.id))).scalar_one()
        assert uc.balance == 500

    with patch("app.api.jobs.credit_service.check_and_deduct", AsyncMock(return_value="purchased")) as deduct:
        with patch("app.api.jobs.create_tracked_task"):
            async with session_factory() as db:
                job = await db.get(Job, job_id)
                job.fit_label = "STRONG"
                job.fit_score = 85
                await db.commit()
            res = await client.post(f"/jobs/{job_id}/generate-resume", json={})
    assert res.status_code == 202
    deduct.assert_awaited_once()

    async with session_factory() as db:
        await service.check_and_deduct(db, test_user.id, job_id)
        uc = (await db.execute(select(UserCredit).where(UserCredit.user_id == test_user.id))).scalar_one()
        assert uc.balance == 490

    async with session_factory() as db:
        job = await db.get(Job, job_id)
        job.status = JobStatus.RESUME_GENERATED
        job.custom_resume_data = {"name": "T"}
        await db.commit()
    with patch("app.api.jobs.create_tracked_task"):
        res = await client.post(f"/jobs/{job_id}/generate-pdf")
    assert res.status_code == 202

    async with session_factory() as db:
        uc = (await db.execute(select(UserCredit).where(UserCredit.user_id == test_user.id))).scalar_one()
        assert uc.balance == 490


@pytest.mark.asyncio
async def test_starter_pack_unlocks_core_features_not_pro_only(client, async_engine, test_user):
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as db:
        db.add(UserCredit(user_id=test_user.id, balance=100, daily_free_used=0, daily_free_reset_date=date.today()))
        profile = Profile(user_id=test_user.id, status=ProfileStatus.READY, resume_info={"name": "T"})
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
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    with patch("app.services.job.service.JobService.generate_cover_letter", AsyncMock(return_value=job)):
        res = await client.post(f"/jobs/{job_id}/cover-letter")
    assert res.status_code != 402

    with patch("app.services.job.service.JobService.generate_outreach_message", AsyncMock(return_value="Hi")):
        res = await client.post(f"/jobs/{job_id}/outreach-message", json={"outreach_type": "cold_linkedin"})
    assert res.status_code != 402

    res = await client.patch(f"/jobs/{job_id}/application", json={"application_status": "APPLIED", "applied_via": "cold"})
    assert res.status_code == 200

    res = await client.post(f"/jobs/{job_id}/interview-packet")
    assert res.status_code == 402


@pytest.mark.asyncio
async def test_pro_subscription_unlocks_pro_features(client, async_engine, test_user):
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as db:
        plan = SubscriptionPlan(
            name="Job Hunt Pro",
            monthly_credits=800,
            price_paise=29900,
            includes_tracker=True,
            includes_interview_packets=True,
            includes_extension=True,
            is_active=True,
        )
        db.add(plan)
        db.add(UserCredit(user_id=test_user.id, balance=0, daily_free_used=0, daily_free_reset_date=date.today()))
        profile = Profile(user_id=test_user.id, status=ProfileStatus.READY, resume_info={"name": "T"})
        db.add(profile)
        await db.commit()
        await db.refresh(plan)
        await db.refresh(profile)
        plan_id, profile_id = plan.id, profile.id

    mock_rzp = MagicMock()
    mock_rzp.verify_payment.return_value = True
    mock_rzp.fetch_order.return_value = {
        "notes": {"type": "subscription", "plan_id": str(plan_id), "user_id": test_user.id}
    }
    with patch("app.api.payments.RazorpayService", return_value=mock_rzp):
        res = await client.post(
            "/payments/verify",
            json={"razorpay_order_id": "order_pro_1", "razorpay_payment_id": "pay_pro", "razorpay_signature": "sig"},
        )
    assert res.status_code == 200
    assert res.json()["balance"]["balance"] == 800
    assert res.json()["balance"]["subscription"]["active"] is True

    res = await client.post(
        "/extension/capture-job",
        json={
            "profile_id": profile_id,
            "company": "Acme",
            "role": "Engineer",
            "description": "Build cool products with React and TypeScript every day.",
        },
    )
    assert res.status_code == 201

    async with session_factory() as db:
        job = Job(
            user_id=test_user.id,
            profile_id=profile_id,
            job_description={"company": "X", "role": "Y", "description": "Z" * 30},
            status=JobStatus.RESUME_GENERATED,
            custom_resume_data={"name": "T"},
            fit_score=80,
            fit_label="STRONG",
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    with patch("app.services.job.service.JobService.generate_interview_packet", AsyncMock(return_value=job)):
        res = await client.post(f"/jobs/{job_id}/interview-packet")
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_no_credits_blocks_job_create(client, async_engine, test_user):
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as db:
        db.add(UserCredit(user_id=test_user.id, balance=0, daily_free_used=20, daily_free_reset_date=date.today()))
        profile = Profile(user_id=test_user.id, status=ProfileStatus.READY, resume_info={"name": "T"})
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    res = await client.post(
        "/jobs/",
        json={"profile_id": profile.id, "job_description": {"company": "A", "role": "B", "description": "C"}},
    )
    assert res.status_code == 429
