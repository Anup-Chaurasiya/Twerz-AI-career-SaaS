# Twerz — Prompt Architecture Review

Reviewing the implemented pipeline prompts against the Phase 0-2 fix plan. Verdict per block, then rewritten text for anything that needs to change.

**Legend:** 🔴 Critical — fix before shipping wider · ⚠️ Should strengthen · ✅ Solid as-is

---

## 🔴 Critical

### 1. `STRUCTURED_RESUME_SYSTEM_PROMPT` — no anti-fabrication rule
Guards against dropping content, has zero guard against *adding* content. This is the root of your ground-truth profile — every "never invent" rule downstream assumes this step is 100% faithful. It currently has no reason to be.

**Add this line to the prompt:**
```
CRITICAL: Do NOT add, infer, upgrade, or invent any skill, employer, title, metric, or
detail that is not explicitly present in the source resume text. If something is
ambiguous, illegible, or unclear, leave the field null rather than guessing a plausible
value. This structured output becomes the permanent ground-truth profile for every future
job application — anything invented here will be treated as real evidence forever after.
```

### 2. `ENHANCED_RESUME_SYSTEM_PROMPT` — no honesty guardrails at all
This runs on the base profile in the "AI enhance" flow, before any job-specific tailoring. It's the softest-looking feature in the product and the most dangerous one — "sounds professional" is an open invitation to invent a quantified claim that didn't exist. Once it's in the profile, every evidence map afterward treats it as real.

**Replace with:**
```python
ENHANCED_RESUME_SYSTEM_PROMPT = """
You are an expert resume editor improving how existing content READS — not what it claims.

## Absolute rules
- NEVER add a skill, tool, employer, title, metric, percentage, or scope that is not
  already present in the input.
- NEVER upgrade a soft claim into a quantified one (e.g. do not turn "worked on user
  features" into "increased engagement by 25%" — that number does not exist).
- You may improve grammar, word choice, structure, and conciseness.
- You may strengthen a weak verb (e.g. "helped with" -> "built") ONLY when the underlying
  fact is unchanged and no new capability or scope is implied.
- If content is vague, make it read clearly and confidently using ONLY the facts given —
  do not fill the gap with an invented specific.
- Resume structure stays the same — this is a content-quality pass, not a rewrite.
- Output must be at least as information-dense as the input: same or more real facts,
  never fewer, never fabricated.

Output the resume in the structured JSON format provided.
"""
```
Also worth running this through the same `BULLET_QUALITY`-style regression check you already built for tailoring — you have the machinery, it just isn't reused here yet.

### 3. Score fields are likely unconstrained at the schema level
If Fit Score / ATS Score are plain LLM-generated numbers rather than schema-validated fields, that's the actual source of the earlier -100 reading — clamping post-hoc treats the symptom.

**Fix at the Pydantic model, not the prompt:**
```python
fit_score: int = Field(ge=0, le=100)
ats_score: int = Field(ge=0, le=100)
```
This makes a bad LLM output fail validation and retry/error, instead of silently persisting a garbage value anywhere downstream (analytics, tracker cards, admin dashboards).

---

## ⚠️ Should strengthen

### 4. `CUSTOM_RESUME_SYSTEM_PROMPT` / `CUSTOM_RESUME_USER_PROMPT` — legacy fallback risk
Marked "backward-compatible single-shot... pipeline uses multi-pass prompts below." Fine if genuinely dead code. But if it's still reachable as an error fallback anywhere in the orchestration, it has **none** of the density rules, seniority-honesty rules, or evidence-map grounding the rest of the system now enforces. A silent fallback here would quietly regress a user straight back into the exact bug you're fixing.
**Action:** confirm no code path can reach it; if any can, either delete it or make that failure path raise a hard error ("generation failed, no credit charged") instead of silently degrading.

### 5. Evidence map SUPPORTED/PARTIAL/MISSING has no calibration examples
This one classification is the load-bearing wall of the entire honesty system — Fit score, ATS score, resume content, cover letter, and interview packet all inherit from it. Right now it's judgment-only, which means classification can drift between runs on borderline cases.

**Add a calibration block to `EVIDENCE_MAP_SYSTEM_PROMPT`:**
```
## Calibration examples
- JD wants "Kubernetes"; candidate mentions Docker + one line about "basic K8s exposure"
  -> PARTIAL, quote the K8s line, transferable_angle = containerization experience.
- JD wants "GraphQL API design"; candidate has "Designed GraphQL APIs processing 100+
  daily requests" -> SUPPORTED, quote it directly.
- JD wants "Okta administration"; candidate profile never mentions IAM, SSO, or any
  identity platform -> MISSING. A general OAuth/JWT mention is PARTIAL for "identity
  protocols" broadly, but does NOT make a named product requirement (Okta, specifically)
  anything better than MISSING.
```

### 6. Evidence-map quotes aren't verified against the source
"Quote short evidence" is good practice, but nothing confirms the quote is an actual substring of `user_info` rather than a plausible-sounding paraphrase the model generated. Add a cheap post-processing check: if the quoted span isn't a close match to the source text, downgrade that item's confidence or flag it for review rather than trusting it silently.

### 7. Binary `WRITE_MODE_STRONG` / `WRITE_MODE_TRANSFERABLE` is too coarse
A candidate at 70% genuine alignment gets the same maximally-conservative treatment as one at 10%. Consider a third tier:

```python
WRITE_MODE_STRETCH = """## Write mode: STRETCH (partial alignment)
Genuine reach, not a hard mismatch — meaningful PARTIAL/SUPPORTED overlap exists.
- Weave SUPPORTED and PARTIAL keywords naturally, more assertively than TRANSFERABLE-ONLY,
  less aggressively than STRONG.
- Describe PARTIAL evidence as what it actually is (e.g. "authentication logic via
  OAuth/JWT", not "IAM platform administration").
- Headline may gesture toward the target domain only if 2+ must-haves are SUPPORTED or
  strong PARTIAL matches.
- Pair with a shorter 1-2 item Gap-Closing Roadmap, since the gap is smaller.
"""
```
Pick the mode from Fit Score bands (e.g. 70-100 Strong / 35-69 Stretch / 0-34 Transferable-only) — tune the actual cutoffs against your golden JD matrix rather than guessing.

### 8. `skills.security` is hardcoded to one domain
Reads like a leftover from testing against the IAM JD specifically. For a data engineer or DevOps JD, this bucket does nothing. Generalize to a dynamic domain-relevant skills category derived from the JD analysis (e.g. `skills.domain_relevant`) rather than a fixed "security" field.

### 9. Repair-prompt violation detection — confirm it catches paraphrase, not just exact match
`COVER_LETTER_REPAIR_PROMPT` / `INTERVIEW_PACKET_REPAIR_PROMPT` are a solid defense-in-depth pattern. Just confirm the upstream violation-detection step is semantic (LLM or embedding-based), not a literal substring search — a model can imply "identity governance tooling" without ever writing the word "Okta," and a pure string match would miss it.

### 10. No stated cap on the refine loop
Write → ATS score → bullet quality → refine → (recheck?) is now a real chain. Worth an explicit max-retry (e.g. 2 refine passes) with logging when the cap is hit, both for cost/latency control and so repeated failures surface as a monitoring signal instead of silently looping.

### 11. `ROAST_SYSTEM_PROMPT` has no redline against personal/identity content
It's a public, shareable, viral feature — the humor guardrail ("sting but clever, not mean-spirited") isn't quite the same as a hard boundary. Add:
```
## Off-limits — never joke about
Name origin/ethnicity, age (including inferring age from graduation year), gender,
disability, appearance, or any personal/protected characteristic. Never assume or joke
about the reason for an employment gap (could be medical, caregiving, layoffs). Roast the
content, formatting, wording, and presentation choices only — never the person.
```

### 12. Dangling reference: "unverifiable" metrics
`CUSTOM_RESUME_WRITE_SYSTEM_PROMPT` says to preserve every metric "unless the evidence map flags it as unverifiable" — but `EVIDENCE_MAP_SYSTEM_PROMPT` never actually produces that flag anywhere. Either add a `metric_verifiable` signal to the evidence-map schema, or drop the clause from the write prompt so it isn't referencing a signal that will never arrive.

---

## ✅ Genuinely solid, keep as-is

- Multi-pass pipeline shape (analysis → evidence → write → score → bullet-quality → refine) — the right architecture for this problem.
- Density/no-regression rules in the write prompt + `BULLET_QUALITY` as an automated check — this is the direct fix for "the resume got worse than my original."
- `ATS_SCORE_SYSTEM_PROMPT` explicitly separating structure/keyword-hygiene from role-fit — correct fix for the 25→25 bug, assuming the refine step is now code-level guaranteed to run regardless of verdict (worth a quick log-based confirmation in prod).
- `GAP_ROADMAP` — this is a genuinely good feature, exactly the "dead end → forward path" fix, and it correctly refuses to suggest inventing experience.
- Seniority-honesty enforced in both the evidence map and the write prompt, not just one.
- Repair-prompt pattern on cover letter / interview packet — real defense in depth.

---

## Priority order to actually fix

1. `STRUCTURED_RESUME_SYSTEM_PROMPT` anti-fabrication line (#1) — one-line change, closes the biggest hidden risk.
2. `ENHANCED_RESUME_SYSTEM_PROMPT` full rewrite (#2) — same severity, same reason.
3. Score field constraints at the Pydantic level (#3) — kills the -100 bug at its actual source.
4. Confirm/kill the legacy single-shot fallback path (#4).
5. Everything else in ⚠️ — real improvements, none of them urgent enough to block a release once 1-4 are done.