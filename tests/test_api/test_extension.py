"""Extension API: Apply Assist endpoints."""

from datetime import date, datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.credit import UserCredit
from app.models.job import Job, JobStatus
from app.models.profile import Profile, ProfileStatus
from app.models.subscription import SubscriptionPlan, UserSubscription
from app.services.extension.form_answers import build_form_answers
from app.services.extension.helpers import extract_posting_key, urls_match
from app.services.extension.scam_check import assess_listing_risk


async def _seed_pro_user(session_factory, test_user):
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
        db.add(
            UserCredit(
                user_id=test_user.id,
                balance=50,
                daily_free_used=0,
                daily_free_reset_date=date.today(),
            )
        )
        profile = Profile(
            user_id=test_user.id,
            status=ProfileStatus.READY,
            resume_info={"name": "Alex Dev"},
        )
        db.add(profile)
        await db.commit()
        await db.refresh(plan)
        await db.refresh(profile)
        sub = UserSubscription(
            user_id=test_user.id,
            plan_id=plan.id,
            starts_at=datetime.now(timezone.utc),
            is_active=True,
            expires_at=datetime.now(timezone.utc).replace(year=datetime.now(timezone.utc).year + 1),
        )
        db.add(sub)
        await db.commit()
        return profile.id


@pytest.mark.asyncio
async def test_extension_me_returns_profiles(client, async_engine, test_user):
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    profile_id = await _seed_pro_user(session_factory, test_user)

    res = await client.get("/extension/me")
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == test_user.email
    assert body["has_pro_access"] is True
    assert any(p["id"] == profile_id for p in body["profiles"])


@pytest.mark.asyncio
async def test_extension_apply_context_and_form_answers(client, async_engine, test_user):
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    profile_id = await _seed_pro_user(session_factory, test_user)

    async with session_factory() as db:
        job = Job(
            user_id=test_user.id,
            profile_id=profile_id,
            job_description={
                "company": "Acme",
                "role": "Engineer",
                "description": "Build products with Python.",
                "source_url": "https://boards.greenhouse.io/acme/jobs/123",
            },
            status=JobStatus.READY,
            custom_resume_data={
                "name": "Alex Dev",
                "email": "alex@example.com",
                "summary": "Backend engineer with Python experience.",
            },
            fit_score=82,
            fit_label="STRONG",
            cover_letter="Dear hiring team, I am excited to apply.",
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    match = await client.get(
        "/extension/jobs/match",
        params={"url": "https://boards.greenhouse.io/acme/jobs/123/apply"},
    )
    assert match.status_code == 200
    assert match.json()["job_id"] == job_id

    ctx = await client.get(f"/extension/jobs/{job_id}/apply-context")
    assert ctx.status_code == 200
    data = ctx.json()
    assert data["fit_label"] == "STRONG"
    assert data["cover_letter"].startswith("Dear hiring")
    assert data["requires_override"] is False

    answers = await client.post(
        f"/extension/jobs/{job_id}/form-answers",
        json={
            "questions": [
                {"id": "email", "label": "Email address"},
                {"id": "about", "label": "Tell us about yourself"},
            ],
            "confirm_low_fit": False,
        },
    )
    assert answers.status_code == 200
    payload = answers.json()
    assert payload["answers"]["email"]["value"] == "alex@example.com"
    assert "Backend engineer" in payload["answers"]["about"]["value"]


@pytest.mark.asyncio
async def test_extension_form_answers_blocks_mismatch_without_override(client, async_engine, test_user):
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    profile_id = await _seed_pro_user(session_factory, test_user)

    async with session_factory() as db:
        job = Job(
            user_id=test_user.id,
            profile_id=profile_id,
            job_description={"company": "Acme", "role": "Staff IAM", "description": "Okta SAML required."},
            status=JobStatus.READY,
            custom_resume_data={"name": "Alex Dev"},
            fit_score=35,
            fit_label="MISMATCH",
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    res = await client.post(
        f"/extension/jobs/{job_id}/form-answers",
        json={"questions": [{"id": "email", "label": "Email"}], "confirm_low_fit": False},
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_extension_job_status_and_scam_warnings(client, async_engine, test_user):
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    profile_id = await _seed_pro_user(session_factory, test_user)

    async with session_factory() as db:
        job = Job(
            user_id=test_user.id,
            profile_id=profile_id,
            job_description={
                "company": "Acme",
                "role": "Engineer",
                "description": "Please send SSN and pay a registration fee upfront.",
                "source_url": "https://bit.ly/fake-job",
            },
            status=JobStatus.GENERATING_RESUME,
            fit_score=70,
            fit_label="STRONG",
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    status = await client.get(f"/extension/jobs/{job_id}/status")
    assert status.status_code == 200
    body = status.json()
    assert body["phase"] == "generating"
    assert body["badge_text"] == "…"

    async with session_factory() as db:
        job = await db.get(Job, job_id)
        job.status = JobStatus.READY
        job.custom_resume_data = {"name": "Alex Dev", "email": "alex@example.com"}
        await db.commit()

    ctx = await client.get(f"/extension/jobs/{job_id}/apply-context")
    assert ctx.status_code == 200
    risk = ctx.json()["listing_risk"]
    assert risk["risk_level"] == "high"
    assert risk["requires_acknowledgement"] is True
    assert len(risk["warnings"]) >= 1


def test_workday_url_matching():
    jd = "https://company.wd5.myworkdayjobs.com/en-US/Acme/job/Bengaluru/Engineer_R01234"
    apply = "https://company.wd5.myworkdayjobs.com/en-US/Acme/job/Bengaluru/Engineer_R01234/apply"
    assert extract_posting_key(jd) == extract_posting_key(apply)
    assert urls_match(jd, apply)


def test_assess_listing_risk_trusted_greenhouse():
    job = Job(
        user_id="u",
        profile_id=1,
        job_description={
            "company": "Acme",
            "role": "Engineer",
            "description": "Build Python services for our platform.",
            "source_url": "https://boards.greenhouse.io/acme/jobs/123",
        },
    )
    risk = assess_listing_risk(job)
    assert risk["risk_level"] == "low"
    assert risk["warnings"] == []


def test_build_form_answers_skips_eeoc_fields():
    job = Job(
        user_id="u",
        profile_id=1,
        job_description={"company": "Acme", "role": "Engineer", "description": "Python role."},
        custom_resume_data={"name": "Alex Dev", "email": "alex@example.com"},
        fit_label="STRONG",
    )
    result = build_form_answers(
        job,
        [
            {"id": "email", "label": "Email"},
            {"id": "veteran", "label": "Veteran status (optional)"},
        ],
    )
    assert result["answers"]["email"]["value"] == "alex@example.com"
    assert result["answers"]["veteran"]["skip"] is True
