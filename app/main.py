import asyncio
import html as html_mod
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
from app.config import get_settings
from app.exceptions import (
    ProfileNotFoundError,
    JobNotFoundError,
    LaTeXCompilationError,
    AIInferenceError,
    UsageLimitExceeded,
    AuthenticationError,
    ForbiddenError,
    PaymentRequiredError,
    RoastNotFoundError,
    NotFoundError,
    BadRequestError,
    ConflictError,
)

logger = logging.getLogger(__name__)


def _initialize_sentry():
    """Initialize Sentry error tracking if SENTRY_DSN is configured.
    
    Captures exceptions, errors, and performance traces. Runs before app startup.
    No-op if SENTRY_DSN is empty or not set.
    """
    settings = get_settings()
    if not settings.SENTRY_DSN:
        logger.info("Sentry not configured (SENTRY_DSN empty) — skipping initialization")
        return
    
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.asyncio import AsyncioIntegration
        
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            # Environment helps separate dev/staging/production traces
            environment=settings.ENVIRONMENT if hasattr(settings, 'ENVIRONMENT') else "production",
            # Sample 10% of transactions for performance monitoring (adjust as needed)
            traces_sample_rate=0.1,
            # Capture 100% of errors (not sampled)
            # You can add release tracking here: release="twerz@1.0.0"
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                AsyncioIntegration(),
            ],
            # Add custom tags for better filtering
            before_send=lambda event, hint: _before_send_sentry(event, hint),
        )
        logger.info("Sentry initialized successfully (DSN configured)")
    except ImportError:
        logger.warning("Sentry SDK not installed. Install with: uv add sentry-sdk")
    except Exception as e:
        logger.error("Failed to initialize Sentry: %s", e, exc_info=True)


def _before_send_sentry(event, hint):
    """Filter or enrich Sentry events before sending.
    
    Use this to:
    - Scrub PII from error contexts
    - Drop noisy errors (e.g. health check failures)
    - Add custom tags
    """
    # Example: scrub email from error messages
    if event.get("message"):
        import re
        event["message"] = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', event["message"])
    
    return event

from app.background import active_tasks


class _SuppressGraphQLAccessLog(logging.Filter):
    """Drop uvicorn access-log lines for /graphql probe traffic (browser extensions)."""

    def filter(self, record: logging.LogRecord) -> bool:
        return "/graphql" not in record.getMessage()


def _configure_access_log_filters() -> None:
    logging.getLogger("uvicorn.access").addFilter(_SuppressGraphQLAccessLog())


# ── Startup: recover rows stuck by a previous hard kill ─────────────────────
async def _recover_stuck_items():
    from sqlalchemy import select, update
    from app.database.session import async_session_factory
    from app.models.profile import Profile, ProfileStatus
    from app.models.job import Job, JobStatus
    from app.models.roast import Roast, RoastStatus
    from app.services.credit.service import CreditService

    async with async_session_factory() as db:
        # Capture GENERATING_RESUME jobs before flipping status (need user_id for refund).
        stuck_resume = (
            await db.execute(
                select(Job).where(Job.status == JobStatus.GENERATING_RESUME)
            )
        ).scalars().all()
        stuck_resume_ids = [(j.id, j.user_id) for j in stuck_resume]

        r1 = await db.execute(
            update(Profile)
            .where(Profile.status == ProfileStatus.PROCESSING)
            .values(status=ProfileStatus.FAILED)
        )
        r2 = await db.execute(
            update(Job)
            .where(Job.status.in_([JobStatus.GENERATING_RESUME, JobStatus.GENERATING_PDF]))
            .values(status=JobStatus.FAILED)
        )
        r3 = await db.execute(
            update(Roast)
            .where(Roast.status == RoastStatus.PROCESSING)
            .values(status=RoastStatus.FAILED)
        )
        await db.commit()

        credit_service = CreditService()
        for job_id, user_id in stuck_resume_ids:
            try:
                refunded = await credit_service.refund_stuck_generation_if_needed(
                    db, user_id, job_id
                )
                if refunded:
                    logger.info("Refunded credit for stuck job %s (user %s)", job_id, user_id)
            except Exception:
                logger.exception(
                    "Failed to refund stuck job %s on startup — manual review needed",
                    job_id,
                )

    total = r1.rowcount + r2.rowcount + r3.rowcount
    if total:
        logger.warning(
            "Recovered %d stuck item(s) from previous shutdown: "
            "%d profile(s), %d job(s), %d roast(s)",
            total, r1.rowcount, r2.rowcount, r3.rowcount,
        )


async def _cleanup_expired_guest_profiles():
    from app.database.session import async_session_factory
    from app.services.profile.service import ProfileService

    async with async_session_factory() as db:
        count = await ProfileService().cleanup_expired_guest_profiles(db)
        if count:
            logger.info("Soft-deleted %d expired guest profile(s)", count)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown logic."""
    _initialize_sentry()
    _configure_access_log_filters()

    try:
        await _recover_stuck_items()
        await _cleanup_expired_guest_profiles()
    except Exception:
        logger.exception("Failed to recover stuck items on startup (DB may not be ready yet)")

    yield

    if active_tasks:
        logger.info("Shutting down — waiting for %d background task(s)", len(active_tasks))
        _, pending = await asyncio.wait(active_tasks, timeout=8)
        if pending:
            logger.warning("Force-cancelling %d task(s) that didn't finish", len(pending))
            for t in pending:
                t.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
    else:
        logger.info("Shutting down — no active background tasks")

    from app.database.session import engine
    await engine.dispose()
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Twerz API",
        version="0.1.0",
        lifespan=lifespan,
    )

    @app.middleware("http")
    async def reject_graphql_probes(request: Request, call_next):
        # Chrome GraphQL extensions (Apollo DevTools, Altair, etc.) probe /graphql
        # on whatever host is open — this API is REST-only.
        if request.url.path.startswith("/graphql"):
            return JSONResponse(
                status_code=404,
                content={"detail": "This API is REST-only, not GraphQL"},
            )
        return await call_next(request)

    cors_origins = {settings.FRONTEND_URL}
    if settings.API_BASE_URL:
        cors_origins.add(settings.API_BASE_URL)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.middleware.redis_rate_limit import RedisRateLimitMiddleware, InMemoryRateLimitMiddleware

    redis_url = (settings.REDIS_URL or "").strip()
    if redis_url:
        app.add_middleware(RedisRateLimitMiddleware)
        logger.info("Using Redis-backed rate limiter (production mode)")
    else:
        app.add_middleware(InMemoryRateLimitMiddleware)
        if settings.ENVIRONMENT.upper() != "DEV":
            logger.warning(
                "REDIS_URL not set — using in-memory rate limiter. "
                "Configure Redis for production multi-instance deployments."
            )


    custom_domain = (
        settings.FRONTEND_URL.replace("https://", "").replace("http://", "")
        if settings.FRONTEND_URL
        else ""
    )

    # Domain redirect: send browser hits on legacy *.run.app to the custom frontend.
    # API routes must never be redirected to the Next.js host (OAuth, webhooks, etc.).

    _API_ROUTE_PREFIXES = (
        "/auth",
        "/profiles",
        "/jobs",
        "/credits",
        "/payments",
        "/admin",
        "/public",
        "/roasts",
        "/analytics",
        "/account",
        "/notifications",
        "/progress",
        "/privacy",
        "/health",
        "/graphql",
        "/landing",
        "/extension",
    )

    def _is_api_path(path: str) -> bool:
        if path == "/health":
            return True
        return any(path == prefix or path.startswith(f"{prefix}/") for prefix in _API_ROUTE_PREFIXES)

    @app.middleware("http")
    async def redirect_to_custom_domain(request: Request, call_next):
        host = request.headers.get("host", "")
        path = request.url.path
        if not host.endswith(".run.app") or _is_api_path(path):
            return await call_next(request)

        accept = request.headers.get("accept", "")
        if path != "/" and "text/html" not in accept:
            return await call_next(request)

        target = f"https://{custom_domain}{path or '/'}"
        if request.url.query:
            target += f"?{request.url.query}"
        return RedirectResponse(url=target, status_code=301)

    # Exception handlers
    @app.exception_handler(ProfileNotFoundError)
    async def profile_not_found_handler(request: Request, exc: ProfileNotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(JobNotFoundError)
    async def job_not_found_handler(request: Request, exc: JobNotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(LaTeXCompilationError)
    async def latex_error_handler(request: Request, exc: LaTeXCompilationError):
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    @app.exception_handler(AIInferenceError)
    async def ai_error_handler(request: Request, exc: AIInferenceError):
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    @app.exception_handler(UsageLimitExceeded)
    async def usage_limit_handler(request: Request, exc: UsageLimitExceeded):
        return JSONResponse(status_code=429, content={"detail": str(exc)})

    @app.exception_handler(AuthenticationError)
    async def auth_error_handler(request: Request, exc: AuthenticationError):
        return JSONResponse(status_code=401, content={"detail": str(exc)})

    @app.exception_handler(ForbiddenError)
    async def forbidden_error_handler(request: Request, exc: ForbiddenError):
        return JSONResponse(status_code=403, content={"detail": str(exc)})

    @app.exception_handler(PaymentRequiredError)
    async def payment_required_handler(request: Request, exc: PaymentRequiredError):
        return JSONResponse(
            status_code=402,
            content={"detail": str(exc), "paywall": exc.paywall},
        )

    @app.exception_handler(RoastNotFoundError)
    async def roast_not_found_handler(request: Request, exc: RoastNotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(BadRequestError)
    async def bad_request_handler(request: Request, exc: BadRequestError):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(ConflictError)
    async def conflict_error_handler(request: Request, exc: ConflictError):
        return JSONResponse(status_code=409, content={"detail": str(exc)})

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        # Return JSON for API requests, styled HTML for browser requests
        accept = request.headers.get("accept", "")
        if "text/html" not in accept:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        return HTMLResponse(status_code=exc.status_code, content=f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{exc.status_code} — Twerz</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:#0a0f1e;color:#e2e8f0;font-family:'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}}
.container{{max-width:480px}}
.code{{font-family:'JetBrains Mono',monospace;font-size:clamp(80px,15vw,140px);font-weight:800;background:linear-gradient(135deg,#f97316,#14b8a6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1}}
.message{{font-size:18px;color:#94a3b8;margin:16px 0 32px;line-height:1.6}}
.btn{{display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#f97316,#fb923c);color:#0a0f1e;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1px;text-decoration:none;border-radius:6px;transition:transform 0.2s}}
.btn:hover{{transform:translateY(-2px)}}
.brand{{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:2px;color:#475569;margin-top:48px}}
</style>
</head>
<body>
<div class="container">
<div class="code">{exc.status_code}</div>
<p class="message">{"This page doesn't exist. It might have been moved or you may have mistyped the URL." if exc.status_code == 404 else html_mod.escape(str(exc.detail))}</p>
<a href="/" class="btn">Go Home</a>
<p class="brand">TWERZ</p>
</div>
</body>
</html>""")

    # Health check
    @app.get("/health")
    async def health():
        return {"status": "ok"}

    # Privacy & India DPDP Act compliance (Phase 7)
    @app.get("/privacy/dpdp")
    async def dpdp_privacy_notice():
        """India DPDP Act (Digital Personal Data Protection Act, 2023) notice.

        Documents data principal rights for Indian job seekers whose resumes carry PII:
        - Right to access, summary of personal data processed, and identity of data fiduciaries
        - Right to correction, completion, and erasure (GDPR export/delete endpoints reuse)
        - Right to grievance redressal via support email
        """
        return {
            "title": "India DPDP Act (2023) Privacy Notice & Data Principal Rights",
            "data_fiduciary": "Cydratech (Twerz)",
            "purpose": "Automated resume parsing, tailoring, ATS keyword optimization, and PDF generation.",
            "data_processed": ["Name", "Email", "Phone", "Employment history", "Education", "Skills", "PDF Resumes"],
            "rights": {
                "right_to_access": "Available via GET /auth/me and GET /profiles/",
                "right_to_correction": "Available via PUT /profiles/{id} and PUT /jobs/{id}/custom-resume",
                "right_to_erasure": "Available via DELETE /profiles/{id} and account deletion flow",
                "grievance_contact": "privacy@cydratech.com",
            },
            "data_retention": "UserData is retained until explicit deletion by the user.",
            "notice_version": "2026-07-23",
        }


    # Mount routers
    from app.api.auth import router as auth_router
    from app.api.profiles import router as profiles_router
    from app.api.jobs import router as jobs_router
    from app.api.credits import router as credits_router
    from app.api.payments import router as payments_router
    from app.api.progress import router as progress_router
    from app.api.admin import router as admin_router
    from app.api.admin_monitoring import router as admin_monitoring_router
    from app.api.roasts import router as roasts_router
    from app.api.chat import router as chat_router
    from app.api.profile_chat import router as profile_chat_router

    app.include_router(auth_router)
    app.include_router(profiles_router)
    app.include_router(jobs_router)
    app.include_router(credits_router)
    app.include_router(payments_router)
    app.include_router(progress_router)
    app.include_router(admin_router)
    app.include_router(admin_monitoring_router)
    app.include_router(roasts_router)
    app.include_router(chat_router)
    app.include_router(profile_chat_router)

    from app.api.account import router as account_router
    from app.api.extension import router as extension_router
    from app.api.analytics import router as analytics_router
    from app.api.public import router as public_router
    from app.api.templates import router as templates_router
    app.include_router(account_router)
    app.include_router(extension_router)
    app.include_router(analytics_router)
    app.include_router(public_router)
    app.include_router(templates_router)


    # Legacy landing URL → Next.js frontend
    @app.get("/landing")
    async def landing_redirect():
        settings = get_settings()
        return RedirectResponse(url=settings.FRONTEND_URL.rstrip("/"), status_code=301)

    return app


app = create_app()
_configure_access_log_filters()


if __name__ == "__main__":
    import uvicorn

    _settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=_settings.ENVIRONMENT.upper() == "DEV",
    )
