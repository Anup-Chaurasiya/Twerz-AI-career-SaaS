import pytest
from google.genai.errors import ClientError, ServerError

from app.services.chat.gemini_retry import (
    is_retryable_gemini_error,
    user_friendly_gemini_error,
)


def test_retryable_gemini_error():
    assert is_retryable_gemini_error(ServerError(503, {}, None))
    assert is_retryable_gemini_error(ServerError(429, {}, None))
    assert not is_retryable_gemini_error(ClientError(404, {}, None))
    assert not is_retryable_gemini_error(ValueError("nope"))


def test_user_friendly_gemini_error():
    msg = user_friendly_gemini_error(ServerError(503, {}, None))
    assert "temporarily overloaded" in msg

    msg = user_friendly_gemini_error(ClientError(404, {}, None))
    assert "gemini-3-flash-preview" in msg
