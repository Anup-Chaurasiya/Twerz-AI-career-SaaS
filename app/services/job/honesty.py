"""Honesty helpers: never mention MISSING-evidence tools in generated side content."""

from __future__ import annotations

import re
from typing import Any

from app.schemas.tailor import EvidenceMap, EvidenceSupport


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
    import json

    blob = json.dumps(obj) if not isinstance(obj, str) else obj
    return find_forbidden_in_text(blob, forbidden)


def strip_forbidden_mentions(text: str, hits: list[str]) -> str:
    """Best-effort redact remaining forbidden terms after a failed re-prompt."""
    out = text
    for term in sorted(hits, key=len, reverse=True):
        out = re.sub(re.escape(term), "[redacted]", out, flags=re.IGNORECASE)
    return out
