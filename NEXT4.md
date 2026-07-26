# Resume Template Selection & Format Preservation
### Phase-wise plan, scoped to what's actually achievable

---

## The honest technical premise (read before the phases)

"Show the user their uploaded format as an option, and generate the tailored resume in
that same format" splits into two very different problems depending on what was uploaded:

- **If the original was a .docx**: real, faithful format preservation is achievable. DOCX
  has actual structure — named styles, text runs — that can be edited in place.
- **If the original was a PDF** (the majority case, and the only case for scanned resumes
  going through the Gemini Vision OCR fallback): there is no reliable structure to recover.
  A PDF is painted glyphs at coordinates, not a reflowable document. "Exact recreation" is
  not a realistic target here — treat it as best-effort style-matching against a small
  template library instead, and say so honestly in the UI.

Don't build toward "clone any uploaded resume exactly" as a single feature — build toward
"real preservation for docx, honest best-effort matching for PDF, plus a small library of
genuinely good house templates for everyone," which is what's actually deliverable.

---

## Phase 1 — Template Library Foundation

```
Context: only one LaTeX template (resume.cls) exists today. Users need a real choice, not
just the illusion of one.

Build:
1. Build a second, genuinely distinct LaTeX template (e.g. a clean modern layout) alongside
   the existing one. Add a template_id field to Job, defaulting to the current template for
   backward compatibility.
2. Abstract the LaTeX builder service to accept a template_id and route to the correct
   .cls/layout — extend the existing sanitizer to cover both templates' specific escaping
   needs (don't assume the new template's special-character handling is identical).
3. Frontend: a template picker shown after tailoring completes, with a live preview of both
   options before committing. Switching templates re-renders the already-tailored data —
   this is a free action (same as the existing free recompile), never a new credit charge.
4. If the second template uses a multi-column layout: show an explicit, honest tradeoff
   note — "this layout may score lower on ATS parseability — better suited when you know a
   human will read it first (referrals, direct outreach) than for blind ATS-scanned
   applications." This isn't optional cosmetic copy — it's your own ATS checklist logic
   being contradicted by a prettier template, and users deserve to know that tradeoff
   exists before they pick it.

Acceptance criteria:
- Both templates render correctly across the full golden JD matrix
- Switching templates never deducts a credit
- The multi-column option (if built) visibly discloses the ATS tradeoff
```

## Phase 2 — True Format Preservation for DOCX-Original Uploads

```
Context: this is the one case where "generate in the format they uploaded" is actually
achievable, because .docx has real, editable structure.

Build:
1. When the original upload is a .docx (not PDF), retain the parsed document object itself
   as part of the profile — not just the extracted text — so it can be edited later rather
   than only mined for content once.
2. Build a mapping step: match each structured ResumeInfo field (a bullet, a title, a date)
   back to its originating text run in the source docx. Confidence-score each match.
3. For high-confidence matches: replace the run's text content with the tailored version
   in place, preserving that run's exact font/style/spacing — this is real format
   preservation, not a template render.
4. For low-confidence matches (complex tables, text boxes, unusual nested formatting):
   don't attempt a risky in-place edit that could produce garbled output. Fall back
   cleanly to "we couldn't safely preserve your original layout — here's your closest
   house template instead" rather than silently shipping a broken document.

Acceptance criteria:
- A standard single-column docx resume gets tailored content injected in place with
  formatting visibly intact
- A complex table-based or heavily custom docx triggers the fallback path with a clear
  message, never a garbled silent output
```

## Phase 3 — Best-Effort Style Matching for PDF-Original Uploads

```
Context: the majority of uploads are PDF, where true in-place editing isn't possible. Scope
this honestly as "closest match," never "exact copy."

Build:
1. Extract coarse visual signals from the original PDF using pdfplumber's layout/bounding-
   box data already available in the pipeline: single-column vs multi-column, rough font
   category (serif/sans), any dominant accent color if detectable.
2. Use these signals to auto-select the closest house template (from Phase 1's library) as
   the default suggestion, rather than defaulting everyone to the original single template
   regardless of what they actually had.
3. UI copy must say "closest match to your original" explicitly — never imply this is a
   reproduction. This is the same honesty principle already enforced in the tailoring
   prompts, applied to visual presentation instead of content.
4. For scanned/image-only PDFs processed via the Gemini Vision OCR fallback: skip
   style-detection entirely and go straight to the standard template picker — there's no
   reliable layout signal to extract from an image-based scan worth building around.

Acceptance criteria:
- A 2-column original PDF defaults to the 2-column house template rather than silently
  defaulting to single-column
- No UI copy anywhere implies exact reproduction for a PDF-original upload
```

## Phase 4 — Version History & Free-Tier Consistency

```
Context: template choice needs to be a first-class part of the existing version history
and pricing model, not bolted on separately.

Build:
1. Store template_id on each resume_versions entry, so restoring an old version restores
   its associated template, not just its content.
2. Confirm template switching alone (no content change) never consumes a credit —
   consistent with the existing free-recompile design.
3. Extend the golden JD matrix test suite to run across every template, not just the
   original — a template-specific rendering bug should be caught the same way a tailoring
   regression would be.

Acceptance criteria:
- Restoring a past version also restores the correct template for that version
- Golden JD matrix passes on every template, not just the default one
```

---

## Sequencing

Phase 1 first — it's the real, deliverable "let users choose a template" feature and
stands alone. Phase 2 next, since DOCX-original preservation is a genuine differentiator
worth having. Phase 3 depends on Phase 1's library existing. Phase 4 is cleanup — do it
alongside whichever of 1-3 you ship last, not as an afterthought once bugs show up in
production.