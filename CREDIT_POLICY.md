# Credit Gating Policy

## Design Rationale

This document defines which features cost credits and which are free. The core principle: **credits gate AI resume generation (the expensive, high-value operation)**, while supporting features that increase conversion and retention are strategically free or cheap.

---

## Current Credit Model

| Feature | Cost | Rationale |
|---------|------|-----------|
| **Resume Generation** | 1 credit | Core value prop - expensive LLM calls, LaTeX compilation |
| **PDF Recompilation** | FREE | Encourages iteration after chat/manual edits |
| **Profile Enhancement** | FREE (3/day limit) | Onboarding friction reducer |
| **Outreach Messages** | **FREE** | ⚠️ **DECISION NEEDED** |
| **LinkedIn Optimize** | **FREE** | ⚠️ **DECISION NEEDED** |
| **Cover Letter** | FREE | Bundled with resume (uses same evidence_map) |
| **Interview Packet** | Pro/Pass only | Premium feature gate |
| **Fit Analysis** | FREE | Pre-purchase preview (conversion tool) |
| **Public ATS Check** | FREE | Lead magnet (acquisition tool) |

---

## Options for Outreach & LinkedIn Optimize

### **Option A: Keep Free (Status Quo)**
**Pros:**
- Reduces friction for users who already paid for resume
- Encourages full platform adoption (sticky users)
- Outreach messages increase *real* job success → better testimonials → organic growth

**Cons:**
- Users could extract value (LinkedIn profile, outreach templates) without ever buying resume credits
- No recurring revenue from users who only want networking help

**Recommendation:** Keep free **if** you want to optimize for user success and testimonials over pure revenue extraction.

---

### **Option B: Gate Behind Credits**
**Cost Structure:**
- Outreach message: 0.5 credits (cheaper than resume, one-off use)
- LinkedIn optimize: 1 credit (comparable value to resume generation)

**Pros:**
- Prevents "free value extraction" (get LinkedIn profile without paying for core product)
- Recurring revenue from users who iterate on outreach

**Cons:**
- Friction for users who already spent credits on resume
- LinkedIn optimization becomes a separate purchase decision (conversion drop)

**Recommendation:** Only do this **if** you see abuse (users signing up just for LinkedIn optimization without ever generating resumes).

---

### **Option C: Hybrid - First Free, Then Paid**
- First outreach message per job: FREE
- Additional outreach messages: 0.5 credits each
- First LinkedIn optimize per profile: FREE
- Re-optimization with different JD: 1 credit

**Pros:**
- Best of both worlds: try before you buy, but prevents unlimited free usage
- Aligns with "help users succeed" positioning

**Cons:**
- Complexity in UI ("you have 0 free LinkedIn optimizations left")
- Requires additional tracking fields

---

## **Recommended Decision: Option A (Keep Free)**

### Why?
1. **These features drive resume success**, which is what generates testimonials and referrals
2. **Outreach templates** are low-cost to generate (single LLM call, no LaTeX) compared to full resume pipeline
3. **LinkedIn optimization** is a retention play - users who optimize LinkedIn are more engaged and likely to generate more resumes
4. **Abuse risk is low** - if someone wants a LinkedIn profile, there are free tools already. They're here for the resume.

### Monitor for Abuse
Add analytics to track:
- Users who use LinkedIn optimize but never generate resumes
- Users who generate >10 outreach messages without any resume generations

If abuse is detected (>5% of users extracting value without core product purchase), revisit with Option C.

---

## Implementation Status

✅ Resume generation - credit gated  
✅ Profile enhancement - rate limited (3/day), no credits  
✅ Public ATS check - rate limited (30/min per IP), no credits  
⚠️ **Outreach messages - currently free, no gate**  
⚠️ **LinkedIn optimize - currently free, no gate**  

---

## Action Required

**Decision needed:** Approve Option A (keep free) or implement Option B/C gates before production launch.

If keeping free (Option A), document this as intentional product strategy in PRODUCT.md.
