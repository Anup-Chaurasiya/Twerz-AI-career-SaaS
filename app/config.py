import os

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/custom_resume_dev"

    # AI — Gemini (ADK chat + LiteLLM gemini/* models)
    GEMINI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""  # ADK reads this env var for Google AI API auth
    GEMINI_FLASH_MODEL: str = "gemini-3-flash-preview"  # bare name for Google ADK chat
    GEMINI_PRO_MODEL: str = "gemini-3.1-pro-preview"

    # AI — multi-provider generation (LiteLLM model strings)
    # Examples: gemini/gemini-3-flash-preview, openai/gpt-4o-mini, anthropic/claude-sonnet-4-5
    LLM_FLASH_MODEL: str = "gemini/gemini-3-flash-preview"
    LLM_PRO_MODEL: str = "gemini/gemini-3.1-pro-preview"
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # Auth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    JWT_SECRET: str = "change-this-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    # Razorpay
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # Credits
    DAILY_FREE_CREDITS: int = 3

    # Storage
    GCS_BUCKET: str = "your-gcs-bucket"
    GCS_CREDENTIALS_PATH: str = "credentials/gcs-service-account.json"

    # LaTeX
    LATEX_BIN_PATH: str = "/Library/TeX/texbin"

    # App
    ENVIRONMENT: str = "DEV"
    FRONTEND_URL: str = "http://localhost:8000"
    # OAuth callback hits the API; set when UI runs elsewhere (e.g. Next.js :3000)
    API_BASE_URL: str = ""
    DEV_AUTH_BYPASS: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    # Google ADK reads GOOGLE_API_KEY from os.environ (not from Pydantic fields).
    # Ensure it's set so the ADK Runner can create genai.Client() without explicit api_key.
    if settings.GOOGLE_API_KEY and not os.environ.get("GOOGLE_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = settings.GOOGLE_API_KEY
    # LiteLLM reads provider keys from os.environ.
    if settings.GEMINI_API_KEY and not os.environ.get("GEMINI_API_KEY"):
        os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY
    if settings.OPENAI_API_KEY and not os.environ.get("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
    if settings.ANTHROPIC_API_KEY and not os.environ.get("ANTHROPIC_API_KEY"):
        os.environ["ANTHROPIC_API_KEY"] = settings.ANTHROPIC_API_KEY
    return settings


_API_KEY_PLACEHOLDERS = frozenset({
    "",
    "your-gemini-api-key",
    "your_gemini_api_key",
    "your-openai-api-key",
    "your-anthropic-api-key",
})


def _is_real_key(key: str) -> bool:
    key = key.strip()
    if not key or key.lower() in _API_KEY_PLACEHOLDERS or key.startswith("your-"):
        return False
    return True


def is_gemini_configured(settings: Settings | None = None) -> bool:
    """True when a real Gemini API key is set (not a placeholder)."""
    return _is_real_key((settings or get_settings()).GEMINI_API_KEY)


def is_llm_configured(settings: Settings | None = None) -> bool:
    """True when at least one provider API key is configured for LiteLLM."""
    s = settings or get_settings()
    return (
        _is_real_key(s.GEMINI_API_KEY)
        or _is_real_key(s.OPENAI_API_KEY)
        or _is_real_key(s.ANTHROPIC_API_KEY)
    )
