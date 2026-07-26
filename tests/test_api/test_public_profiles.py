import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from unittest.mock import AsyncMock, patch

from app.models.base import Base
from app.models import user, profile, job, token_usage, tenant, roast, roast_view, credit  # noqa: F401
from app.models import admin_audit_log, referral_flag, referral_payout_review, public_request_log  # noqa: F401
from app.main import create_app
from app.database.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.profile import Profile, ProfileStatus
from app.services.auth.jwt_handler import create_guest_token


@pytest_asyncio.fixture
async def public_client(async_engine):
    app = create_app()
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def auth_client(async_engine, test_user):
    app = create_app()
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    async def _override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def _minimal_pdf() -> bytes:
    return b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>startxref\n180\n%%EOF"


@pytest.mark.asyncio
async def test_guest_upload_creates_unclaimed_profile(public_client, db_session):
    response = await public_client.post(
        "/public/profile-upload",
        files={"file": ("resume.pdf", _minimal_pdf(), "application/pdf")},
    )
    assert response.status_code == 202
    data = response.json()
    assert data["profile_id"] > 0
    assert data["guest_token"]
    assert data["status"] == "PENDING"
    assert data["expires_in_hours"] == 72

    profile_row = await db_session.get(Profile, data["profile_id"])
    assert profile_row is not None
    assert profile_row.user_id is None
    assert profile_row.guest_expires_at is not None
    assert profile_row.guest_ip is not None


@pytest.mark.asyncio
async def test_guest_status_requires_valid_token(public_client, db_session):
    guest = Profile(
        user_id=None,
        status=ProfileStatus.READY,
        guest_ip="127.0.0.1",
        resume_info={"name": "Jane Doe", "past_experience": [], "skills": []},
    )
    db_session.add(guest)
    await db_session.commit()
    await db_session.refresh(guest)
    token = create_guest_token(guest.id)

    ok = await public_client.get(
        f"/public/profiles/{guest.id}/status",
        headers={"X-Guest-Token": token},
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "READY"

    bad = await public_client.get(
        f"/public/profiles/{guest.id}/status",
        headers={"X-Guest-Token": "invalid.token.here"},
    )
    assert bad.status_code == 401


@pytest.mark.asyncio
async def test_guest_preview_teaser_only(public_client, db_session):
    guest = Profile(
        user_id=None,
        status=ProfileStatus.READY,
        guest_ip="127.0.0.1",
        source_filename="resume.pdf",
        resume_info={
            "name": "Jane Doe",
            "title": "Engineer",
            "past_experience": [{"role": "Dev"}],
            "skills": [{"name": "Python", "category": "Languages"}],
            "email": "secret@example.com",
        },
    )
    db_session.add(guest)
    await db_session.commit()
    await db_session.refresh(guest)
    token = create_guest_token(guest.id)

    response = await public_client.get(
        f"/public/profiles/{guest.id}/preview",
        headers={"X-Guest-Token": token},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Jane Doe"
    assert body["experience_count"] == 1
    assert "email" not in body
    assert "resume_info" not in body


@pytest.mark.asyncio
async def test_claim_guest_profile_binds_user(auth_client, db_session, test_user):
    guest = Profile(
        user_id=None,
        status=ProfileStatus.READY,
        guest_ip="127.0.0.1",
        resume_info={"name": "Jane Doe"},
    )
    db_session.add(guest)
    await db_session.commit()
    await db_session.refresh(guest)
    token = create_guest_token(guest.id)

    response = await auth_client.post(
        "/auth/claim-guest-profile",
        json={"guest_token": token},
    )
    assert response.status_code == 200
    assert response.json()["profile_id"] == guest.id

    await db_session.refresh(guest)
    assert guest.user_id == test_user.id
    assert guest.claimed_at is not None


@pytest.mark.asyncio
async def test_claim_guest_profile_idempotent(auth_client, db_session, test_user):
    guest = Profile(
        user_id=test_user.id,
        status=ProfileStatus.READY,
        guest_ip=None,
        resume_info={"name": "Jane Doe"},
    )
    db_session.add(guest)
    await db_session.commit()
    await db_session.refresh(guest)
    token = create_guest_token(guest.id)

    response = await auth_client.post(
        "/auth/claim-guest-profile",
        json={"guest_token": token},
    )
    assert response.status_code == 200
    assert response.json()["profile_id"] == guest.id


@pytest.mark.asyncio
async def test_authenticated_routes_reject_unclaimed_guest(client, db_session):
    guest = Profile(
        user_id=None,
        status=ProfileStatus.READY,
        guest_ip="127.0.0.1",
        resume_info={"name": "Ghost"},
    )
    db_session.add(guest)
    await db_session.commit()
    await db_session.refresh(guest)

    response = await client.get(f"/profiles/{guest.id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_guest_upload_rejects_non_pdf(public_client):
    response = await public_client.post(
        "/public/profile-upload",
        files={"file": ("resume.txt", b"hello world", "text/plain")},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_public_ats_check_uses_pdf_text_extraction(public_client):
    mock_result = {
        "headline": "Needs work",
        "roast_points": [{"emoji": "📄", "text": "Sparse content"}],
        "actual_feedback": "Add more detail.",
        "score": 4,
        "verdict": "Room to improve",
        "ats_checklist": [
            {
                "label": "Contact Information",
                "passed": False,
                "detail": "Missing contact block.",
                "category": "content",
            }
        ],
    }
    with patch("app.api.public.LLMInference") as mock_llm_cls:
        mock_llm = AsyncMock()
        mock_llm.run_inference.return_value = mock_result
        mock_llm_cls.return_value = mock_llm

        response = await public_client.post(
            "/public/ats-check",
            files={"file": ("resume.pdf", _minimal_pdf(), "application/pdf")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["passed_count"] == 0
    assert body["total_checks"] == 1
    assert body["score_estimate"] == 0
    assert "cta" in body
    mock_llm.run_inference.assert_awaited_once()
