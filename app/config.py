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
    REFERRAL_BONUS_CREDITS: int = 2  # bonus credits granted to both accounts on first successful generation
    REFERRAL_VELOCITY_MAX: int = 5  # max referral bonus grants per referrer in velocity window
    REFERRAL_VELOCITY_WINDOW_HOURS: int = 1

    # Automatic ops alerting (Phase C)
    ALERT_ERROR_RATE_THRESHOLD_PCT: float = 25.0  # alert if 1h failure rate exceeds this
    ALERT_ERROR_RATE_MIN_JOBS_1H: int = 5  # need at least this many jobs in window
    ALERT_ERROR_RATE_COOLDOWN_MINUTES: int = 60  # debounce repeat alerts

    # Calibration (Phase 2 — Outcome Feedback Loop)
    CALIBRATION_MIN_SAMPLE: int = 10  # exclude bands with fewer jobs than this

    # Storage
    GCS_BUCKET: str = "your-gcs-bucket"
    GCS_CREDENTIALS_PATH: str = "credentials/gcs-service-account.json"

    # LaTeX
    LATEX_BIN_PATH: str = "/Library/TeX/texbin"

    # App & Reliability (Phase 7)
    ENVIRONMENT: str = "DEV"  # DEV, staging, or production
    FRONTEND_URL: str = "http://localhost:8000"
    API_BASE_URL: str = ""
    TRUST_PROXY_HEADERS: bool = False  # set True in production behind Cloud Run / LB
    DEV_AUTH_BYPASS: bool = False
    SENTRY_DSN: str = ""
    ALERT_WEBHOOK_URL: str = ""
    REDIS_URL: str = ""  # redis://localhost:6379 or redis://user:password@host:port/db
    RATE_LIMIT_PUBLIC_RPM: int = 30  # 30 req/min per IP on public endpoints
    PUBLIC_UPLOAD_MAX_BYTES: int = 5_000_000  # 5 MB cap for unauthenticated uploads
    LINKEDIN_OPTIMIZE_DAILY_LIMIT: int = 5  # free LinkedIn optimize calls per user per day
    OUTREACH_DAILY_LIMIT: int = 10  # outreach messages per user per day


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


_JWT_SECRET_PLACEHOLDERS = frozenset({
    "",
    "change-this-secret",
    "change_me",
    "your-jwt-secret",
})

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


def is_jwt_secret_production_ready(settings: Settings | None = None) -> bool:
    """True when JWT_SECRET is set to a non-placeholder value."""
    secret = (settings or get_settings()).JWT_SECRET.strip()
    return secret not in _JWT_SECRET_PLACEHOLDERS and len(secret) >= 32


def is_llm_configured(settings: Settings | None = None) -> bool:
    """True when at least one provider API key is configured for LiteLLM."""
    s = settings or get_settings()
    return (
        _is_real_key(s.GEMINI_API_KEY)
        or _is_real_key(s.OPENAI_API_KEY)
        or _is_real_key(s.ANTHROPIC_API_KEY)
    )
