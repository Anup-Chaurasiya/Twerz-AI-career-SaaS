"""Phase 7 — Reliability, Observability & India Compliance tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.rate_limit import IPRateLimitMiddleware
from app.services.alerting import alert
from app.services.auth import google_oauth


def test_oauth_state_roundtrip():
    state = google_oauth.encode_oauth_state(ref="abc123")
    data = google_oauth.decode_oauth_state(state)
    assert data.get("ref") == "abc123"
    assert data.get("csrf")


def test_dpdp_privacy_notice_endpoint():
    from app.main import create_app

    client = TestClient(create_app())
    res = client.get("/privacy/dpdp")
    assert res.status_code == 200
    data = res.json()
    assert "India DPDP Act" in data["title"]
    assert "grievance_contact" in data["rights"]


@pytest.mark.asyncio
async def test_alert_helper_no_op_when_unconfigured():
    """alert() should complete cleanly even when webhook and sentry DSN are empty strings."""
    await alert("Test simulated warning", level="warning", context={"job_id": 123})


def test_rate_limiter_middleware_unit():
    """Test IPRateLimitMiddleware directly on a dummy FastAPI app with low RPM setting."""
    app = FastAPI()
    app.add_middleware(IPRateLimitMiddleware, public_paths={"/public/"})

    @app.get("/public/check")
    async def dummy():
        return {"status": "ok"}

    client = TestClient(app)

    mock_settings = MagicMock()
    mock_settings.RATE_LIMIT_PUBLIC_RPM = 3
    with patch("app.middleware.redis_rate_limit.get_settings", return_value=mock_settings):
        # 3 allowed
        r1 = client.get("/public/check")
        r2 = client.get("/public/check")
        r3 = client.get("/public/check")
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r3.status_code == 200

        # 4th request should return 429 Rate Limit Exceeded
        r4 = client.get("/public/check")
        assert r4.status_code == 429
        assert "Rate limit exceeded" in r4.json()["detail"]

