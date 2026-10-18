import pytest
from datetime import date
from unittest.mock import AsyncMock, patch

from app.models.job import Job, JobStatus, FitAnalysisStatus
from app.models.profile import Profile, ProfileStatus
from app.models.credit import UserCredit


async def _seed_job(db_session, test_user, *, fit_label: str | None, fit_score: int | None):
    profile = Profile(
        user_id=test_user.id,
        status=ProfileStatus.READY,
        resume_info={"name": "Test", "email": "t@example.com", "past_experience": []},
    )
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(profile)

    job = Job(
        user_id=test_user.id,
        profile_id=profile.id,
        job_description={
            "company": "Acme",
            "role": "Engineer",
            "description": "Build things",
            "output_language": "english",
        },
        status=JobStatus.PENDING,
        fit_score=fit_score,
        fit_label=fit_label,
        fit_rationale="test",
        gap_list=["Okta"] if fit_label == "MISMATCH" else [],
        fit_analysis_status=FitAnalysisStatus.READY if fit_score is not None else FitAnalysisStatus.NONE,
    )
    db_session.add(job)
    uc = UserCredit(
        user_id=test_user.id,
        balance=5,
        daily_free_used=0,
        daily_free_reset_date=date.today(),
    )
    db_session.add(uc)
    await db_session.commit()
    await db_session.refresh(job)
    return job


@pytest.mark.asyncio
async def test_list_jobs_empty(client):
    response = await client.get("/jobs/")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["page"] == 1
    assert data["pages"] == 1
    assert data["limit"] == 10


@pytest.mark.asyncio
async def test_list_jobs_pagination_params(client):
    response = await client.get("/jobs/?page=2&limit=5")
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 2
    assert data["limit"] == 5
    assert data["items"] == []


@pytest.mark.asyncio
async def test_list_jobs_page_zero_rejected(client):
    response = await client.get("/jobs/?page=0")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_jobs_limit_too_high(client):
    response = await client.get("/jobs/?limit=100")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_generate_resume_mismatch_requires_confirm(client, db_session, test_user):
    job = await _seed_job(db_session, test_user, fit_label="MISMATCH", fit_score=0)
    deduct = AsyncMock(return_value="purchased")
    with patch("app.api.jobs.credit_service.check_and_deduct", deduct):
        with patch("app.api.jobs.create_tracked_task", side_effect=lambda c: c.close()):
            res = await client.post(f"/jobs/{job.id}/generate-resume", json={})
    assert res.status_code == 400
    assert "confirm_low_fit" in res.json()["detail"]
    deduct.assert_not_awaited()


@pytest.mark.asyncio
async def test_generate_resume_mismatch_with_confirm_deducts(client, db_session, test_user):
    job = await _seed_job(db_session, test_user, fit_label="MISMATCH", fit_score=0)
    deduct = AsyncMock(return_value="daily_free")
    with patch("app.api.jobs.credit_service.check_and_deduct", deduct):
        with patch("app.api.jobs.create_tracked_task", side_effect=lambda c: c.close()):
            res = await client.post(
                f"/jobs/{job.id}/generate-resume",
                json={"confirm_low_fit": True},
            )
    assert res.status_code == 202
    assert res.json()["status"] == "GENERATING_RESUME"
    deduct.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_resume_strong_without_confirm(client, db_session, test_user):
    job = await _seed_job(db_session, test_user, fit_label="STRONG", fit_score=88)
    deduct = AsyncMock(return_value="daily_free")
    with patch("app.api.jobs.credit_service.check_and_deduct", deduct):
        with patch("app.api.jobs.create_tracked_task", side_effect=lambda c: c.close()):
            res = await client.post(f"/jobs/{job.id}/generate-resume", json={})
    assert res.status_code == 202
    deduct.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_resume_stretch_requires_confirm(client, db_session, test_user):
    job = await _seed_job(db_session, test_user, fit_label="STRETCH", fit_score=55)
    deduct = AsyncMock(return_value="purchased")
    with patch("app.api.jobs.credit_service.check_and_deduct", deduct):
        with patch("app.api.jobs.create_tracked_task", side_effect=lambda c: c.close()):
            res = await client.post(f"/jobs/{job.id}/generate-resume", json={"confirm_low_fit": False})
    assert res.status_code == 400
    deduct.assert_not_awaited()
