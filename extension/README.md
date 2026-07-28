# Twerz Apply Assist (Chrome extension v0.6)

Capture job descriptions and complete applications with fit-scored tailored resumes.

Icons are generated from `frontend/public/twerz-logo.png` into `extension/icons/`.

```bash
./extension/generate-icons.sh   # re-run if logo changes
```

After pulling changes or updating icons, **remove the old extension and load unpacked again** (Chrome caches icons aggressively — Reload alone is often not enough).

## Install

1. Chrome → **Extensions** → **Load unpacked** → select this `extension/` folder.
2. Extension popup → **Connect account** (opens web app OAuth — no JWT paste).
3. Optional: right-click extension icon → **Options** for EEO field preferences.

**Requires Job Hunt Pro or an active time pass.**

## Modes

| Mode | Where | What it does |
|------|-------|--------------|
| **Capture** | LinkedIn, Naukri, Indeed, Wellfound, Greenhouse, Lever, Workday JD pages | Scrape JD → analyze fit in extension → one-click generate |
| **Apply Assist** | Greenhouse, Lever, Workday apply forms | Sidebar: fit gate, consent-gated auto-fill, PDF upload, cover letter, form fill, tracker sync |

You always click **Submit** on the employer site. Auto-fill requires explicit **Fill now** consent on first use per job.

## Supported boards

| Site | Capture | Apply Assist |
|------|---------|--------------|
| linkedin.com/jobs | Yes | — |
| naukri.com | Yes | — |
| indeed.com | Yes | — |
| wellfound.com / angel.co | Yes | — |
| *.greenhouse.io | Yes | Yes |
| jobs.lever.co | Yes | Yes |
| *.myworkdayjobs.com | Yes | Yes |

## Badge states

| Badge | Meaning |
|-------|---------|
| · | Job captured — analyzing… |
| # / score | Fit analyzed — generate resume |
| … | Resume generating |
| ✓ | Ready to apply (tailored PDF exists) |
| ! | Generation failed — retry in extension |

## API endpoints

- `GET /extension/me` — profiles + entitlement
- `POST /extension/capture-job` — create job from JD
- `POST /extension/jobs/{id}/analyze-fit` — free fit analysis
- `POST /extension/jobs/{id}/generate-resume` — generate tailored resume
- `PATCH /extension/jobs/{id}/confirm-low-fit` — persist stretch-fit override
- `GET /extension/jobs/{id}/status` — badge polling (credit-aware)
- `GET /extension/jobs/recent` — recent jobs picker
- `GET /extension/jobs/match?url=` — match tab URL to captured job
- `GET /extension/jobs/{id}/apply-context` — fit gate + assets + scam heuristics
- `POST /extension/jobs/{id}/form-answers` — evidence-grounded form answers
- `POST /extension/events` — funnel telemetry
- `PATCH /jobs/{id}/application` — mark applied in tracker

Connect: `{FRONTEND_URL}/extension/connect?extension_id={chrome.runtime.id}`

## Chrome Web Store positioning

**Title:** Twerz Apply Assist — Honest Job Apply Helper

**Short description:** Capture JDs, get fit-scored tailored resumes, and fill Greenhouse/Lever/Workday forms. You review and submit — not a spam auto-apply bot.

**Not this:** unattended apply, LinkedIn Easy Apply bots, or mass-application while you sleep.

## Permissions

The extension uses `optional_host_permissions` for ATS apply domains. Permissions are requested on first Apply Assist use on an apply form.

## Terms of service note

Before store submission, confirm Greenhouse/Lever/Workday terms allow **user-initiated** form autofill (similar to password managers). Twerz never auto-submits applications.

## Tests

```bash
cd extension && npm test
uv run pytest tests/test_api/test_extension.py tests/test_services/test_extension_helpers.py -v
```
