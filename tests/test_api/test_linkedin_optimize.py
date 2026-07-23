"""Phase 6 — LinkedIn Profile Optimizer tests.

Tests:
1. ProfileService.linkedin_optimize produces valid LinkedInOptimizeResult
2. ProfileService.linkedin_optimize handles empty/no resume_info by raising ValueError
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.profile import LinkedInOptimizeResult


@pytest.mark.asyncio
async def test_linkedin_optimize_service_success():
    from app.services.profile.service import ProfileService
    svc = ProfileService.__new__(ProfileService)

    mock_profile = MagicMock()
    mock_profile.resume_info = {
        "name": "Jane Doe",
        "skills": ["Python", "FastAPI", "Docker"],
        "experiences": [{"title": "Backend Engineer", "company": "Tech Corp"}],
    }
    svc.get_profile = AsyncMock(return_value=mock_profile)

    expected_output = LinkedInOptimizeResult(
        headline="Backend Engineer | Python, FastAPI & Distributed Systems",
        about="Passionate backend engineer building high-performance APIs.",
        skills=["Python", "FastAPI", "Docker"],
    )

    with patch("app.services.profile.service.LLMInference") as mock_llm_cls, patch(
        "app.services.auth.rate_limits.enforce_daily_llm_limit", new=AsyncMock()
    ):
        mock_llm_inst = AsyncMock()
        mock_llm_inst.run_inference.return_value = expected_output
        mock_llm_cls.return_value = mock_llm_inst

        db = AsyncMock()
        res = await svc.linkedin_optimize(db, profile_id=1, user_id="user1")

        assert res["headline"] == "Backend Engineer | Python, FastAPI & Distributed Systems"
        assert len(res["skills"]) == 3
        assert "FastAPI" in res["skills"]


@pytest.mark.asyncio
async def test_linkedin_optimize_empty_resume_raises():
    from app.services.profile.service import ProfileService
    svc = ProfileService.__new__(ProfileService)

    mock_profile = MagicMock()
    mock_profile.resume_info = None

    svc.get_profile = AsyncMock(return_value=mock_profile)

    db = AsyncMock()
    with pytest.raises(ValueError, match="no structured resume data"):
        await svc.linkedin_optimize(db, profile_id=1, user_id="user1")
