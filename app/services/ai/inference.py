import asyncio
import json
import os
import time
from logging import getLogger
from typing import Any, Type

from pydantic import BaseModel, ValidationError
from litellm import acompletion

from app.config import get_settings, is_llm_configured
from app.exceptions import AIInferenceError
from app.services.ai.retry import retry_decor

# If primary model exceeds this, immediately fall back to LLM_PRO_MODEL.
PRIMARY_TIMEOUT_SECONDS = 60

logger = getLogger(__name__)


async def _log_request(
    model_name: str,
    user_id: str | None,
    purpose: str | None,
    reference_id: str | None,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int,
    cached_tokens: int,
    response_time_ms: int,
    success: bool,
    error_message: str | None,
) -> None:
    """Persist an LLMRequest row using an independent DB session.

    Wrapped in try/except so a DB failure never breaks the main flow.
    """
    if not purpose:
        return
    try:
        from app.database.session import async_session_factory
        from app.models.token_usage import LLMRequest

        async with async_session_factory() as db:
            row = LLMRequest(
                user_id=user_id,
                purpose=purpose,
                reference_id=reference_id,
                model_name=model_name,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                cached_tokens=cached_tokens,
                response_time_ms=response_time_ms,
                success=success,
                error_message=error_message,
            )
            db.add(row)
            await db.commit()
    except Exception:
        logger.debug("Failed to persist LLMRequest row", exc_info=True)


def _normalize_content_part(part: Any) -> dict | str:
    """Convert Gemini-style or plain parts into OpenAI/LiteLLM multimodal parts."""
    if isinstance(part, str):
        return {"type": "text", "text": part}

    if not isinstance(part, dict):
        return {"type": "text", "text": str(part)}

    # Already OpenAI-style multimodal
    if part.get("type") in ("text", "image_url"):
        return part

    # Gemini inline_data → data URL
    inline = part.get("inline_data") or part.get("inlineData")
    if isinstance(inline, dict):
        mime = inline.get("mime_type") or inline.get("mimeType") or "image/jpeg"
        data = inline.get("data", "")
        return {
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{data}"},
        }

    if "text" in part:
        return {"type": "text", "text": part["text"]}

    return {"type": "text", "text": json.dumps(part)}


def build_messages(system_prompt: str, inputs: list | None) -> list[dict]:
    """Build LiteLLM/OpenAI chat messages from system prompt + mixed inputs."""
    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    if not inputs:
        return messages

    # Single plain string → simple user message
    if len(inputs) == 1 and isinstance(inputs[0], str):
        messages.append({"role": "user", "content": inputs[0]})
        return messages

    # Mixed text/images → multimodal content array
    content = [_normalize_content_part(p) for p in inputs]
    # Collapse to plain string when everything is text (better provider compat)
    if all(
        isinstance(c, dict) and c.get("type") == "text" for c in content
    ):
        text = "\n".join(c["text"] for c in content)
        messages.append({"role": "user", "content": text})
    else:
        messages.append({"role": "user", "content": content})
    return messages


def _response_text(response: Any) -> str:
    """Extract assistant text from a LiteLLM completion response."""
    try:
        content = response.choices[0].message.content
    except (AttributeError, IndexError, KeyError, TypeError):
        content = None
    if content is None:
        return ""
    if isinstance(content, list):
        # Some providers return multimodal content blocks
        texts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                texts.append(block.get("text", ""))
            elif isinstance(block, str):
                texts.append(block)
        return "".join(texts).strip()
    return str(content).strip()


def _usage_tokens(response: Any) -> tuple[int, int, int, int]:
    usage = getattr(response, "usage", None)
    if usage is None:
        return 0, 0, 0, 0
    input_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
    output_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
    total_tokens = int(getattr(usage, "total_tokens", 0) or (input_tokens + output_tokens))
    details = getattr(usage, "prompt_tokens_details", None)
    cached_tokens = 0
    if details is not None:
        cached_tokens = int(getattr(details, "cached_tokens", 0) or 0)
    return input_tokens, output_tokens, total_tokens, cached_tokens


def _api_key_for_model(model: str) -> str | None:
    """Pick the provider API key for a LiteLLM model string."""
    settings = get_settings()
    # Ensure keys from .env are visible to LiteLLM even if the process
    # started before Settings synced them into os.environ.
    if settings.OPENAI_API_KEY:
        os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
    if settings.ANTHROPIC_API_KEY:
        os.environ["ANTHROPIC_API_KEY"] = settings.ANTHROPIC_API_KEY
    if settings.GEMINI_API_KEY:
        os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

    m = model.lower()
    if m.startswith("openai/") or m.startswith("gpt-"):
        return settings.OPENAI_API_KEY or None
    if m.startswith("anthropic/") or m.startswith("claude"):
        return settings.ANTHROPIC_API_KEY or None
    if m.startswith("gemini/") or m.startswith("vertex_ai/"):
        return settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY or None
    return None


class LLMInference:
    """Provider-agnostic LLM client via LiteLLM (Gemini, OpenAI, Anthropic, …)."""

    def __init__(self, model_name: str | None = None):
        settings = get_settings()
        self.model = model_name or settings.LLM_FLASH_MODEL

    def parse_output(
        self,
        raw_content: str,
        structured_output_schema: Type[BaseModel] | None,
        is_list: bool = False,
    ) -> dict | list[dict] | str:
        json_str = raw_content.strip()
        if json_str.startswith("```json"):
            json_str = json_str[7:]
        elif json_str.startswith("```"):
            json_str = json_str[3:]
        if json_str.endswith("```"):
            json_str = json_str[:-3]
        json_str = json_str.strip()

        if not structured_output_schema:
            return json_str

        parsed_content = json.loads(json_str)
        if is_list:
            if isinstance(parsed_content, dict):
                parsed_content = [parsed_content]
            return [
                structured_output_schema.model_validate(o).model_dump()
                for o in parsed_content
            ]
        return structured_output_schema.model_validate(parsed_content).model_dump()

    async def _call_api(
        self,
        model: str,
        messages: list[dict],
        *,
        temperature: float = 0.1,
        response_format: Any | None = None,
        timeout: int | None = None,
        user_id: str | None = None,
        purpose: str | None = None,
        reference_id: str | None = None,
    ):
        """Single LiteLLM completion with optional timeout."""
        t0 = time.monotonic()
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        api_key = _api_key_for_model(model)
        if api_key:
            kwargs["api_key"] = api_key
        if response_format is not None:
            kwargs["response_format"] = response_format

        try:
            coro = acompletion(**kwargs)
            if timeout:
                response = await asyncio.wait_for(coro, timeout=timeout)
            else:
                response = await coro
        except asyncio.TimeoutError:
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            logger.warning(
                f"TIMEOUT after {elapsed_ms}ms (limit={timeout}s): "
                f"model={model}, purpose={purpose}"
            )
            await _log_request(
                model_name=model, user_id=user_id, purpose=purpose,
                reference_id=reference_id, input_tokens=0, output_tokens=0,
                total_tokens=0, cached_tokens=0, response_time_ms=elapsed_ms,
                success=False, error_message=f"Timeout after {timeout}s",
            )
            raise
        except Exception as exc:
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            await _log_request(
                model_name=model, user_id=user_id, purpose=purpose,
                reference_id=reference_id, input_tokens=0, output_tokens=0,
                total_tokens=0, cached_tokens=0, response_time_ms=elapsed_ms,
                success=False, error_message=str(exc)[:500],
            )
            raise

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        input_tokens, output_tokens, total_tokens, cached_tokens = _usage_tokens(response)

        log_fn = logger.warning if elapsed_ms > 60000 else logger.info
        log_fn(
            f"Inference complete: model={model}, "
            f"tokens={input_tokens}/{output_tokens}/{total_tokens}, "
            f"time={elapsed_ms}ms, purpose={purpose}"
            f"{' (SLOW >60s)' if elapsed_ms > 60000 else ''}"
        )

        await _log_request(
            model_name=model, user_id=user_id, purpose=purpose,
            reference_id=reference_id, input_tokens=input_tokens,
            output_tokens=output_tokens, total_tokens=total_tokens,
            cached_tokens=cached_tokens, response_time_ms=elapsed_ms,
            success=True, error_message=None,
        )

        return response

    @retry_decor(retries=3, backoff_base=1.0)
    async def _call_api_with_retry(
        self,
        model: str,
        messages: list[dict],
        *,
        temperature: float = 0.1,
        response_format: Any | None = None,
        user_id: str | None = None,
        purpose: str | None = None,
        reference_id: str | None = None,
    ):
        """LiteLLM call with retry (no timeout — used for fallback model)."""
        return await self._call_api(
            model,
            messages,
            temperature=temperature,
            response_format=response_format,
            user_id=user_id,
            purpose=purpose,
            reference_id=reference_id,
        )

    async def run_inference(
        self,
        system_prompt: str,
        inputs: list | None = None,
        structured_output_schema: Type[BaseModel] | None = None,
        is_structured_output_list: bool = False,
        temperature: float = 0.1,
        *,
        user_id: str | None = None,
        purpose: str | None = None,
        reference_id: str | None = None,
        thinking_level: str = "LOW",  # kept for call-site compat; unused by LiteLLM
        fallback_model: str | None = None,
        primary_timeout: int | None = PRIMARY_TIMEOUT_SECONDS,
        allow_pro_fallback: bool = True,
    ) -> str | dict | list:
        del thinking_level  # Gemini-specific; not applied via LiteLLM
        if not allow_pro_fallback:
            fallback_model = ""
        elif fallback_model is None:
            fallback_model = get_settings().LLM_PRO_MODEL
        if not is_llm_configured():
            raise AIInferenceError(
                "No LLM API key configured. Set GEMINI_API_KEY, OPENAI_API_KEY, "
                "or ANTHROPIC_API_KEY in your .env file."
            )

        messages = build_messages(system_prompt, inputs)

        response_format: Any | None = None
        if structured_output_schema:
            # Prefer provider-native JSON schema when LiteLLM/provider supports it.
            # Falls back gracefully; parse_output still validates Pydantic.
            response_format = structured_output_schema

        call_kwargs = dict(
            temperature=temperature,
            response_format=response_format,
            user_id=user_id,
            purpose=purpose,
            reference_id=reference_id,
        )

        async def _get_response():
            """Primary → retry → fallback flow."""
            try:
                return await self._call_api(
                    self.model,
                    messages,
                    timeout=primary_timeout,
                    **call_kwargs,
                )
            except asyncio.TimeoutError:
                if not fallback_model or fallback_model == self.model:
                    raise
                logger.warning(
                    f"Primary model {self.model} timed out at {primary_timeout}s, "
                    f"falling back to {fallback_model}"
                )
                return await self._call_api_with_retry(
                    fallback_model, messages, **call_kwargs,
                )
            except Exception:
                # Non-timeout errors (429, 503, network): retry with primary model first
                try:
                    return await self._call_api_with_retry(
                        self.model, messages, **call_kwargs,
                    )
                except Exception:
                    if not fallback_model or fallback_model == self.model:
                        raise
                    logger.warning(
                        f"Primary model {self.model} retries exhausted, "
                        f"falling back to {fallback_model}"
                    )
                    return await self._call_api_with_retry(
                        fallback_model, messages, **call_kwargs,
                    )

        # Retry on schema validation failures — the AI returned valid JSON but it
        # doesn't conform to the Pydantic schema. Re-calling gives the model a
        # fresh chance to produce valid output.
        max_validation_retries = 2
        for attempt in range(1 + max_validation_retries):
            response = await _get_response()
            response_str = _response_text(response)

            if not structured_output_schema:
                return response_str

            try:
                return self.parse_output(
                    response_str, structured_output_schema, is_structured_output_list
                )
            except (json.JSONDecodeError, ValidationError) as e:
                if attempt >= max_validation_retries:
                    logger.error(
                        f"Schema validation failed after {attempt + 1} attempts: {e}"
                    )
                    raise
                logger.warning(
                    f"Schema validation failed (attempt {attempt + 1}), retrying: {e}"
                )


# Backward-compatible alias for existing imports / tests
GeminiInference = LLMInference
