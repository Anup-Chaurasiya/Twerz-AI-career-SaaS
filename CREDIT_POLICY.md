# Credit Gating Policy

## Design Rationale

This document defines which features cost credits and which are free. The core principle: **credits gate AI resume generation (the expensive, high-value operation)**, while supporting features that increase conversion and retention are strategically free or cheap.

---

## Current Credit Model

| Feature | Cost | Rationale |
|---------|------|-----------|
| **Signup bonus** | **100 credits** (one-time) | Onboarding runway — ~10 tailors before first purchase |
| **Daily free pool** | **20 credits/day** | ~2 tailors/day; resets midnight UTC |
| **Resume Generation** | **10 credits** | Core value prop — expensive LLM calls, LaTeX compilation |
| **PDF Recompilation** | FREE | Encourages iteration after chat/manual edits |
| **Profile Enhancement** | FREE (3/day limit) | Onboarding friction reducer |
| **Outreach Messages** | **FREE** | Drives application success → testimonials |
| **LinkedIn Optimize** | **FREE** | Retention play |
| **Cover Letter** | FREE | Bundled with resume (uses same evidence_map) |
| **Interview Packet** | Pro/Pass only | Premium feature gate |
| **Fit Analysis** | FREE | Pre-purchase preview (conversion tool) |
| **Public ATS Check** | FREE | Lead magnet (acquisition tool) |

---

## Paid packs (DB-managed)

| Pack | Credits | Price | ~Tailors |
|------|---------|-------|----------|
| Starter | 500 | ₹279 | 50 |
| Sprint | 1,200 | ₹599 | 120 |
| Job Hunt | 2,500 | ₹949 | 250 |

Credit packs add **credits only** — same platform features for all packs. Interview packets & Chrome extension require **Job Hunt Pro**.

Job Hunt Pro subscription: 800 credits/month (~80 tailors) @ ₹299 (includes tracker, interview packets, extension).

---

## Consumption & refund rules

1. **Priority**: time pass (unlimited) → daily free pool → purchased balance
2. **Split deduction**: if daily pool has partial credits (e.g. 8 left, cost 10), uses daily first then purchased
3. **Refund**: full cost restored to correct bucket(s) if Phase 1 generation fails
4. **Time pass**: audit-only on refund (unlimited)

---

## Recommended Decision: Keep outreach & LinkedIn free (Option A)

Outreach and LinkedIn optimize remain free — they drive resume success and referrals.

---

## Implementation Status

✅ Resume generation — 10 credits per tailor  
✅ Signup bonus — 100 credits on first OAuth signup  
✅ Daily free — 20 credit pool/day  
✅ Profile enhancement — rate limited (3/day), no credits  
✅ Public ATS check — rate limited (30/min per IP), no credits  
✅ Outreach messages — free  
✅ LinkedIn optimize — free  
