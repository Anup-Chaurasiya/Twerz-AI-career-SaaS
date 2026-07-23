"""Cheap non-LLM invariants for the golden JD matrix (CI ship gate)."""

from __future__ import annotations

import json
import re
from typing import Any

from app.schemas.tailor import EvidenceMap, EvidenceSupport

_CONCRETE_RE = re.compile(r"\d+%?|\b[A-Z][a-zA-Z0-9.+#-]{1,24}\b")


def assert_scores_in_range(result: dict[str, Any], *, allow_missing_ats: bool = False) -> None:
    """fit_score / ats_* must be null or in [0, 100]."""
    for key in ("fit_score", "ats_score_before", "ats_score_after"):
        val = result.get(key)
        if val is None:
            if key == "fit_score":
                raise AssertionError("fit_score must be present")
            if allow_missing_ats:
                continue
            continue
        assert isinstance(val, (int, float)), f"{key} must be numeric, got {type(val)}"
        assert 0 <= int(val) <= 100, f"{key}={val} outside [0, 100]"


def assert_evidence_categories_sum(evidence: EvidenceMap | dict) -> None:
    """SUPPORTED + PARTIAL + MISSING counts must equal len(items)."""
    if isinstance(evidence, dict):
        evidence = EvidenceMap.model_validate(evidence)
    items = evidence.items or []
    counts = {EvidenceSupport.SUPPORTED: 0, EvidenceSupport.PARTIAL: 0, EvidenceSupport.MISSING: 0}
    for item in items:
        support = item.support if isinstance(item.support, EvidenceSupport) else EvidenceSupport(item.support)
        assert support in counts, f"Invalid support value: {support}"
        counts[support] += 1
    total = sum(counts.values())
    assert total == len(items), f"category sum {total} != len(items) {len(items)}"


def assert_ats_moved_or_structure_improved(
    ats_before: int | float | None,
    ats_after: int | float | None,
    structure_before: int | float | None = None,
    structure_after: int | float | None = None,
    *,
    near_ceiling_threshold: int = 90,
) -> None:
    """After generation: ATS after != before OR structural score improved OR already near-ceiling.

    Near-ceiling rule (NEXT.md Phase 1): if the original resume already scores at or above
    `near_ceiling_threshold`, requiring strict improvement is wrong — the score may plateau
    naturally. In that case, a stable score is acceptable.
    """
    assert ats_before is not None and ats_after is not None, "ATS before/after required"
    if int(ats_after) != int(ats_before):
        return  # score moved — invariant satisfied
    # Score didn't move. Check if we're in near-ceiling territory.
    if int(ats_before) >= near_ceiling_threshold:
        return  # near-ceiling plateau is acceptable
    if structure_before is not None and structure_after is not None:
        assert float(structure_after) > float(structure_before), (
            f"ATS unchanged ({ats_before}) and structure did not improve "
            f"({structure_before} → {structure_after})"
        )
        return
    raise AssertionError(f"ATS did not move ({ats_before} → {ats_after}) and no structure scores provided")



def assert_roadmap_policy(fit_label: str, gap_roadmap: dict | list | None) -> None:
    """STRONG → no roadmap; STRETCH/MISMATCH → 3–5 steps."""
    label = (fit_label or "").upper()
    if label == "STRONG":
        assert gap_roadmap in (None, {}, []), f"STRONG must not have gap_roadmap, got {gap_roadmap!r}"
        return
    if label in ("STRETCH", "MISMATCH"):
        assert isinstance(gap_roadmap, dict), f"{label} requires gap_roadmap dict, got {type(gap_roadmap)}"
        steps = gap_roadmap.get("steps") or []
        assert 3 <= len(steps) <= 5, f"{label} roadmap must have 3–5 steps, got {len(steps)}"
        return
    raise AssertionError(f"Unknown fit_label: {fit_label}")


def assert_no_forbidden_tools(resume: dict, forbidden: set[str] | list[str]) -> None:
    blob = json.dumps(resume).lower()
    for tool in forbidden:
        assert tool.lower() not in blob, f"Invented/forbidden tool present: {tool}"


def assert_keyword_coverage(
    result: dict[str, Any],
    *,
    min_supported_pct: float = 95.0,
    fit_label: str = "STRONG",
) -> None:
    """STRONG fit tailored resumes should weave nearly all SUPPORTED keywords."""
    if (fit_label or "").upper() != "STRONG":
        return
    detail = result.get("ats_score_detail") or {}
    coverage = detail.get("keyword_coverage") or {}
    pct = coverage.get("supported_pct")
    if pct is None:
        return
    assert float(pct) >= min_supported_pct, (
        f"STRONG fit supported keyword coverage {pct}% below {min_supported_pct}%"
    )


def _concrete_token_count(text: str) -> int:
    if not text:
        return 0
    return len(_CONCRETE_RE.findall(text))


def assert_specificity_non_regression(bullet_diff: dict | None) -> None:
    """Tailored bullets must not lose concrete tokens (digits / tech-like words) vs original."""
    if not bullet_diff:
        return
    for section_key in ("experiences", "projects"):
        for block in bullet_diff.get(section_key) or []:
            for pair in block.get("pairs") or []:
                original = (pair.get("original") or "").strip()
                tailored = (pair.get("tailored") or "").strip()
                if not original or not tailored:
                    continue
                o_n = _concrete_token_count(original)
                t_n = _concrete_token_count(tailored)
                assert t_n >= o_n, (
                    f"Specificity regression: original concrete={o_n} tailored={t_n} "
                    f"original={original!r} tailored={tailored!r}"
                )
