# Twerz — Admin Visibility & Monitoring Roadmap
### Phase-wise build prompts (paste each into Claude Code)

---

## 0. What already exists (don't rebuild)

Users list, credit grants + history, tenant/domain-rule management, credit pack/time-pass/promo CRUD, transactions list, share analytics, subscription plan management, aggregate LLM cost on the overview page.

## 1. What's actually missing

Everything shipped in Phases 1-7 (calibration, referrals, outreach messages, public endpoints, LinkedIn optimizer) currently has **zero admin visibility** — no dashboard, no abuse detection, no cost breakdown. And there's no single place to see "everything about user X" without jumping across five tabs.

---

## Phase A — User 360 View & Admin Action Audit Log
*Ships first — you need this to debug support issues on everything else you just built.*

```
Context: admin/users currently lists users but has no single drill-down view. Debugging
"user X says feature Y is broken" requires manually cross-referencing jobs, credits,
roasts, and referrals separately.

Build:
1. GET /admin/users/{id}/detail — one call returning: account info, all jobs with
   fit_score/ats_score/application_status funnel, roast history, referral stats (their
   code, how many they've referred, bonus grants received/given), current credit balance +
   active subscription/time pass, total LLM cost attributed to this user, and any recent
   job failures (pdf_error_log entries, refund transactions) for this user specifically.
2. AdminAuditLog table: every admin mutation (credit grant, tenant reassignment, promo
   code edit/delete, manual calibration recompute trigger) writes a row —
   admin_user_id, action, target_type, target_id, before, after, created_at.
   GET /admin/audit-log to view it, filterable by admin or target user.
3. Optional read-only "view as user" mode for support debugging — no write access,
   every use is itself logged in AdminAuditLog.

Acceptance criteria:
- One API call returns everything needed to debug a specific user's issue
- Every admin mutation produces exactly one audit log row, no exceptions
```

## Phase B — Referral & Growth Integrity (fraud control)
*Second priority — real money exposure exists right now with zero detection.*

```
Context: the Phase 5 referral system grants credits per successful referred signup with
no abuse detection. This is a live fraud surface today, not a future risk.

Build:
1. Flagged-referrals detection: surface referral pairs where referrer and referred account
   share an IP address or device fingerprint at signup, or where a single referrer has
   more than N bonus grants (configurable) within a short rolling window (e.g. 5 in 1
   hour). Store as a queryable "suspicious" flag, don't auto-block — surface for manual
   review before/alongside the bonus payout.
2. GET /admin/referrals/flagged — list of flagged referral pairs with the signal that
   triggered the flag (IP match, velocity, etc).
3. Admin calibration dashboard: visualize the existing GET /admin/calibration data as a
   simple chart (fit_label x ats_bucket -> interview/offer rate), with bands below
   CALIBRATION_MIN_SAMPLE visually distinguished as "not enough data yet" rather than
   shown as if reliable.
4. Public endpoint usage panel: request volume, unique IP count, and 429 (rate-limit-hit)
   rate over time for /public/ats-check and /roasts/shared/{id} — catches scraping/bot
   abuse on your unauthenticated surfaces.

Acceptance criteria:
- At least IP-collision and grant-velocity signals are detected and listed
- Calibration bands below the minimum sample size are visually flagged, not presented as
  equally reliable
```

## Phase C — System Health & Reliability Panel

```
Context: Phase 1 added pdf_verified_readable and Phase 7 (per your summary) added error
tracking — neither is currently visible anywhere in admin.

Build:
1. Health panel on admin overview: rolling 24h/7d error rate broken down by failure type
   (Phase 1 AI generation failure vs Phase 2 PDF failure vs pdf_verified_readable=false
   rate), plus refund volume/rate over the same windows.
2. Model/version status widget: currently pinned LLM_FLASH_MODEL / LLM_PRO_MODEL values,
   last golden-JD-matrix run result + timestamp, and a manual "run golden matrix now"
   trigger with the result shown inline once complete.
3. Alert test button: fires a test alert through the same Slack/email channel configured
   for production failure alerts, so you can confirm delivery without waiting for a real
   failure.

Acceptance criteria:
- Failure breakdown reflects real counts queried from the DB, not placeholder values
- Alert test button produces a real, visible message in the configured channel
```

## Phase D — Financial & Cost Breakdown

```
Context: LLM cost is currently shown as one aggregate number. With outreach messages,
LinkedIn optimization, calibration compute, and the public ATS checker now live, several
new call types exist that generate cost with little or no attached revenue.

Build:
1. Break down LLMRequest cost by feature/endpoint (resume tailoring, cover letter,
   interview packet, outreach message, LinkedIn optimizer, public ATS checker, roast) —
   not just a single aggregate — so a cost spike can be traced to a specific feature.
2. Per-user revenue-vs-cost view: total Razorpay revenue from a user against total
   attributed LLM cost, to spot cost-negative heavy users of free features.
3. Free-tier consumption tracking: daily free credit usage rate, profile "AI enhance"
   3/day usage rate, and public ATS checker volume — visibility into how much value is
   given away free vs. converting to paid.

Acceptance criteria:
- Cost is queryable by feature for any given day/week range
- A single user's revenue-vs-cost total is available in the Phase A user detail view
```

## Phase E — Fraud/Abuse & Compliance Log

```
Context: payments + credits + promo codes + referrals together create real fraud surface
beyond just referrals (Phase B), and there's no compliance-grade audit trail for data
requests despite handling PII-heavy resumes for Indian users.

Build:
1. Flagged-accounts view: multiple signups from the same IP/device within a short window,
   or unusual credit-transaction patterns (e.g. repeated REFUND entries clustering on one
   user — could indicate either a bug specific to their inputs or deliberate abuse of the
   fail-then-refund flow; surface it either way for a human to check).
2. Data-request audit log: every account export (/account/export) and deletion request
   (DELETE /account) logged with user_id and timestamp, queryable by admin — this is
   separate from Phase A's admin-action log, since this tracks user-initiated requests for
   DPDP/GDPR compliance defensibility, not admin actions.

Acceptance criteria:
- Flagged-accounts view surfaces at least IP-collision signals across signups
- Every export/delete request is logged and independently queryable
```

## Phase F — "Something crazy": Live Ops Command Center + Cohort Retention

```
Context: none of this is necessary, all of it is genuinely fun and useful for a solo
founder who wants a pulse-check on the product without digging through five tabs.

Build:
1. A single real-time-ish admin screen (SSE or short-poll, ~30s max staleness) showing:
   jobs generating right now, signups today ticking up, revenue today ticking up, current
   rolling error rate — a "mission control" view.
2. Weekly signup cohort retention chart: of users who signed up in week N, what percentage
   generated at least one resume in week N, N+1, N+2, N+3. Standard retention curve,
   currently completely absent — arguably more useful long-term than any single KPI number
   on the current overview page, since it's the real signal for whether growth is durable.

Acceptance criteria:
- Command center reflects real data with no more than ~30s staleness
- Cohort retention chart computes correctly across at least 4 weeks of real cohorts
```

---

## Suggested order

**A → B → C → D → E → F.**

A first because you need one place to debug anything else. B immediately after, because
it's the one item on this list with real money walking out the door *today*, not a
future risk. C and D are both important but not urgent in the same way. E matters more
as usage scales. F whenever you want something satisfying to build — it doesn't block
anything else.