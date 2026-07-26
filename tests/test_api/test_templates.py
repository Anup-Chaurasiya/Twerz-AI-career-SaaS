"""API tests for resume template endpoints."""

import pytest


@pytest.mark.asyncio
async def test_list_resume_templates(client):
    res = await client.get("/templates/resume")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    ids = {t["id"] for t in data}
    assert "classic" in ids
    assert "modern_two_col" in ids
    tradeoff = next(t for t in data if t["id"] == "modern_two_col")
    assert tradeoff["ats_tier"] == "tradeoff"
    assert tradeoff.get("ats_warning")
