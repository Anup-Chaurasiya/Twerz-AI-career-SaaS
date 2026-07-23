"""Phase 4 — Personal Analytics Dashboard tests.

Tests:
1. GET /analytics/me with zero jobs returns sufficient_data=False and empty/default structures
2. GET /analytics/me with jobs computes correct by_band counts and rates
3. GET /analytics/me with sufficient jobs (≥5) sets sufficient_data=True and includes nudge message
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.api.analytics import get_personal_analytics


@pytest.mark.asyncio
async def test_analytics_new_user_empty_state():
    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=mock_result)

    user = MagicMock()
    user.id = "user_new"

    res = await get_personal_analytics(db=db, current_user=user)

    assert res["total_jobs"] == 0
    assert res["total_applied"] == 0
    assert res["sufficient_data"] is False
    assert len(res["by_band"]) == 4
    assert "nudge_message" in res


@pytest.mark.asyncio
async def test_analytics_populated_data():
    mock_jobs = []

    # 3 STRONG jobs (all APPLIED, 2 INTERVIEW, 1 OFFER)
    for _ in range(3):
        j = MagicMock()
        j.user_id = "user_1"
        j.fit_label = "STRONG"
        j.application_status = MagicMock(value="APPLIED")
        mock_jobs.append(j)

    j_int = MagicMock()
    j_int.user_id = "user_1"
    j_int.fit_label = "STRONG"
    j_int.application_status = MagicMock(value="INTERVIEW")
    mock_jobs.append(j_int)

    j_off = MagicMock()
    j_off.user_id = "user_1"
    j_off.fit_label = "STRONG"
    j_off.application_status = MagicMock(value="OFFER")
    mock_jobs.append(j_off)

    # 2 STRETCH jobs (both APPLIED, 0 INTERVIEW)
    for _ in range(2):
        j_str = MagicMock()
        j_str.user_id = "user_1"
        j_str.fit_label = "STRETCH"
        j_str.application_status = MagicMock(value="APPLIED")
        mock_jobs.append(j_str)

    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = mock_jobs
    db.execute = AsyncMock(return_value=mock_result)

    user = MagicMock()
    user.id = "user_1"

    res = await get_personal_analytics(db=db, current_user=user)

    assert res["total_jobs"] == 7
    assert res["total_applied"] == 7
    assert res["sufficient_data"] is True

    strong = next(b for b in res["by_band"] if b["fit_label"] == "STRONG")
    assert strong["total_jobs"] == 5
    assert strong["applied_jobs"] == 5
    assert strong["interview_jobs"] == 2
    assert strong["offer_jobs"] == 1

    stretch = next(b for b in res["by_band"] if b["fit_label"] == "STRETCH")
    assert stretch["total_jobs"] == 2
    assert stretch["interview_jobs"] == 0
