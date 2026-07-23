import asyncio
from logging import getLogger
from typing import AsyncGenerator

from google.adk.runners import Runner
from google.genai import types
from google.genai.errors import ClientError, ServerError

logger = getLogger(__name__)

_RETRYABLE_STATUS_CODES = frozenset({429, 500, 503})
_MAX_RETRIES = 4
_BACKOFF_BASE_SECONDS = 2.0


def is_retryable_gemini_error(exc: Exception) -> bool:
    if isinstance(exc, ServerError):
        return exc.code in _RETRYABLE_STATUS_CODES
    return False


def user_friendly_gemini_error(exc: Exception) -> str:
    if isinstance(exc, ServerError) and exc.code == 503:
        return (
            "Gemini is temporarily overloaded. Please wait a moment and try again."
        )
    if isinstance(exc, ClientError) and exc.code == 404:
        return (
            f"Gemini model not found ({exc}). "
            "Set GEMINI_FLASH_MODEL=gemini-3-flash-preview in .env and restart the server."
        )
    if isinstance(exc, ServerError) and exc.code == 429:
        return "Gemini rate limit reached. Please wait a moment and try again."
    return str(exc)


async def run_agent_with_retry(
    runner: Runner,
    *,
    user_id: str,
    session_id: str,
    new_message: types.Content,
    max_retries: int = _MAX_RETRIES,
) -> AsyncGenerator:
    """Run ADK agent with retries on transient Gemini capacity/rate-limit errors."""
    last_exc: Exception | None = None

    for attempt in range(max_retries):
        try:
            async for event in runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=new_message,
            ):
                yield event
            return
        except Exception as exc:
            last_exc = exc
            if not is_retryable_gemini_error(exc) or attempt >= max_retries - 1:
                raise

            wait = _BACKOFF_BASE_SECONDS * (2**attempt)
            logger.warning(
                "Gemini transient error (attempt %s/%s): %s — retrying in %.1fs",
                attempt + 1,
                max_retries,
                exc,
                wait,
            )
            await asyncio.sleep(wait)

    if last_exc:
        raise last_exc
