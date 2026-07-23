"""Deterministic resume quality validators for the tailor pipeline."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from app.schemas.tailor import EvidenceMap, EvidenceSupport, FitLabel, RecruiterReviewResult

# ~35-45 dense content lines per page when estimating from profile alone
_LINES_PER_PAGE = 40
_QUANT_RE = re.compile(r"\d+%?|\b\d{1,3}(?:,\d{3})+\b|\b\d+\.\d+\b")

# Stage 7 (Recruiter Review) gate: every sub-score must be >= this to pass without a rewrite.
RECRUITER_SCORE_THRESHOLD = 8
MAX_RECRUITER_PASSES = 2

# Repeating the same leading bullet verb more than this many times *consecutively*
# reads as robotic/AI-generated (NEXT3.md bullet rules).
_MAX_CONSECUTIVE_REPEATED_VERB = 2
_BULLET_MAX_CHARS = 220  # ~2 lines proxy
_STOPWORDS = frozenset(
    {
        "the", "and", "for", "with", "that", "this", "from", "into", "across", "using",
        "a", "an", "of", "to", "in", "on", "by", "as", "at", "is", "are", "was", "were",
    }
)


@dataclass
class KeywordCoverageResult:
    supported_total: int
    supported_matched: int
    partial_total: int
    partial_matched: int
    supported_pct: float
    combined_pct: float
    missing_supported: list[str] = field(default_factory=list)
    missing_partial: list[str] = field(default_factory=list)


@dataclass
class ValidationResult:
    passed: bool
    issues: list[str] = field(default_factory=list)


def _resume_blob(resume: dict) -> str:
    return json.dumps(resume, ensure_ascii=False).lower()


def _requirement_in_text(requirement: str, blob: str) -> bool:
    req = (requirement or "").strip().lower()
    if not req:
        return False
    if req in blob:
        return True
    tokens = re.findall(r"[a-z0-9][a-z0-9.+#/-]{1,40}", req)
    if not tokens:
        return False
    significant = [t for t in tokens if len(t) >= 3]
    if not significant:
        significant = tokens
    matched = sum(1 for t in significant if t in blob)
    return matched >= max(1, len(significant) * 0.6)


def compute_keyword_coverage(resume: dict, evidence_map: EvidenceMap | dict) -> KeywordCoverageResult:
    """Measure how many SUPPORTED/PARTIAL requirements appear in resume text."""
    if isinstance(evidence_map, dict):
        evidence_map = EvidenceMap.model_validate(evidence_map)
    blob = _resume_blob(resume)

    supported_total = 0
    supported_matched = 0
    partial_total = 0
    partial_matched = 0
    missing_supported: list[str] = []
    missing_partial: list[str] = []

    for item in evidence_map.items or []:
        support = item.support if isinstance(item.support, EvidenceSupport) else EvidenceSupport(item.support)
        req = (item.requirement or "").strip()
        if not req:
            continue
        if support == EvidenceSupport.SUPPORTED:
            supported_total += 1
            if _requirement_in_text(req, blob):
                supported_matched += 1
            else:
                missing_supported.append(req)
        elif support == EvidenceSupport.PARTIAL:
            partial_total += 1
            if _requirement_in_text(req, blob):
                partial_matched += 1
            else:
                missing_partial.append(req)

    supported_pct = (100.0 * supported_matched / supported_total) if supported_total else 100.0
    combined_total = supported_total + partial_total
    combined_matched = supported_matched + partial_matched
    combined_pct = (100.0 * combined_matched / combined_total) if combined_total else 100.0

    return KeywordCoverageResult(
        supported_total=supported_total,
        supported_matched=supported_matched,
        partial_total=partial_total,
        partial_matched=partial_matched,
        supported_pct=supported_pct,
        combined_pct=combined_pct,
        missing_supported=missing_supported,
        missing_partial=missing_partial,
    )


def _count_profile_bullets(profile: dict, *, split_fn) -> dict[str, int]:
    """Return bullet counts keyed by normalized company|role or project name."""
    counts: dict[str, int] = {}
    for exp in profile.get("past_experience") or profile.get("experience") or []:
        if not isinstance(exp, dict):
            continue
        company = str(exp.get("company_name") or exp.get("company") or "").strip().lower()
        role = str(exp.get("role") or "").strip().lower()
        key = f"exp:{company}|{role}"
        counts[key] = len(split_fn(exp.get("description")))
    for proj in profile.get("projects") or []:
        if not isinstance(proj, dict):
            continue
        name = str(proj.get("name") or "").strip().lower()
        key = f"proj:{name}"
        counts[key] = len(split_fn(proj.get("description")))
    return counts


def validate_content_preservation(profile: dict, resume: dict, *, split_fn) -> ValidationResult:
    """Ensure tailored resume retains all profile sections and bullet counts."""
    issues: list[str] = []

    profile_exp = {
        (
            str(e.get("company_name") or e.get("company") or "").strip().lower(),
            str(e.get("role") or "").strip().lower(),
        )
        for e in (profile.get("past_experience") or profile.get("experience") or [])
        if isinstance(e, dict)
    }
    resume_exp = {
        (
            str(e.get("company_name") or "").strip().lower(),
            str(e.get("role") or "").strip().lower(),
        )
        for e in (resume.get("past_experience") or [])
        if isinstance(e, dict)
    }
    missing_exp = profile_exp - resume_exp
    if missing_exp:
        issues.append(f"Missing experiences: {sorted(missing_exp)}")

    profile_proj = {
        str(p.get("name") or "").strip().lower()
        for p in (profile.get("projects") or [])
        if isinstance(p, dict) and str(p.get("name") or "").strip()
    }
    resume_proj = {
        str(p.get("name") or "").strip().lower()
        for p in (resume.get("projects") or [])
        if isinstance(p, dict) and str(p.get("name") or "").strip()
    }
    missing_proj = profile_proj - resume_proj
    if missing_proj:
        issues.append(f"Missing projects: {sorted(missing_proj)}")

    profile_edu = {
        str(e.get("institution") or "").strip().lower()
        for e in (profile.get("educations") or profile.get("education") or [])
        if isinstance(e, dict) and str(e.get("institution") or "").strip()
    }
    resume_edu = {
        str(e.get("institution") or "").strip().lower()
        for e in (resume.get("educations") or [])
        if isinstance(e, dict) and str(e.get("institution") or "").strip()
    }
    missing_edu = profile_edu - resume_edu
    if missing_edu:
        issues.append(f"Missing education entries: {sorted(missing_edu)}")

    profile_certs = {
        str(c.get("name") or "").strip().lower()
        for c in (profile.get("certifications") or [])
        if isinstance(c, dict) and str(c.get("name") or "").strip()
    }
    resume_certs = {
        str(c.get("name") or "").strip().lower()
        for c in (resume.get("certifications") or [])
        if isinstance(c, dict) and str(c.get("name") or "").strip()
    }
    missing_certs = profile_certs - resume_certs
    if missing_certs:
        issues.append(f"Missing certifications: {sorted(missing_certs)}")

    orig_counts = _count_profile_bullets(profile, split_fn=split_fn)
    tailored_counts = _count_profile_bullets(resume, split_fn=split_fn)
    for key, orig_n in orig_counts.items():
        tailored_n = tailored_counts.get(key, 0)
        if tailored_n < orig_n:
            issues.append(f"Bullet count dropped for {key}: {orig_n} → {tailored_n}")

    return ValidationResult(passed=not issues, issues=issues)


def validate_structure(resume: dict) -> ValidationResult:
    """Check headline, summary, skills, and experience dates."""
    issues: list[str] = []
    headline = str(resume.get("headline") or "").strip()
    if len(headline) < 8:
        issues.append("headline missing or too short")

    summary = str(resume.get("summary") or resume.get("professional_summary") or "").strip()
    if len(summary) < 120:
        issues.append("summary missing or shorter than 120 chars")

    skills = resume.get("skills") or {}
    if isinstance(skills, dict):
        skill_count = sum(
            len(skills.get(k) or [])
            for k in ("languages", "frameworks", "databases", "domain_relevant", "other_technologies")
        )
        if skill_count < 3:
            issues.append("skills section too sparse")
    elif isinstance(skills, list) and len(skills) < 3:
        issues.append("skills section too sparse")

    experiences = resume.get("past_experience") or []
    if not experiences:
        issues.append("no experience entries")
    else:
        for exp in experiences:
            if not isinstance(exp, dict):
                continue
            if not str(exp.get("start_date") or "").strip():
                issues.append(f"missing start_date for {exp.get('company_name') or exp.get('role')}")

    return ValidationResult(passed=not issues, issues=issues)


def _all_bullets(resume: dict) -> list[str]:
    """Flatten every experience/project bullet into a single ordered list of strings."""
    out: list[str] = []
    for exp in resume.get("past_experience") or []:
        if isinstance(exp, dict):
            out.extend(str(b).strip() for b in (exp.get("description") or []) if str(b).strip())
    for proj in resume.get("projects") or []:
        if isinstance(proj, dict):
            out.extend(str(b).strip() for b in (proj.get("description") or []) if str(b).strip())
    return out


def _leading_verb(bullet: str) -> str:
    # Strip markdown bold/leading domain-label prefix (e.g. "**Backend:** Built ...")
    text = re.sub(r"^\*\*[^*]+\*\*:?\s*", "", bullet.strip())
    match = re.match(r"[A-Za-z]+", text)
    return match.group(0).lower() if match else ""


def validate_formatting(resume: dict) -> ValidationResult:
    """Deterministic ATS/recruiter formatting checks (Stage 11: Formatting Review).

    No LLM call — checks duplicate skills, consecutive verb repetition, keyword
    stuffing, and overlong bullets. Complements validate_structure (which checks
    presence/sparsity) with quality-of-formatting checks.
    """
    issues: list[str] = []

    skills = resume.get("skills") or {}
    if isinstance(skills, dict):
        seen: dict[str, str] = {}
        for key in ("languages", "frameworks", "databases", "domain_relevant", "other_technologies"):
            for skill in skills.get(key) or []:
                norm = str(skill).strip().lower()
                if not norm:
                    continue
                if norm in seen and seen[norm] != key:
                    issues.append(f"Duplicate skill '{skill}' in both '{seen[norm]}' and '{key}'")
                elif norm in seen:
                    issues.append(f"Duplicate skill '{skill}' repeated in '{key}'")
                else:
                    seen[norm] = key

    bullets = _all_bullets(resume)
    run_verb, run_len = "", 0
    for bullet in bullets:
        verb = _leading_verb(bullet)
        if verb and verb == run_verb:
            run_len += 1
        else:
            run_verb, run_len = verb, 1
        if run_len > _MAX_CONSECUTIVE_REPEATED_VERB:
            issues.append(f"Verb '{verb}' repeated {run_len}x consecutively — rotate action verbs")

    for bullet in bullets:
        if len(bullet) > _BULLET_MAX_CHARS:
            issues.append(f"Bullet exceeds ~2 lines ({len(bullet)} chars): '{bullet[:60]}...'")

    if len(bullets) >= 4:
        token_counts: dict[str, int] = {}
        for bullet in bullets:
            tokens = {t for t in re.findall(r"[a-z][a-z0-9+#/-]{3,}", bullet.lower()) if t not in _STOPWORDS}
            for t in tokens:
                token_counts[t] = token_counts.get(t, 0) + 1
        stuffed = [t for t, c in token_counts.items() if c / len(bullets) > 0.6 and c >= 4]
        if stuffed:
            issues.append(f"Possible keyword stuffing — overrepresented terms: {sorted(stuffed)[:5]}")

    return ValidationResult(passed=not issues, issues=issues)


def recruiter_review_passed(
    review: RecruiterReviewResult, threshold: int = RECRUITER_SCORE_THRESHOLD
) -> tuple[bool, int]:
    """Deterministic gate on recruiter sub-scores — never trust a self-reported boolean."""
    scores = [
        review.readability,
        review.professionalism,
        review.trust,
        review.scanability,
        review.shortlist_likelihood,
    ]
    min_score = min(scores) if scores else 0
    return min_score >= threshold, min_score


def recruiter_critique_from(review: RecruiterReviewResult) -> str:
    """Build a targeted rewrite critique from a failed RecruiterReviewResult."""
    parts: list[str] = []
    if review.critique:
        parts.append(review.critique)
    if review.summary_feedback:
        parts.append(f"Summary feedback: {review.summary_feedback}")
    if review.flow_feedback:
        parts.append(f"Experience flow feedback: {review.flow_feedback}")
    if review.repetitive_notes:
        parts.append("Repetitive/robotic patterns to fix: " + "; ".join(review.repetitive_notes))
    if review.weak_bullets:
        parts.append("Weak bullets to strengthen (without inventing facts): " + "; ".join(review.weak_bullets))
    if review.bullets_to_move:
        parts.append("Bullets to reorder/relocate: " + "; ".join(review.bullets_to_move))
    return "\n".join(f"- {p}" for p in parts if p.strip())


def count_quantified_tokens(text: str) -> int:
    return len(_QUANT_RE.findall(text or ""))


def specificity_regression(profile: dict, resume: dict, *, split_fn) -> ValidationResult:
    """Fail if tailored resume has fewer quantified tokens than the profile per role."""
    issues: list[str] = []
    profile_exp = {
        (
            str(e.get("company_name") or e.get("company") or "").strip().lower(),
            str(e.get("role") or "").strip().lower(),
        ): split_fn(e.get("description"))
        for e in (profile.get("past_experience") or profile.get("experience") or [])
        if isinstance(e, dict)
    }
    for exp in resume.get("past_experience") or []:
        if not isinstance(exp, dict):
            continue
        key = (
            str(exp.get("company_name") or "").strip().lower(),
            str(exp.get("role") or "").strip().lower(),
        )
        orig_bullets = profile_exp.get(key, [])
        tailored_bullets = [str(b) for b in (exp.get("description") or [])]
        orig_q = sum(count_quantified_tokens(b) for b in orig_bullets)
        tailored_q = sum(count_quantified_tokens(b) for b in tailored_bullets)
        if tailored_q < orig_q:
            issues.append(
                f"Quantified metrics dropped for {key[0]}|{key[1]}: {orig_q} → {tailored_q}"
            )
    return ValidationResult(passed=not issues, issues=issues)


def estimate_target_page_count(profile_info: dict, original_page_count: int | None, *, split_fn) -> int:
    """Use stored upload page count, or estimate from profile content density."""
    if original_page_count is not None and original_page_count >= 1:
        return original_page_count

    bullet_count = 0
    for exp in profile_info.get("past_experience") or profile_info.get("experience") or []:
        if isinstance(exp, dict):
            bullet_count += len(split_fn(exp.get("description")))
    for proj in profile_info.get("projects") or []:
        if isinstance(proj, dict):
            bullet_count += len(split_fn(proj.get("description")))
    bullet_count += len(profile_info.get("achievements") or [])
    bullet_count += len(profile_info.get("educations") or profile_info.get("education") or [])
    bullet_count += len(profile_info.get("certifications") or [])

    role_count = len(profile_info.get("past_experience") or profile_info.get("experience") or [])
    project_count = len(profile_info.get("projects") or [])
    content_lines = bullet_count + role_count + project_count

    if content_lines <= 0:
        return 1
    return max(1, (content_lines + _LINES_PER_PAGE - 1) // _LINES_PER_PAGE)


def fit_aware_thresholds(fit_label: FitLabel | str) -> tuple[int, float, float]:
    """Return (ats_threshold, supported_pct_target, combined_pct_target)."""
    label = fit_label.value if isinstance(fit_label, FitLabel) else str(fit_label or "")
    if label == FitLabel.STRONG.value:
        return 85, 95.0, 95.0
    if label == FitLabel.STRETCH.value:
        return 78, 90.0, 85.0
    return 72, 0.0, 0.0  # MISMATCH: no forced keyword chase


def build_keyword_checklist(jd_analysis: Any, evidence_map: EvidenceMap | dict) -> str:
    """Format JD keywords annotated with evidence support for prompts."""
    if isinstance(evidence_map, dict):
        evidence_map = EvidenceMap.model_validate(evidence_map)
    support_by_req: dict[str, str] = {}
    for item in evidence_map.items or []:
        support = item.support if isinstance(item.support, EvidenceSupport) else EvidenceSupport(item.support)
        if item.requirement:
            support_by_req[item.requirement.strip()] = support.value

    lines: list[str] = []
    seen: set[str] = set()
    must_haves = getattr(jd_analysis, "must_haves", None) or (
        jd_analysis.get("must_haves") if isinstance(jd_analysis, dict) else []
    )
    keywords = getattr(jd_analysis, "keywords", None) or (
        jd_analysis.get("keywords") if isinstance(jd_analysis, dict) else []
    )
    for req in list(must_haves or []) + list(keywords or []):
        req = str(req).strip()
        if not req or req in seen:
            continue
        seen.add(req)
        support = support_by_req.get(req, "MISSING")
        lines.append(f"- [{support}] {req}")
    return "\n".join(lines) if lines else "(no JD keywords extracted)"


def page_target_block(target_page_count: int) -> str:
    n = max(1, int(target_page_count))
    return f"""## Content preservation & page target
- The candidate's original resume is **{n} page(s)**. Write enough substantive, tailored content to naturally fill approximately **{n} page(s)** when compiled — do NOT compress by dropping roles, projects, education, certifications, or achievements.
- **Never drop** a role, project, education entry, certification, or achievement present in `<candidate_profile>`.
- **Never shrink** bullet count per role/project below what the source had — only merge exact duplicate bullets.
- Apply strong action verbs and **bold** key tech/metrics that exist. Fix grammar. Never invent percentages.
- This is about preserving real content while tailoring — not padding with filler."""


def validation_critique_from(
    *,
    coverage: KeywordCoverageResult | None = None,
    content: ValidationResult | None = None,
    structure: ValidationResult | None = None,
    specificity: ValidationResult | None = None,
    formatting: ValidationResult | None = None,
    honesty_hits: list[str] | None = None,
    page_restore: tuple[int, int] | None = None,
) -> str:
    """Build a targeted critique block for refine/write retries."""
    parts: list[str] = []
    if coverage and coverage.missing_supported:
        parts.append(
            "Weave these SUPPORTED keywords into headline, summary, skills, and bullets: "
            + ", ".join(coverage.missing_supported[:15])
        )
    if coverage and coverage.missing_partial:
        parts.append(
            "Weave these PARTIAL keywords where honest: "
            + ", ".join(coverage.missing_partial[:10])
        )
    for vr in (content, structure, specificity, formatting):
        if vr and not vr.passed:
            parts.extend(vr.issues)
    if honesty_hits:
        parts.append("Remove or rephrase implied claims for: " + ", ".join(honesty_hits))
    if page_restore:
        actual, target = page_restore
        parts.append(
            f"Compiled PDF is {actual} page(s) but original was {target} — restore any dropped "
            "roles/projects/bullets from candidate_profile; do not shorten further."
        )
    return "\n".join(f"- {p}" for p in parts if p.strip())
