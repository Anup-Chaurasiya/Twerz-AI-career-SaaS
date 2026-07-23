"""Phase 3 — Referral & Warm-Intro Assist tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.job.tailor_pipeline import TailorPipeline


@pytest.mark.asyncio
async def test_pipeline_generate_outreach_message():
    evidence_map = {
        "items": [
            {"requirement": "Python", "support": "SUPPORTED"},
            {"requirement": "Okta", "support": "MISSING"},
        ],
        "gaps": ["Okta"],
    }

    with patch("app.services.job.tailor_pipeline.LLMInference") as mock_cls:
        mock_llm = AsyncMock()
        mock_llm.run_inference.return_value = (
            "Hi John, I saw the Senior Engineer role at Acme and would love a referral!"
        )
        mock_cls.return_value = mock_llm

        pipeline = TailorPipeline()
        msg = await pipeline.generate_outreach_message(
            profile_info={"name": "Alice"},
            job_description={"role": "Engineer", "company": "Acme"},
            evidence_map=evidence_map,
            contact_info={"name": "John", "relationship": "Ex-colleague"},
            outreach_type="known_contact",
        )

    assert "John" in msg or "Acme" in msg or "referral" in msg
    assert "okta" not in msg.lower()


@pytest.mark.asyncio
async def test_job_service_generate_outreach_no_evidence_raises():
    from app.services.job.service import JobService

    svc = JobService.__new__(JobService)

    mock_job = MagicMock()
    mock_job.evidence_map = None

    svc._get_job = AsyncMock(return_value=mock_job)

    db = AsyncMock()
    with pytest.raises(ValueError, match="needs evidence map"):
        await svc.generate_outreach_message(db, job_id=1, user_id="user1")


@pytest.mark.asyncio
async def test_job_service_update_contacts_and_applied_via():
    from app.services.job.service import JobService

    svc = JobService.__new__(JobService)

    mock_job = MagicMock()
    mock_job.known_contacts = []
    mock_job.applied_via = None
    svc._get_job = AsyncMock(return_value=mock_job)

    db = AsyncMock()
    contacts = [{"name": "Jane", "relationship": "Alumni"}]

    res = await svc.update_known_contacts(db, job_id=1, user_id="user1", contacts=contacts)
    assert res.known_contacts == contacts

    res = await svc.update_application_status(
        db, job_id=1, user_id="user1", application_status="APPLIED", applied_via="referral"
    )
    assert res.applied_via == "referral"
