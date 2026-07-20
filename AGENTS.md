# AGENTS.md

## What This Is

**ATS Beater** — AI-powered resume tailoring service by Cydratech. Upload PDF resume → AI structures it → paste a job description → AI tailors a custom resume → LaTeX compiles to PDF.

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI, SQLAlchemy async, PostgreSQL 16 (Docker), Alembic |
| AI | LiteLLM multi-provider (`LLM_FLASH_MODEL` / `LLM_PRO_MODEL`); Google ADK chat still on Gemini (`GEMINI_*`) |
| PDF | pdflatex + `resume.cls`, pdfplumber for text extraction |
| Frontend | Next.js 16 (App Router) + React 19 + Zustand + TanStack Query |
| Auth | Google OAuth 2.0 → JWT |
| Payments | Razorpay (credit packs: Day Pass ₹49, Sprint ₹99, Job Hunt ₹199) |
| Package mgr | UV, dependencies in `pyproject.toml` |

**Never use older 2.5 preview models — they are deprecated.**

## How To Run

```bash
docker compose up -d                          # PostgreSQL
uv sync --extra dev                           # install deps
uv run alembic upgrade head                   # migrations
uv run uvicorn app.main:app --reload --port 8000  # API → http://localhost:8000
# Or: uv run python -m app.main
# Next.js UI: cd frontend-nextjs && npm run dev → http://localhost:3000
```

Set `DEV_AUTH_BYPASS=true` in `.env` to skip Google OAuth during development.

## How To Test

```bash
uv run pytest tests/ -v --ignore=tests/integration  # unit + golden matrix invariants (no API key)
INTEGRATION=1 uv run pytest tests/integration/ -v   # smoke tests (needs real DB + API key + pdflatex)

# Golden JD matrix (live LLM, optional)
INTEGRATION=1 uv run pytest tests/integration/test_golden_jd_matrix.py -v
INTEGRATION=1 GOLDEN_FULL=1 GOLDEN_STRICT=1 uv run pytest tests/integration/test_golden_jd_matrix.py -v
```

**Regression gate before prompt/pipeline changes:** run unit tests including `tests/test_services/test_golden_matrix.py` (12-cell canned fit bands + mocked STRONG/MISMATCH run invariants). Live matrix is optional.

## Data Flow

```
Upload PDF ──→ pdfplumber extract ──→ Gemini Flash structures ──→ ResumeInfo (JSON in PostgreSQL)
                                                                         │
Job Description ────────────────────────────────────────────────────────→ │
                                                                         ▼
                                                              Gemini Pro tailors
                                                                         │
                                                                         ▼
                                                              CustomResumeInfo
                                                                         │
                                                                         ▼
                                                         LaTeX builder + pdflatex ──→ PDF
```

Phase 1 and Phase 2 are separate API calls. User can review/edit `CustomResumeInfo` between phases.

## Credit System

**Business model**: Daily free quota + purchasable credit packs + unlimited time passes.

### Consumption Priority
1. **Active time pass** → unlimited (no deduction)
2. **Daily free** → 3/day (configurable via `DAILY_FREE_CREDITS`), resets at midnight UTC
3. **Purchased credits** → from balance
4. **No credits** → 429 error, frontend shows paywall modal

### Credit deduction
- Happens **synchronously** in the request handler (before background task starts)
- If background generation fails, a **refund** is issued (except for time pass — unlimited)
- All transactions recorded in `credit_transactions` audit ledger

### Promo codes
- Admin-created, types: `CREDITS` (adds N credits) or `TIME_PASS` (activates tier by ID)
- One redemption per user per code, optional max total redemptions, optional expiry

### Time pass stacking
- If a user buys a second pass while one is active, the new pass **starts at the old expiry**

## Job Status Flow

`PENDING` → `GENERATING_RESUME` → `RESUME_GENERATED` → `GENERATING_PDF` → `READY`

Any step can transition to `FAILED`.

## Project Layout

```
app/
  main.py                  # FastAPI factory, CORS, exception handlers, static file mount
  config.py                # Pydantic BaseSettings from .env
  dependencies.py          # get_current_user, get_super_admin, get_db
  exceptions.py            # Custom exception classes (→ HTTP 4xx handlers in main.py)
  models/                  # SQLAlchemy ORM (User, Profile, Job, Tenant, Credit*, etc.)
    __init__.py            # MUST import all models (relationship resolution)
    credit.py              # CreditPack, TimePassTier, UserCredit, UserTimePass, CreditTransaction, PromoCode, PromoRedemption
  schemas/
    credit.py              # All credit/payment Pydantic schemas
  database/session.py      # async engine, sessionmaker, get_db() generator
  services/
    ai/inference.py        # LLMInference (LiteLLM) — multi-provider structured output + retry
    ai/prompts.py          # System/user prompt templates
    ai/retry.py            # retry_decor with exponential backoff
    ocr/extractor.py       # PDFExtractor — pdfplumber first, Gemini vision fallback
    latex/builder.py       # CustomResumeInfo → LaTeX string
    latex/compiler.py      # LaTeX string → PDF bytes (60s timeout)
    latex/sanitizer.py     # Escape LaTeX special chars
    profile/service.py     # ProfileService — create, process (background), enhance, CRUD
    job/service.py         # JobService — generate_custom_resume (Phase 1), generate_pdf (Phase 2)
    credit/service.py      # CreditService — balance mgmt, check_and_deduct, promo, refund
    payment/razorpay_client.py  # RazorpayService — order creation, payment/webhook verification
    auth/google_oauth.py   # OAuth URL, code exchange, user info
    auth/jwt_handler.py    # create_access_token, verify_token
  api/
    auth.py                # /auth/google/login, /auth/google/callback, /auth/me
    profiles.py            # /profiles/* CRUD + upload
    jobs.py                # /jobs/* CRUD + generation triggers (credit check on generate)
    credits.py             # /credits/* — packs listing, balance, history, promo redemption
    payments.py            # /payments/* — Razorpay order creation, verification, webhook
    admin.py               # /admin/* — tenants, users, domain rules, credit packs, time passes, promos, transactions, grants
    progress.py            # SSE endpoint

frontend-nextjs/
  app/                     # Next.js App Router pages (dashboard, login, public roast share)
  lib/                     # API client, stores, utils
  public/                  # Static assets (og-roast.png, etc.)

tests/
  conftest.py              # In-memory SQLite, test client, fixtures
  integration/             # Smoke tests (DB, Gemini, LaTeX, GCS) — gated behind INTEGRATION=1
  test_api/                # Route tests (health, profiles, jobs, admin, credits)
  test_models/             # ORM tests (user, profile, job, tenant, credit)
  test_schemas/            # Schema validation tests
  test_latex/              # Builder, sanitizer, compiler
  test_ai/                 # Retry decorator
  test_services/           # JWT, GCS, CreditService

alembic/versions/          # Migrations (run `alembic history` for details)
resume.cls                 # LaTeX document class — copied into temp dir at compile time
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/auth/google/login` | Returns OAuth URL |
| GET | `/auth/google/callback` | Exchanges code, redirects with JWT |
| GET | `/auth/me` | Current user info |
| POST | `/profiles/upload` | Upload PDF (202, processes in background) |
| GET | `/profiles/` | List user's profiles |
| GET | `/profiles/{id}` | Get profile with resume_info |
| GET | `/profiles/{id}/status` | Poll processing status |
| PUT | `/profiles/{id}` | Update resume_info |
| POST | `/profiles/{id}/enhance` | AI-enhance profile |
| DELETE | `/profiles/{id}` | Soft delete |
| POST | `/jobs/` | Create job (needs profile_id + job_description) |
| POST | `/jobs/{id}/generate-resume` | Trigger Phase 1 (202, deducts credit) |
| POST | `/jobs/{id}/generate-pdf` | Trigger Phase 2 (202) |
| GET | `/jobs/{id}/status` | Poll job status |
| GET | `/jobs/{id}/custom-resume` | Get generated CustomResumeInfo |
| PUT | `/jobs/{id}/custom-resume` | Edit before PDF generation |
| GET | `/jobs/{id}/pdf` | Download PDF |
| GET | `/jobs/` | List user's jobs |
| GET | `/credits/packs` | List active credit packs + time passes (public) |
| GET | `/credits/me` | Current balance + daily free + active pass |
| GET | `/credits/history` | Paginated transaction history |
| POST | `/credits/redeem-promo` | Redeem a promo code |
| POST | `/payments/create-order` | Create Razorpay order for pack/pass |
| POST | `/payments/verify` | Verify payment signature, credit account |
| POST | `/payments/webhook` | Razorpay webhook (payment.captured safety net) |
| GET | `/landing` | Redirects to `FRONTEND_URL` (Next.js landing) |
| * | `/admin/*` | Full CRUD: tenants, users, domain-rules, credit-packs, time-pass-tiers, promo-codes, transactions, credits/grant |

## Important Patterns

- `app/models/__init__.py` must import ALL models — SQLAlchemy needs this for relationship resolution
- Background tasks use `async_session_factory` to create independent DB sessions (not the request session)
- LaTeX sanitizer uses a placeholder for backslash to prevent double-escaping of `{}`
- Services call `await db.rollback()` before setting FAILED status in exception handlers
- OAuth callback redirects to `{FRONTEND_URL}/login?token=` (Next.js)
- Credit deduction is synchronous (request scope), generation is async (background task)
- All `.env` config documented in `.env.example`
- All admin GET endpoints use pagination envelope: `{items, total, page, pages, limit}`

## Multi-Tenancy

- **Organizational labeling only** — no data isolation. Profiles/Jobs remain scoped by user_id.
- `Tenant` + `TenantDomainRule` models for email domain auto-assignment on OAuth signup
- `User.is_super_admin` gates `/admin/*` via `get_super_admin` dependency
- `User.tenant_id` FK with `ondelete="SET NULL"` — deleting a tenant unassigns users
- Domain rules normalized to lowercase via Pydantic validator
- Frontend admin panel: 7 tabs (Tenants / Users / Domain Rules / Credit Packs / Time Passes / Promo Codes / Transactions), visible only to super admins

## Deployment

See `infra/deploy-cloudrun.sh` for Cloud Run deployment. Configure your own:
- Cloud SQL / PostgreSQL instance
- GCS bucket for PDF storage
- Google OAuth credentials
- Razorpay keys (for payments)

Environment variables are documented in `.env.example`.

## Recent Updates (December 2024)

### Phase 1: Critical Bug Fixes ✅
- **Profile Enhancement Rate Limiting**: 3 free enhancements per profile per day (no credits required)
- **Direct Resume Edit**: `PUT /jobs/{id}/custom-resume` endpoint for manual JSON editing
- **LaTeX Error Logging**: Failed PDF compilations store full error logs in `jobs.pdf_error_log`
- **LaTeX Sanitization**: Comprehensive special character handling (URLs, emails, Unicode, smart quotes)

### Phase 2: Production Hardening ✅
- **GCS PDF Storage**: ✅ IMPLEMENTED
  - PDFs automatically uploaded to GCS: `resumes/{user_id}/{job_id}.pdf`
  - Signed URLs with 1-hour expiration for downloads
  - 3 retry attempts with exponential backoff
  - `gcs_upload_failed` flag for tracking upload failures
  - Priority: GCS signed URL → Local file → Regenerate from LaTeX
- **Free PDF Recompilation**: Recompiling after chat/manual edits costs NO credits
- **Error Log Storage**: LaTeX compilation errors stored in `jobs.pdf_error_log` for admin debugging
- **60-second Timeout**: pdflatex timeout increased to handle long resumes

### Phase 3: UX Enhancements ✅
- **Onboarding Tracking**: `users.onboarding_completed` field for welcome flow state
- **New User Detection**: `is_new_user` flag in `/auth/me` (true if created < 5 minutes ago)
- **Empty State Support**: All list endpoints return `is_empty` flag for frontend guidance

### Database Migrations Applied
```bash
j1k2l3m4n5o6 - Profile enhance rate limit fields
k2l3m4n5o6p7 - PDF error log column
l3m4n5o6p7q8 - GCS upload failed flag
m4n5o6p7q8r9 - Onboarding completed flag
```

### API Endpoint Updates
| Method | Path | Changes |
|--------|------|---------|
| GET | `/jobs/{id}/pdf` | Now returns signed GCS URLs (1hr expiry), falls back to local/regenerate |
| POST | `/jobs/{id}/generate-pdf` | FREE recompilation when `custom_resume_data` exists |
| PUT | `/jobs/{id}/custom-resume` | NEW: Direct JSON editing with Pydantic validation |
| GET | `/jobs/{id}` | Returns `gcs_upload_failed` and `pdf_error_log` fields |
| GET | `/auth/me` | Returns `onboarding_completed` and `is_new_user` |
| POST | `/auth/onboarding-complete` | NEW: Mark onboarding as complete |
| GET | `/profiles/` | Returns `is_empty` flag |
| GET | `/jobs/` | Returns `is_empty` flag |
| GET | `/roasts/` | Returns `is_empty` flag |

### Key Implementation Details
- **GCS Upload**: Happens in background after PDF generation, doesn't block user
- **Signed URLs**: Generated on-demand, expire after 1 hour for security
- **Error Logging**: Full pdflatex output captured in `LaTeXCompilationError.full_log`
- **Rate Limiting**: Profile enhancement resets daily at midnight UTC
- **Empty States**: Frontend can detect and show helpful onboarding UI
