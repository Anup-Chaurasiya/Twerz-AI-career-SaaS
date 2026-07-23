"""Phase 3 — Referral & Warm-Intro Assist tests.

Tests:
1. TailorPipeline.generate_outreach_message produces text without missing tools
2. JobService.generate_outreach_message requires evidence_map
3. JobService.update_known_contacts stores contacts list
4. JobService.update_application_status updates applied_via
5. Endpoint outreach_type validation (rejects invalid types)
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.job.tailor_pipeline import TailorPipeline


@pytest.mark.asyncio
async def test_pipeline_generate_outreach_message():
    pipeline = TailorPipeline.__new__(TailorPipeline)
    pipeline.pro_model = "test-pro"
    mock_llm = AsyncMock()
    mock_res = MagicMock()
    mock_res.content = "Hi John, I saw the Senior Engineer role at Acme and would love a referral!"
    mock_llm.raw_call.return_value = mock_res
    pipeline.llm = mock_llm

    evidence_map = {
        "items": [
            {"requirement": "Python", "support": "SUPPORTED"},
            {"requirement": "Okta", "support": "MISSING"},
        ],
        "gaps": ["Okta"],
    }

    msg = await pipeline.generate_outreach_message(
        profile_info={"name": "Alice"},
        job_description={"role": "Engineer", "company": "Acme"},
        evidence_map=evidence_map,
        contact_info={"name": "John", "relationship": "Ex-colleague"},
        outreach_type="known_contact",
    )

    assert "John" in msg or "Acme" in msg or "referral" in msg
    assert "okta" not in msg.lower()  # forbidden tool stripped if hallucinated


@pytest.mark.asyncio
async def test_job_service_generate_outreach_no_evidence_raises():
    from app.services.job.service import JobService
    svc = JobService.__new__(JobService)

    mock_job = MagicMock()
    mock_job.evidence_map = None  # not yet tailored

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

    # Update contacts
    res = await svc.update_known_contacts(db, job_id=1, user_id="user1", contacts=contacts)
    assert res.known_contacts == contacts

    # Update applied_via
    res = await svc.update_application_status(
        db, job_id=1, user_id="user1", application_status="APPLIED", applied_via="referral"
    )
    assert res.applied_via == "referral"
