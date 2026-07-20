"""Unit tests for LLMInference helpers (no external API calls)."""
from pydantic import BaseModel, Field

from app.services.ai.inference import (
    LLMInference,
    GeminiInference,
    build_messages,
    _normalize_content_part,
)


class TinySchema(BaseModel):
    name: str = Field(...)
    score: int = Field(default=0)


def test_gemini_inference_alias():
    assert GeminiInference is LLMInference


def test_build_messages_plain_string():
    msgs = build_messages("sys", ["hello"])
    assert msgs == [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "hello"},
    ]


def test_build_messages_multimodal_image_url():
    msgs = build_messages(
        "sys",
        [
            "describe this",
            {
                "type": "image_url",
                "image_url": {"url": "data:image/jpeg;base64,abc"},
            },
        ],
    )
    assert msgs[0]["role"] == "system"
    assert msgs[1]["role"] == "user"
    content = msgs[1]["content"]
    assert isinstance(content, list)
    assert content[0] == {"type": "text", "text": "describe this"}
    assert content[1]["type"] == "image_url"


def test_normalize_gemini_inline_data():
    part = _normalize_content_part(
        {"inline_data": {"mime_type": "image/png", "data": "xyz"}}
    )
    assert part["type"] == "image_url"
    assert part["image_url"]["url"] == "data:image/png;base64,xyz"


def test_parse_output_json_and_fenced():
    llm = LLMInference(model_name="openai/gpt-4o-mini")
    raw = '```json\n{"name": "Ada", "score": 9}\n```'
    result = llm.parse_output(raw, TinySchema)
    assert result == {"name": "Ada", "score": 9}


def test_parse_output_list():
    llm = LLMInference(model_name="openai/gpt-4o-mini")
    raw = '[{"name": "A"}, {"name": "B", "score": 2}]'
    result = llm.parse_output(raw, TinySchema, is_list=True)
    assert result == [{"name": "A", "score": 0}, {"name": "B", "score": 2}]
