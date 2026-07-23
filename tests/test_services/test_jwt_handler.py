import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.services.auth.jwt_handler import create_access_token, verify_token
from app.exceptions import AuthenticationError


def test_create_and_verify_token():
    token = create_access_token("user-123", "user@example.com")
    payload = verify_token(token)
    assert payload["sub"] == "user-123"
    assert payload["email"] == "user@example.com"


def test_verify_invalid_token():
    with pytest.raises(AuthenticationError, match="token_invalid"):
        verify_token("invalid-token-string")


def test_verify_expired_token():
    with patch("app.services.auth.jwt_handler.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2020, 1, 1, tzinfo=timezone.utc)
        token = create_access_token("user-123", "user@example.com")
    with pytest.raises(AuthenticationError, match="token_expired"):
        verify_token(token)
