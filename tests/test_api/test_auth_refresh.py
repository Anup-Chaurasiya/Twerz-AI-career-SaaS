import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.main import create_app
from app.database.session import get_db
from app.services.auth.jwt_handler import create_access_token
from app.services.auth.refresh_tokens import REFRESH_TOKEN_COOKIE, create_refresh_token


@pytest.mark.asyncio
async def test_refresh_issues_new_access_token(async_engine, test_user):
    app = create_app()
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    async with session_factory() as session:
        refresh_raw = await create_refresh_token(session, test_user.id)
        await session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/auth/refresh",
            cookies={REFRESH_TOKEN_COOKIE: refresh_raw},
        )
        assert res.status_code == 200
        body = res.json()
        assert "access_token" in body
        assert REFRESH_TOKEN_COOKIE in res.cookies
        assert res.cookies[REFRESH_TOKEN_COOKIE] != refresh_raw


@pytest.mark.asyncio
async def test_refresh_without_cookie_fails(async_engine):
    app = create_app()
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/auth/refresh")
        assert res.status_code == 401
        assert res.json()["detail"] == "refresh_token_invalid"


@pytest.mark.asyncio
async def test_logout_clears_refresh_session(async_engine, test_user):
    app = create_app()
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    async with session_factory() as session:
        refresh_raw = await create_refresh_token(session, test_user.id)
        await session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/auth/logout",
            cookies={REFRESH_TOKEN_COOKIE: refresh_raw},
        )
        assert res.status_code == 200
        assert res.json()["success"] is True

        res2 = await client.post(
            "/auth/refresh",
            cookies={REFRESH_TOKEN_COOKIE: refresh_raw},
        )
        assert res2.status_code == 401


@pytest.mark.asyncio
async def test_expired_access_token_rejected(async_engine, test_user):
    from datetime import datetime, timezone
    from unittest.mock import patch

    app = create_app()
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    with patch("app.services.auth.jwt_handler.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2020, 1, 1, tzinfo=timezone.utc)
        expired = create_access_token(test_user.id, test_user.email)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
        assert res.status_code == 401
        assert res.json()["detail"] == "token_expired"
