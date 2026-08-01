import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import select

from app.exceptions import AuthenticationError
from app.models.refresh_token import RefreshToken
from app.services.auth.refresh_tokens import (
    create_refresh_token,
    hash_refresh_token,
    rotate_refresh_token,
    revoke_refresh_token,
)


@pytest.mark.asyncio
async def test_create_and_rotate_refresh_token(db_session, test_user):
    raw = await create_refresh_token(db_session, test_user.id)
    await db_session.commit()

    new_raw, user = await rotate_refresh_token(db_session, raw)
    await db_session.commit()

    assert user.id == test_user.id
    assert new_raw != raw

    old_hash = hash_refresh_token(raw)
    result = await db_session.execute(select(RefreshToken).where(RefreshToken.token_hash == old_hash))
    old_row = result.scalar_one()
    assert old_row.revoked_at is not None


@pytest.mark.asyncio
async def test_revoked_token_reuse_revokes_family(db_session, test_user):
    raw = await create_refresh_token(db_session, test_user.id)
    await db_session.commit()

    await rotate_refresh_token(db_session, raw)
    await db_session.commit()

    with pytest.raises(AuthenticationError, match="refresh_token_invalid"):
        await rotate_refresh_token(db_session, raw)


@pytest.mark.asyncio
async def test_expired_refresh_token(db_session, test_user):
    raw = await create_refresh_token(db_session, test_user.id)
    token_hash = hash_refresh_token(raw)
    result = await db_session.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    row = result.scalar_one()
    row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    await db_session.commit()

    with pytest.raises(AuthenticationError, match="refresh_token_expired"):
        await rotate_refresh_token(db_session, raw)


@pytest.mark.asyncio
async def test_logout_revokes_token(db_session, test_user):
    raw = await create_refresh_token(db_session, test_user.id)
    await db_session.commit()

    await revoke_refresh_token(db_session, raw)
    await db_session.commit()

    with pytest.raises(AuthenticationError, match="refresh_token_invalid"):
        await rotate_refresh_token(db_session, raw)
