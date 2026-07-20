"""Honesty helpers: never mention MISSING-evidence tools in generated side content."""

from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from typing import Any

from app.schemas.tailor import EvidenceItem, EvidenceMap, EvidenceSupport

QUOTE_MATCH_THRESHOLD = 0.72


def forbidden_tools_from_evidence(evidence_map: EvidenceMap | dict | None) -> set[str]:
    """Extract tool/title tokens from MISSING evidence items."""
    if not evidence_map:
        return set()
    if isinstance(evidence_map, dict):
        evidence_map = EvidenceMap.model_validate(evidence_map)
    forbidden: set[str] = set()
    for item in evidence_map.items or []:
        support = item.support
        if not isinstance(support, EvidenceSupport):
            try:
                support = EvidenceSupport(support)
            except ValueError:
                continue
        if support != EvidenceSupport.MISSING:
            continue
        req = (item.requirement or "").strip()
        if not req:
            continue
        # Keep multi-word requirements and significant tokens (Okta, SAML, etc.)
        forbidden.add(req.lower())
        for tok in re.findall(r"[A-Za-z][A-Za-z0-9.+#/-]{1,40}", req):
            if len(tok) >= 3:
                forbidden.add(tok.lower())
    return forbidden


def find_forbidden_in_text(text: str, forbidden: set[str] | list[str]) -> list[str]:
    """Return forbidden terms that appear as whole-ish tokens in text (case-insensitive)."""
    if not text or not forbidden:
        return []
    blob = text.lower()
    hits: list[str] = []
    for term in sorted(set(forbidden), key=len, reverse=True):
        t = term.lower().strip()
        if len(t) < 3:
            continue
        # Multi-word: substring; single token: word-boundary-ish
        if " " in t or "/" in t or "-" in t:
            if t in blob:
                hits.append(term)
        else:
            if re.search(rf"(?<![a-z0-9]){re.escape(t)}(?![a-z0-9])", blob):
                hits.append(term)
    return hits


def find_forbidden_in_obj(obj: Any, forbidden: set[str] | list[str]) -> list[str]:
    """Scan nested dict/list/str for forbidden terms."""
    blob = json.dumps(obj) if not isinstance(obj, str) else obj
    return find_forbidden_in_text(blob, forbidden)


def strip_forbidden_mentions(text: str, hits: list[str]) -> str:
    """Best-effort redact remaining forbidden terms after a failed re-prompt."""
    out = text
    for term in sorted(hits, key=len, reverse=True):
        out = re.sub(re.escape(term), "[redacted]", out, flags=re.IGNORECASE)
    return out


def flatten_profile_text(profile_info: dict | Any) -> str:
    """Flatten profile JSON into searchable text for quote verification."""
    if hasattr(profile_info, "model_dump"):
        data = profile_info.model_dump(mode="json")
    elif isinstance(profile_info, dict):
        data = profile_info
    else:
        data = {}
    return json.dumps(data, ensure_ascii=False).lower()


def quote_matches_source(quote: str | None, source_text: str, *, threshold: float = QUOTE_MATCH_THRESHOLD) -> bool:
    """True if quote is a substring of source or fuzzy-matches a source window."""
    if not quote or not quote.strip() or not source_text:
        return False
    q = quote.strip().lower()
    src = source_text.lower()
    if q in src:
        return True
    # Compare against line-sized windows and sliding chunks near quote length
    windows: list[str] = []
    for line in re.split(r"[\n\"|,]+", src):
        line = line.strip()
        if len(line) >= 8:
            windows.append(line)
    q_len = len(q)
    step = max(8, q_len // 2)
    for i in range(0, max(1, len(src) - q_len + 1), step):
        windows.append(src[i : i + max(q_len, 40)])
    best = 0.0
    for w in windows:
        if not w:
            continue
        best = max(best, SequenceMatcher(None, q, w).ratio())
        if best >= threshold:
            return True
    return False


def verify_evidence_quotes(
    evidence_map: EvidenceMap,
    profile_info: dict | Any,
    *,
    threshold: float = QUOTE_MATCH_THRESHOLD,
) -> tuple[EvidenceMap, int]:
    """Downgrade SUPPORTED→PARTIAL when evidence_quote is not grounded in the profile.

    Returns (updated_map, unverified_count).
    """
    source = flatten_profile_text(profile_info)
    unverified = 0
    new_items: list[EvidenceItem] = []
    for item in evidence_map.items or []:
        quote = item.evidence_quote
        support = item.support
        if not isinstance(support, EvidenceSupport):
            try:
                support = EvidenceSupport(support)
            except ValueError:
                new_items.append(item)
                continue
        if quote and support == EvidenceSupport.SUPPORTED:
            if not quote_matches_source(quote, source, threshold=threshold):
                unverified += 1
                new_items.append(
                    item.model_copy(
                        update={
                            "support": EvidenceSupport.PARTIAL,
                            "evidence_quote": quote,  # keep for review; no longer hard proof
                        }
                    )
                )
                continue
        elif quote and support in (EvidenceSupport.SUPPORTED, EvidenceSupport.PARTIAL):
            if not quote_matches_source(quote, source, threshold=threshold):
                unverified += 1
        new_items.append(item)
    if unverified == 0:
        return evidence_map, 0
    return evidence_map.model_copy(update={"items": new_items}), unverified


def missing_requirements_list(evidence_map: EvidenceMap | dict | None) -> list[str]:
    """Human-readable MISSING requirement strings for semantic scan prompts."""
    if not evidence_map:
        return []
    if isinstance(evidence_map, dict):
        evidence_map = EvidenceMap.model_validate(evidence_map)
    out: list[str] = []
    for item in evidence_map.items or []:
        support = item.support
        if not isinstance(support, EvidenceSupport):
            try:
                support = EvidenceSupport(support)
            except ValueError:
                continue
        if support == EvidenceSupport.MISSING and item.requirement:
            out.append(item.requirement.strip())
    # Also include top-level gaps
    for g in evidence_map.gaps or []:
        g = (g or "").strip()
        if g and g not in out:
            out.append(g)
    return out
