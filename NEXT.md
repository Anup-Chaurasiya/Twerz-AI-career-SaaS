# ATS Beater — Market-Leading Roadmap
### Gap analysis + phase-wise build prompts (paste each phase into Claude Code)

---

## 0. What's already strong (don't touch, just extend)

- Golden JD regression matrix (12-cell fit-band coverage) with invariant checks
- Race-condition-safe credit deduction (`SELECT FOR UPDATE`)
- GDPR export/delete, cascading deletes at the DB level
- Roast viral loop with real attribution tracking (`signup_share_id`)
- LiteLLM multi-provider abstraction (Gemini/OpenAI/Anthropic swap by env var)
- Stuck-job recovery + auto-refund on server crash

## 1. The real lever for "everyone recommends this"

The resume/ATS layer is necessary but not sufficient. The two categories of gap below matter more for "people talk about this like a must-use tool":

- **Proof it works** — you have zero mechanism turning `application_status` outcomes into evidence that your scores mean anything. Right now "Fit: STRONG" is a claim. It should be a claim backed by your own users' real interview conversion data.
- **Referrals** — resume tailoring optimizes the artifact; referrals change who reads it. Nothing in the current build touches this.

Everything below is organized so Phase 1-3 fix trust/accuracy, Phase 4-6 build the "people talk about this" loop, Phase 7 makes it safe to scale, Phase 8 is the big future bet.

---

## 2. Gap Analysis by Category

### A. Trust & Accuracy (extends the two prior prompt reviews)
- `STRUCTURED_RESUME_SYSTEM_PROMPT` / `ENHANCED_RESUME_SYSTEM_PROMPT` anti-fabrication fixes (already scoped in the previous review — carry into Phase 1 if not yet shipped)
- No verification that the generated PDF is *actually* machine-readable — ATS score is currently an LLM's opinion, never checked against real text extraction
- Golden-matrix invariant "ATS score must improve" doesn't account for resumes that are already near-ceiling on structure
- Preview models (`gemini-3-flash-preview`, `gemini-3.1-pro-preview`) in production with no pinning/rollback plan — your own docs note a prior deprecation already happened once

### B. Missing features vs. market leaders
- No LinkedIn-facing output (headline/About/skills) — recruiters search LinkedIn as much as they screen resumes
- No referral/warm-intro tooling — the highest-leverage shortlist lever that exists
- No proactive job matching — the product is entirely reactive (user must bring the JD)
- No outcome-based score calibration — scores are static per-generation, never learn from real results

### C. Retention / love / virality
- No personal analytics — users never see proof the tool is working for *them* specifically
- No user-to-user referral program (only admin-created promo codes)
- No public, no-signup lead magnet (the Roast comes closest but isn't positioned as one)
- No social-proof "success wall" for the landing page

### D. Reliability, compliance, scale
- No error monitoring/alerting mentioned (Sentry-class tooling)
- GDPR export/delete exists, but no explicit India DPDP Act framing for a product targeting Indian job seekers with PII-heavy resumes
- No rate limiting on public unauthenticated endpoints (`/roasts/shared/{share_id}`, and the new public checker in Phase 5)

---

## 3. Phase-Wise Build Prompts

### Phase 1 — Trust & Verification Hardening
*Ships the fixes from the prior prompt review plus a real machine-readability check.*

```
Context: ATS Beater's honesty architecture assumes the structured profile extraction and
ATS scoring are fully faithful. Two gaps let that assumption break silently.

Build:
1. Add explicit anti-fabrication language to STRUCTURED_RESUME_SYSTEM_PROMPT and rewrite
   ENHANCED_RESUME_SYSTEM_PROMPT so neither can add a skill, metric, or claim not present
   in the source text. (Exact replacement text already drafted in the prior prompt review
   doc — apply it directly.)
2. Add Pydantic field constraints `Field(ge=0, le=100)` to fit_score and ats_score on the
   Job model/schema so an invalid LLM output fails validation instead of persisting.
3. New verification step after PDF generation: re-extract text from the generated PDF via
   pdfplumber and confirm (a) all headline keywords intended for ATS matching actually
   appear in the extracted text, (b) contact info (name/email/phone) is present in the
   extracted body text, not only in an image/header. Store the result as
   `pdf_verified_readable: bool` on the Job. If verification fails, trigger one automatic
   LaTeX regeneration attempt before surfacing a warning to the user.
4. Adjust the golden JD matrix invariant: ATS score must improve OR remain at/near ceiling
   (>=90) if the original was already near-ceiling — "must improve" alone is wrong for an
   already-strong original resume.

Acceptance criteria:
- No score in the DB or API response can be outside [0,100]
- Every READY job has pdf_verified_readable set and it's surfaced in the job detail API
- Golden JD matrix passes with the adjusted invariant on a near-ceiling original resume
```

### Phase 2 — Outcome Feedback Loop & Calibrated Scoring
*Turns your scores from a claim into evidence, using data you already collect.*

```
Context: jobs.application_status (SAVED/APPLIED/INTERVIEW/OFFER/REJECTED/WITHDRAWN)
already exists next to fit_score, fit_label, and ats_score_after, but nothing correlates
them. This is the single highest-value trust feature available given existing data.

Build:
1. A scheduled aggregation job (or on-demand admin endpoint) that computes, per fit_label
   band (STRONG/GOOD/STRETCH/MISMATCH) and per ats_score_after bucket: application rate
   (SAVED->APPLIED), interview rate (APPLIED->INTERVIEW), and offer rate, across all users
   with sufficient volume for statistical relevance.
2. Store this as a `ScoreCalibration` table (band, sample_size, interview_rate,
   offer_rate, last_computed_at) refreshed periodically.
3. Expose it in the admin overview as a new "Calibration" panel — do we actually see
   STRONG-fit jobs converting to interviews at a meaningfully higher rate than STRETCH?
   If not, that's a signal the scoring weights need adjustment, not a UI problem.
4. Do NOT use this to auto-tune LLM prompts yet — surface it to admins first so you can
   sanity-check the correlation is real (large enough sample, not confounded by users who
   only apply to STRONG jobs) before feeding it back into the scoring logic itself.

Acceptance criteria:
- Admin can see interview/offer conversion rate by fit band, refreshed on a schedule
- Aggregation excludes bands with sample_size below a configurable minimum (avoid noisy
  conclusions from small samples)
```

### Phase 3 — Referral & Warm-Intro Assist
*The highest-leverage lever the product doesn't touch yet. Scoped realistically — no
automated LinkedIn contact discovery, since that requires LinkedIn's restricted partner
API and isn't something to build around assuming access.*

```
Context: referrals convert to interviews at a much higher rate than cold applications.
The product currently gives users a great resume and nothing else toward the human side
of getting noticed.

Build:
1. New optional field set on Job: `known_contacts` (free-text or small structured list:
   name, relationship, LinkedIn URL if user has it) — purely user-entered, no scraping.
2. New endpoint `POST /jobs/{id}/outreach-message` — generates a short, honest warm
   outreach message (for a known contact, a cold LinkedIn connection request, or a
   referral-request template) grounded in the same evidence_map used for the resume —
   same anti-fabrication rules apply.
3. Add a lightweight "did you get referred?" field on application_status updates (e.g.
   applied_via: cold | referral | recruiter_outreach) so Phase 2's calibration work can
   eventually show users the size of the referral lift, using their own data.
4. UI: a "Networking" tab on the job detail page alongside resume/cover-letter/interview
   prep, with a short explainer on why this matters more than another resume tweak.

Acceptance criteria:
- Outreach message generation follows the same evidence-grounding rules as cover letters
  (no invented shared context, no fabricated warmth)
- applied_via is captured on every application_status update to APPLIED
```

### Phase 4 — Personal Analytics & Proof-of-Value Dashboard
*Depends on Phase 2. This is the "wow, it's actually working" moment for retention.*

```
Context: users never see evidence the tool is helping them specifically — only a single
generation's fit/ATS score in isolation.

Build:
1. New dashboard page /dashboard/insights showing the user's own funnel: applications by
   fit-score band, interview rate by band, and a simple recommendation ("you're 3x more
   likely to get an interview when Fit >= 70 — consider skipping STRETCH/MISMATCH jobs
   unless you have a referral").
2. Reuse ScoreCalibration data (Phase 2) to show how the user's personal conversion rate
   compares to the platform average, if sample size allows — otherwise show platform
   average only with a note that their own data will populate as they apply more.
3. Surface this same nudge contextually at the moment of generation: if a job is
   STRETCH/MISMATCH, show the user's own historical conversion rate for that band (if any)
   alongside the existing confirm_low_fit warning.

Acceptance criteria:
- Dashboard renders correctly with zero historical data (new user) and with populated data
- No claim is shown without a stated sample size if the sample is small
```

### Phase 5 — Public Growth Engine
*Directly targets "I want to rule the market" — organic acquisition + peer referral.*

```
Context: the Roast feature already proves your no-auth public-share pattern works and
drives signups via signup_share_id. Extend that pattern deliberately as a growth engine.

Build:
1. Public, no-signup "Free ATS Score Check" page (mirrors the Roast upload flow):
   upload a PDF, get back the 8-point ATS checklist (reuse ROAST_SYSTEM_PROMPT's Part 2
   logic) with no fit/JD-matching — just structure/parseability score, no roast humor.
   Strong CTA to sign up for full JD tailoring. Rate-limit by IP to prevent abuse.
2. User-to-user referral program, distinct from admin promo codes: every user gets a
   unique shareable referral code; when a referred user completes their first successful
   generation, both accounts receive a small bonus credit grant. Reuse the existing
   promo_redemptions table pattern, keyed by referring user_id rather than an admin code.
3. Opt-in, anonymized "Success Wall" section on the landing page: aggregate stats only
   (e.g. "1,240 resumes tailored this week", "average ATS score improvement: +34 points")
   — never individual user data without explicit consent.

Acceptance criteria:
- Public ATS checker requires no auth and no credit, is rate-limited per IP
- Referral bonus only grants once per referred user (idempotency check, same pattern as
  existing promo redemption uniqueness constraint)
```

### Phase 6 — LinkedIn Profile Optimizer
*Low technical cost (reuses existing structured profile data), real value-add.*

```
Context: ResumeInfo is already a rich structured profile. Recruiters search LinkedIn as
often as they screen resumes, and nothing currently helps users optimize that surface.

Build:
1. New endpoint POST /profiles/{id}/linkedin-optimize — generates a LinkedIn headline,
   About section, and prioritized skills list from the existing ResumeInfo. Same honesty
   constraints as every other generation prompt: no invented scope, titles, or metrics.
2. Optionally accept a target job description for JD-flavored optimization, following the
   same evidence-map-grounded write modes already built for resume tailoring (STRONG /
   STRETCH / TRANSFERABLE-ONLY).
3. Output is plain text for the user to copy into LinkedIn manually — no LinkedIn API
   integration required, avoids their restricted partner-API requirement entirely.

Acceptance criteria:
- Output never claims a skill/title not present in the underlying ResumeInfo
- Works with or without a target JD (general optimization vs. JD-flavored)
```

### Phase 7 — Reliability, Observability & India Compliance
*Needed to scale safely once growth (Phase 5) starts working.*

```
Context: no error monitoring/alerting is mentioned in the current architecture, and the
product uses preview-tier LLM models in production with a known prior deprecation.

Build:
1. Add error tracking (Sentry or equivalent) across the FastAPI backend and Next.js
   frontend, with alerting (Slack/email webhook) on repeated Phase 1/Phase 2 generation
   failures beyond the existing refund logic — a refund fixes the user's credit, it
   doesn't tell you something's broken.
2. Document a model-pinning and rollback process: pin exact model version strings in
   config, and require the golden JD matrix (INTEGRATION=1 GOLDEN_FULL=1 GOLDEN_STRICT=1)
   to pass in CI before any LLM_FLASH_MODEL/LLM_PRO_MODEL version bump ships.
3. Add basic rate limiting on public unauthenticated endpoints (/roasts/shared/{share_id},
   the new public ATS checker from Phase 5).
4. Add an explicit India DPDP Act-aligned privacy notice alongside the existing GDPR
   export/delete flow — the current framing is GDPR-only despite the target market being
   Indian job seekers whose resumes carry real PII (employers, sometimes salary history).

Acceptance criteria:
- A simulated repeated-failure scenario triggers an alert, not just a refund
- CI blocks a model-version change if the golden JD matrix regresses
- Public endpoints have a documented rate limit
```

### Phase 8 — Future bets (scope later, don't build yet)

- **Proactive job matching**: ingest job postings and surface STRONG/GOOD matches to users
  without requiring them to paste a JD first. Bigger lift — needs a legal review of
  job-board ToS before any scraping/ingestion approach is chosen.
- **Campus/institutional tier**: bulk-seat licensing and a placement-cell dashboard for
  Indian colleges during placement season — a concentrated, high-volume market fit for
  this product's core promise, but needs its own sales/onboarding motion, not just code.

---

## 4. Suggested sequencing

Phase 1 first, always — it's a direct extension of bugs already identified. Phase 2 and 3
can run in parallel (different surfaces, no shared dependency). Phase 4 depends on Phase 2
having real data flowing. Phase 5 and 6 are independent of everything else and can slot in
whenever bandwidth allows. Phase 7 should land before Phase 5 drives meaningful public
traffic, not after.