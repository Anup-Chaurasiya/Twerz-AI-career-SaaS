"""Roast ATS checklist honesty: details must not invent tools absent from resume text."""

from __future__ import annotations

import re
from typing import Any

# Proper nouns / tools that look invented if absent from source text
_TECH_TOKEN_RE = re.compile(r"\b([A-Z][a-zA-Z0-9.+#-]{2,30})\b")


def invented_terms_in_ats_checklist(
    ats_checklist: list[dict[str, Any]] | None,
    resume_text: str,
    *,
    suspicious_extra: set[str] | list[str] | None = None,
) -> list[str]:
    """Return terms that appear in checklist details but not in resume_text.

    Always checks ``suspicious_extra`` (e.g. Okta) when provided. Also flags
    TitleCase tech-like tokens in details that are absent from the source text.
    """
    if not ats_checklist:
        return []
    source = (resume_text or "").lower()
    hits: list[str] = []
    extras = {t.lower() for t in (suspicious_extra or [])}
    for item in ats_checklist:
        detail = (item.get("detail") or "") if isinstance(item, dict) else ""
        detail_l = detail.lower()
        for term in extras:
            if term and re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", detail_l):
                if term not in source:
                    hits.append(term)
        for tok in _TECH_TOKEN_RE.findall(detail):
            tl = tok.lower()
            # Skip common English words that match the pattern
            if tl in {"ats", "pdf", "the", "and", "for", "with", "this", "that", "from", "your"}:
                continue
            if tl not in source and tl not in hits:
                # Only flag if it looks like a product/tool (has digit, or known-ish length)
                if any(c.isdigit() for c in tok) or tok[0].isupper():
                    hits.append(tok)
    return hits


def assert_ats_checklist_grounded(
    ats_checklist: list[dict[str, Any]] | None,
    resume_text: str,
    *,
    forbidden_if_absent: set[str] | list[str] | None = None,
) -> None:
    """Raise AssertionError if checklist invents forbidden-absent tools."""
    hits = invented_terms_in_ats_checklist(
        ats_checklist, resume_text, suspicious_extra=forbidden_if_absent
    )
    # Only enforce explicit forbidden list for unit tests (TitleCase heuristic is soft)
    if forbidden_if_absent:
        forbidden_l = {t.lower() for t in forbidden_if_absent}
        bad = [h for h in hits if h.lower() in forbidden_l]
        assert not bad, f"ATS checklist invents tools not in resume text: {bad}"
