"""Tests for automatic threshold alerting."""

from datetime import datetime, timedelta, timezone

import pytest
from unittest.mock import AsyncMock, patch

from app.models.job import Job, JobStatus
from app.models.profile import Profile
from app.models.user import User
from app.services.admin.threshold_alerts import maybe_alert_on_error_rate_spike


@pytest.mark.asyncio
async def test_threshold_alert_fires_on_high_error_rate(db_session):
    user = User(id="u1", google_id="g1", email="u1@test.com", name="U1", consent_accepted=True)
    db_session.add(user)
    await db_session.flush()
    profile = Profile(user_id="u1", resume_info={}, is_active=True)
    db_session.add(profile)
    await db_session.flush()

    now = datetime.now(timezone.utc)
    for i in range(4):
        db_session.add(Job(
            user_id="u1", profile_id=profile.id,
            job_description={"t": "x"},
            status=JobStatus.FAILED,
            created_at=now - timedelta(minutes=10),
        ))
    db_session.add(Job(
        user_id="u1", profile_id=profile.id,
        job_description={"t": "x"},
        status=JobStatus.READY,
        created_at=now - timedelta(minutes=5),
    ))
    await db_session.commit()

    with patch("app.services.admin.threshold_alerts.alert", new_callable=AsyncMock) as mock_alert:
        await maybe_alert_on_error_rate_spike(db_session)
        mock_alert.assert_called_once()
        assert "error rate" in mock_alert.call_args[0][0].lower()


@pytest.mark.asyncio
async def test_threshold_alert_silent_below_minimum_jobs(db_session):
    with patch("app.services.admin.threshold_alerts.alert", new_callable=AsyncMock) as mock_alert:
        await maybe_alert_on_error_rate_spike(db_session)
        mock_alert.assert_not_called()
