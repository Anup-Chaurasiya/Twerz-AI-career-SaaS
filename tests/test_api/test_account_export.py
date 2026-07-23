"""Account export/delete compliance tests."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models.data_request_log import DataRequestLog


@pytest.mark.asyncio
async def test_account_export_persists_data_request_log(client, db_session):
    res = await client.get("/account/export")
    assert res.status_code == 200
    assert "user" in res.json()

    logs = (await db_session.execute(select(DataRequestLog))).scalars().all()
    assert len(logs) == 1
    assert logs[0].action == "export"
    assert logs[0].user_id == "test-user-id"
