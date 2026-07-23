"""OAuth CSRF protection tests."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession, create_async_engine

from app.main import create_app
from app.database.session import get_db
from app.models.base import Base
from app.models import user  # noqa: F401
from app.services.auth import google_oauth
from app.services.auth.google_oauth import OAUTH_CSRF_COOKIE


@pytest.mark.asyncio
async def test_google_login_sets_csrf_cookie():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    app = create_app()
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/auth/google/login")
        assert res.status_code == 200
        assert OAUTH_CSRF_COOKIE in res.cookies
        assert res.cookies[OAUTH_CSRF_COOKIE]

    await engine.dispose()


@pytest.mark.asyncio
async def test_oauth_callback_rejects_csrf_mismatch():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    app = create_app()
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    state = google_oauth.encode_oauth_state(ref="ref123", csrf="expected-csrf")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(
            "/auth/google/callback",
            params={"code": "unused", "state": state},
            cookies={OAUTH_CSRF_COOKIE: "wrong-csrf"},
        )
        assert res.status_code == 401
        assert res.json()["detail"] == "Invalid OAuth state"

    await engine.dispose()
