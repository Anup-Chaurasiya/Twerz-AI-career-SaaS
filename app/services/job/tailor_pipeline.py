"""Multi-pass resume tailoring: JD analysis → evidence map → write → score → refine."""

from __future__ import annotations

import json
import re
from logging import getLogger
from typing import Any

from app.config import get_settings
from app.schemas.custom_resume import CustomResumeInfo
from app.schemas.tailor import (
    ATSScoreResult,
    BulletQualityResult,
    CoverLetterResult,
    EvidenceMap,
    EvidenceSupport,
    FitLabel,
    FitVerdict,
    GapRoadmap,
    ImpliedClaimScan,
    InterviewPacket,
    JDAnalysis,
    RecruiterReviewResult,
    ResumePlan,
)
from app.services.ai.inference import LLMInference
from app.services.ai.prompts import (
    ATS_SCORE_SYSTEM_PROMPT,
    ATS_SCORE_USER_PROMPT,
    BULLET_QUALITY_SYSTEM_PROMPT,
    BULLET_QUALITY_USER_PROMPT,
    COVER_LETTER_REPAIR_PROMPT,
    COVER_LETTER_SYSTEM_PROMPT,
    COVER_LETTER_USER_PROMPT,
    CUSTOM_RESUME_REFINE_SYSTEM_PROMPT,
    CUSTOM_RESUME_REFINE_USER_PROMPT,
    CUSTOM_RESUME_WRITE_SYSTEM_PROMPT,
    CUSTOM_RESUME_WRITE_USER_PROMPT,
    EVIDENCE_MAP_SYSTEM_PROMPT,
    EVIDENCE_MAP_USER_PROMPT,
    GAP_FIX_SYSTEM_PROMPT,
    GAP_FIX_USER_PROMPT,
    GAP_ROADMAP_SYSTEM_PROMPT,
    GAP_ROADMAP_USER_PROMPT,
    IMPLIED_CLAIM_SCAN_SYSTEM_PROMPT,
    IMPLIED_CLAIM_SCAN_USER_PROMPT,
    INTERVIEW_PACKET_REPAIR_PROMPT,
    INTERVIEW_PACKET_SYSTEM_PROMPT,
    INTERVIEW_PACKET_USER_PROMPT,
    JD_ANALYSIS_SYSTEM_PROMPT,
    JD_ANALYSIS_USER_PROMPT,
    OUTREACH_MESSAGE_SYSTEM_PROMPT,
    OUTREACH_MESSAGE_USER_PROMPT,
    RECRUITER_REVIEW_SYSTEM_PROMPT,
    RECRUITER_REVIEW_USER_PROMPT,
    RESUME_PLAN_SYSTEM_PROMPT,
    RESUME_PLAN_USER_PROMPT,
    WRITE_MODE_STRETCH,
    WRITE_MODE_STRONG,
    WRITE_MODE_TRANSFERABLE,
)
from app.services.job.honesty import (
    filter_resume_honesty_hits,
    find_forbidden_in_obj,
    find_forbidden_in_text,
    forbidden_tool_tokens_from_evidence,
    missing_requirements_for_implied_scan,
    strip_forbidden_mentions,
    verify_evidence_quotes,
)
from app.services.job.validators import (
    MAX_RECRUITER_PASSES,
    build_keyword_checklist,
    compute_keyword_coverage,
    estimate_target_page_count,
    fit_aware_thresholds,
    page_target_block,
    recruiter_critique_from,
    recruiter_review_passed,
    specificity_regression,
    validate_content_preservation,
    validate_formatting,
    validate_structure,
    validation_critique_from,
)

logger = getLogger(__name__)

REFINE_SCORE_THRESHOLD = 72  # default; fit-aware thresholds override in run()
MAX_REFINE_PASSES = 3
# Structure is JD-independent so tailored resumes can improve ATS even on mismatch.
ATS_STRUCTURE_WEIGHT = 0.55
ATS_KEYWORD_WEIGHT = 0.45
SENIORITY_RANK = {
    "intern": 0,
    "junior": 1,
    "mid": 2,
    "senior": 3,
    "staff": 4,
    "lead": 4,
    "executive": 5,
    "unspecified": 2,
}


def clamp_score(raw: int | float | None) -> int | None:
    """Hard clamp scores to [0, 100] at the write-time source of truth."""
    if raw is None:
        return None
    return max(0, min(100, int(round(float(raw)))))


def write_mode_block(fit_label: FitLabel | str) -> str:
    """Fit-conditional write/refine instructions (STRONG / STRETCH / transferable-only)."""
    label = fit_label.value if isinstance(fit_label, FitLabel) else str(fit_label or "")
    if label == FitLabel.STRONG.value:
        return WRITE_MODE_STRONG.strip()
    if label == FitLabel.STRETCH.value:
        return WRITE_MODE_STRETCH.strip()
    return WRITE_MODE_TRANSFERABLE.strip()


LOW_FIT_LABELS = frozenset({FitLabel.STRETCH.value, FitLabel.MISMATCH.value})


def structural_ats_score(resume: dict) -> int:
    """Deterministic 0–100 structure/parseability score (independent of JD fit)."""
    points = 0.0

    headline = str(resume.get("headline") or "").strip()
    if len(headline) >= 8:
        points += 15
    elif headline:
        points += 8

    summary = str(resume.get("summary") or resume.get("professional_summary") or "").strip()
    if len(summary) >= 120:
        points += 20
    elif len(summary) >= 40:
        points += 12
    elif summary:
        points += 5

    skills = resume.get("skills")
    skill_count = 0
    if isinstance(skills, dict):
        for key, value in skills.items():
            if key in ("domain_label",):
                continue
            if isinstance(value, list):
                skill_count += sum(1 for item in value if str(item).strip())
            elif isinstance(value, str) and value.strip():
                skill_count += 1
    elif isinstance(skills, list):
        skill_count = sum(1 for item in skills if str(item).strip())
    if skill_count >= 8:
        points += 20
    elif skill_count >= 3:
        points += 12
    elif skill_count >= 1:
        points += 6

    experience = resume.get("past_experience") or resume.get("experience") or []
    projects = resume.get("projects") or []
    blob_parts: list[str] = []
    for item in list(experience) + list(projects):
        if not isinstance(item, dict):
            continue
        desc = item.get("description") or item.get("details") or ""
        if isinstance(desc, list):
            blob_parts.extend(str(x) for x in desc)
        elif desc:
            blob_parts.append(str(desc))
        for bullet in item.get("bullet_points") or item.get("bullets") or []:
            blob_parts.append(str(bullet))
    blob = "\n".join(blob_parts)
    if len(blob) >= 400:
        points += 15
    elif len(blob) >= 100:
        points += 10
    elif blob:
        points += 5

    if re.search(
        r"\d+\s*%|\d+\+|\$\d+|\d+\s*(?:users|requests|ms|seconds|hours|days|months|years|team|people)",
        blob,
        re.I,
    ):
        points += 20
    elif re.search(r"\d+", blob):
        points += 10

    # Education present (small bonus)
    education = resume.get("education") or resume.get("educations") or []
    if education:
        points += 10

    return clamp_score(points) or 0


def blend_ats_score(llm_score: int, structure_score: int) -> int:
    """Blend structure (JD-independent) with honest keyword LLM score."""
    blended = ATS_STRUCTURE_WEIGHT * structure_score + ATS_KEYWORD_WEIGHT * llm_score
    return clamp_score(blended) or 0


def _coerce_ats_score(raw: Any) -> tuple[ATSScoreResult, int | float | None]:
    """Validate LLM ATS score (0–100). Out-of-range fails validation so inference can retry.

    Returns (result, raw_score). Does not pre-clamp — schema enforces ge/le.
    """
    if hasattr(raw, "model_dump"):
        data = raw.model_dump(mode="json")
    else:
        data = dict(raw)
    raw_score = data.get("score")
    return ATSScoreResult.model_validate(data), raw_score


def compute_fit_verdict_and_raw(jd: JDAnalysis, evidence: EvidenceMap) -> tuple[FitVerdict, int]:
    """Deterministic fit score + pre-clamp raw for analytics."""
    items = evidence.items or []
    if not items and jd.must_haves:
        gaps = list(jd.must_haves)
        raw_score = 15
        return (
            FitVerdict(
                fit_score=clamp_score(raw_score) or 0,
                fit_label=FitLabel.MISMATCH,
                rationale="No evidence mapped against must-have requirements.",
                gap_list=gaps,
            ),
            raw_score,
        )

    if not items:
        raw_score = 50
        return (
            FitVerdict(
                fit_score=clamp_score(raw_score) or 0,
                fit_label=FitLabel.STRETCH,
                rationale="Limited structured requirements to score against.",
                gap_list=list(evidence.gaps or []),
            ),
            raw_score,
        )

    weights = {
        EvidenceSupport.SUPPORTED: 1.0,
        EvidenceSupport.PARTIAL: 0.55,
        EvidenceSupport.MISSING: 0.0,
    }
    total = 0.0
    for item in items:
        support = item.support if isinstance(item.support, EvidenceSupport) else EvidenceSupport(item.support)
        total += weights.get(support, 0.0)
    coverage = total / max(len(items), 1)
    score = int(round(coverage * 100))

    jd_rank = SENIORITY_RANK.get(jd.seniority, 2)
    cand_rank = SENIORITY_RANK.get(evidence.candidate_seniority_estimate, 2)
    if jd_rank - cand_rank >= 2:
        score = score - 18
    elif jd_rank - cand_rank == 1:
        score = score - 8

    raw_score = int(score)
    score = clamp_score(raw_score) or 0

    gaps = list(evidence.gaps or [])
    missing = [
        i.requirement
        for i in items
        if (i.support if isinstance(i.support, EvidenceSupport) else EvidenceSupport(i.support))
        == EvidenceSupport.MISSING
    ]
    for m in missing:
        if m not in gaps:
            gaps.append(m)

    if score >= 70 and jd_rank - cand_rank <= 1:
        label = FitLabel.STRONG
    elif score >= 40:
        label = FitLabel.STRETCH
    else:
        label = FitLabel.MISMATCH

    rationale = (
        f"Evidence coverage {coverage:.0%}; JD seniority={jd.seniority}, "
        f"candidate≈{evidence.candidate_seniority_estimate}."
    )
    return (
        FitVerdict(fit_score=score, fit_label=label, rationale=rationale, gap_list=gaps),
        raw_score,
    )


def compute_fit_verdict(jd: JDAnalysis, evidence: EvidenceMap) -> FitVerdict:
    """Deterministic fit score from evidence coverage + seniority gap."""
    verdict, _ = compute_fit_verdict_and_raw(jd, evidence)
    return verdict


# Same weights as compute_fit_verdict_and_raw — keep in sync.
_FIT_SUPPORT_WEIGHTS = {
    EvidenceSupport.SUPPORTED: 1.0,
    EvidenceSupport.PARTIAL: 0.55,
    EvidenceSupport.MISSING: 0.0,
}


def build_fit_score_breakdown(jd: JDAnalysis, evidence: EvidenceMap) -> dict:
    """Explain fit_score: per-req weights, coverage %, seniority penalty, clamped final.

    Uses the same formula as compute_fit_verdict_and_raw so UI math matches stored scores.
    """
    verdict, raw_score = compute_fit_verdict_and_raw(jd, evidence)
    items = evidence.items or []
    weight_rows: list[dict] = []
    total = 0.0
    for item in items:
        support = item.support if isinstance(item.support, EvidenceSupport) else EvidenceSupport(item.support)
        w = _FIT_SUPPORT_WEIGHTS.get(support, 0.0)
        total += w
        weight_rows.append(
            {
                "requirement": item.requirement,
                "support": support.value if isinstance(support, EvidenceSupport) else str(support),
                "weight": w,
            }
        )

    coverage = (total / max(len(items), 1)) if items else 0.0
    coverage_score = int(round(coverage * 100)) if items else int(raw_score)

    jd_rank = SENIORITY_RANK.get(jd.seniority, 2)
    cand_rank = SENIORITY_RANK.get(evidence.candidate_seniority_estimate, 2)
    seniority_gap = jd_rank - cand_rank if items else 0
    if items and seniority_gap >= 2:
        seniority_penalty = 18
    elif items and seniority_gap == 1:
        seniority_penalty = 8
    else:
        seniority_penalty = 0

    # Edge cases: no items — coverage_score equals the baseline raw (15 or 50)
    if not items:
        coverage_score = int(raw_score)
        seniority_penalty = 0
        seniority_gap = 0

    supported = sum(1 for r in weight_rows if r["support"] == EvidenceSupport.SUPPORTED.value)
    partial = sum(1 for r in weight_rows if r["support"] == EvidenceSupport.PARTIAL.value)
    missing = sum(1 for r in weight_rows if r["support"] == EvidenceSupport.MISSING.value)

    return {
        "coverage_pct": round(coverage * 100, 1) if items else float(coverage_score),
        "coverage_score": coverage_score,
        "seniority": {
            "jd": jd.seniority,
            "candidate": evidence.candidate_seniority_estimate,
            "gap": seniority_gap,
            "penalty": seniority_penalty,
        },
        "raw_score": int(raw_score),
        "final_score": verdict.fit_score,
        "fit_label": verdict.fit_label.value if hasattr(verdict.fit_label, "value") else str(verdict.fit_label),
        "formula": (
            f"round(coverage×100) − seniority_penalty = {coverage_score} − {seniority_penalty} "
            f"→ clamp({raw_score}) = {verdict.fit_score}"
            if items
            else f"edge-case baseline → clamp({raw_score}) = {verdict.fit_score}"
        ),
        "weights": {
            "SUPPORTED": _FIT_SUPPORT_WEIGHTS[EvidenceSupport.SUPPORTED],
            "PARTIAL": _FIT_SUPPORT_WEIGHTS[EvidenceSupport.PARTIAL],
            "MISSING": _FIT_SUPPORT_WEIGHTS[EvidenceSupport.MISSING],
        },
        "items": weight_rows,
        "counts": {"supported": supported, "partial": partial, "missing": missing},
    }


def evidence_counts_from_map(evidence_map: EvidenceMap | dict | None) -> dict | None:
    """Compact S/P/M counts for list/tracker — avoids shipping full evidence_map."""
    if not evidence_map:
        return None
    try:
        em = (
            evidence_map
            if isinstance(evidence_map, EvidenceMap)
            else EvidenceMap.model_validate(evidence_map)
        )
    except Exception:
        return None
    counts = {"supported": 0, "partial": 0, "missing": 0}
    for item in em.items or []:
        support = item.support if isinstance(item.support, EvidenceSupport) else EvidenceSupport(item.support)
        if support == EvidenceSupport.SUPPORTED:
            counts["supported"] += 1
        elif support == EvidenceSupport.PARTIAL:
            counts["partial"] += 1
        else:
            counts["missing"] += 1
    return counts


def fit_score_breakdown_from_stored(
    jd_analysis: dict | None, evidence_map: dict | None
) -> dict | None:
    """Compute breakdown on read from stored JD analysis + evidence map."""
    if not jd_analysis or not evidence_map:
        return None
    try:
        jd = JDAnalysis.model_validate(jd_analysis)
        evidence = EvidenceMap.model_validate(evidence_map)
    except Exception:
        return None
    return build_fit_score_breakdown(jd, evidence)


def _norm_key(*parts: str) -> str:
    return " | ".join(re.sub(r"\s+", " ", (p or "").strip().lower()) for p in parts if p)


def split_profile_bullets(description: Any) -> list[str]:
    """Split profile experience/project description into bullet-like lines."""
    if description is None:
        return []
    if isinstance(description, list):
        return [str(x).strip() for x in description if str(x).strip()]
    text = str(description).strip()
    if not text:
        return []
    # Prefer newline / bullet splits
    parts = re.split(r"[\n\r]+|(?<=[.;])\s+(?=[A-Z•\-])", text)
    bullets: list[str] = []
    for part in parts:
        cleaned = re.sub(r"^[\s•\-\*\u2022]+", "", part).strip()
        if cleaned:
            bullets.append(cleaned)
    if len(bullets) <= 1 and "•" in text:
        bullets = [re.sub(r"^[\s•]+", "", p).strip() for p in text.split("•") if p.strip()]
    return bullets or [text]


def normalize_profile_for_tailor(profile_info: dict) -> dict:
    """Normalize profile descriptions to bullet arrays for tailoring."""
    out = dict(profile_info)
    experiences: list[dict] = []
    for exp in profile_info.get("past_experience") or profile_info.get("experience") or []:
        if not isinstance(exp, dict):
            continue
        exp_copy = dict(exp)
        exp_copy["description"] = split_profile_bullets(exp.get("description"))
        experiences.append(exp_copy)
    out["past_experience"] = experiences

    projects: list[dict] = []
    for proj in profile_info.get("projects") or []:
        if not isinstance(proj, dict):
            continue
        proj_copy = dict(proj)
        proj_copy["description"] = split_profile_bullets(proj.get("description"))
        projects.append(proj_copy)
    out["projects"] = projects

    achievements: list[str] = []
    for ach in profile_info.get("achievements") or []:
        if isinstance(ach, dict):
            name = str(ach.get("name") or "").strip()
            desc = str(ach.get("description") or "").strip()
            text = f"{name}: {desc}".strip(": ").strip() if name or desc else ""
            if text:
                achievements.append(text)
        elif str(ach).strip():
            achievements.append(str(ach).strip())
    out["achievements"] = achievements
    return out


def _allowed_keywords(evidence: EvidenceMap | dict | None) -> list[str]:
    if evidence is None:
        return []
    if isinstance(evidence, dict):
        try:
            evidence = EvidenceMap.model_validate(evidence)
        except Exception:
            return []
    out: list[str] = []
    for item in evidence.items or []:
        support = item.support if isinstance(item.support, EvidenceSupport) else EvidenceSupport(item.support)
        if support in (EvidenceSupport.SUPPORTED, EvidenceSupport.PARTIAL) and item.requirement:
            out.append(item.requirement)
    return out


def _keyword_for_bullet(bullet: str, keywords: list[str]) -> str | None:
    lower = bullet.lower()
    for kw in keywords:
        if kw and kw.lower() in lower:
            return kw
    return None


def build_bullet_diff(
    profile_info: dict,
    tailored: dict,
    evidence_map: EvidenceMap | dict | None = None,
) -> dict[str, Any]:
    """Pair original vs tailored bullets for the mandatory before/after UI."""
    keywords = _allowed_keywords(evidence_map)

    profile_exp = {
        _norm_key(str(e.get("company_name") or e.get("company") or ""), str(e.get("role") or "")): e
        for e in (profile_info.get("past_experience") or profile_info.get("experience") or [])
        if isinstance(e, dict)
    }
    experiences: list[dict[str, Any]] = []
    for exp in tailored.get("past_experience") or []:
        if not isinstance(exp, dict):
            continue
        company = str(exp.get("company_name") or "")
        role = str(exp.get("role") or "")
        key = _norm_key(company, role)
        orig = profile_exp.get(key) or {}
        orig_bullets = split_profile_bullets(orig.get("description"))
        tailored_bullets = [str(b).strip() for b in (exp.get("description") or []) if str(b).strip()]
        n = min(len(orig_bullets), len(tailored_bullets))
        pairs = []
        for i in range(n):
            pairs.append(
                {
                    "original": orig_bullets[i],
                    "tailored": tailored_bullets[i],
                    "keyword": _keyword_for_bullet(tailored_bullets[i], keywords),
                }
            )
        # Show leftover tailored bullets without original
        for i in range(n, len(tailored_bullets)):
            pairs.append(
                {
                    "original": "",
                    "tailored": tailored_bullets[i],
                    "keyword": _keyword_for_bullet(tailored_bullets[i], keywords),
                }
            )
        if pairs:
            experiences.append({"company": company, "role": role, "pairs": pairs})

    profile_proj = {
        _norm_key(str(p.get("name") or "")): p
        for p in (profile_info.get("projects") or [])
        if isinstance(p, dict)
    }
    projects: list[dict[str, Any]] = []
    for proj in tailored.get("projects") or []:
        if not isinstance(proj, dict):
            continue
        name = str(proj.get("name") or "")
        key = _norm_key(name)
        orig = profile_proj.get(key) or {}
        orig_bullets = split_profile_bullets(orig.get("description"))
        tailored_bullets = [str(b).strip() for b in (proj.get("description") or []) if str(b).strip()]
        n = min(len(orig_bullets), len(tailored_bullets))
        pairs = []
        for i in range(n):
            pairs.append(
                {
                    "original": orig_bullets[i],
                    "tailored": tailored_bullets[i],
                    "keyword": _keyword_for_bullet(tailored_bullets[i], keywords),
                }
            )
        for i in range(n, len(tailored_bullets)):
            pairs.append(
                {
                    "original": "",
                    "tailored": tailored_bullets[i],
                    "keyword": _keyword_for_bullet(tailored_bullets[i], keywords),
                }
            )
        if pairs:
            projects.append({"name": name, "pairs": pairs})

    return {"experiences": experiences, "projects": projects}


def _quality_critique_block(critique: str | None) -> str:
    if not critique or not critique.strip():
        return ""
    return (
        "<quality_critique>\n"
        f"{critique.strip()}\n"
        "</quality_critique>\n"
        "Fix the issues above (specificity, structure, readability, or formatting as noted). "
        "Preserve every fact/metric/scope already present — never invent, never drop content.\n"
    )


def _dumps(obj: Any) -> str:
    if hasattr(obj, "model_dump"):
        return json.dumps(obj.model_dump(mode="json"), default=str)
    return json.dumps(obj, default=str)


def _inject_pii(resume: dict, profile_info: dict) -> dict:
    resume["name"] = profile_info.get("name", resume.get("name", ""))
    resume["email"] = profile_info.get("email", resume.get("email", ""))
    resume["mobile_number"] = profile_info.get("mobile_number") or profile_info.get("phone")
    resume["date_of_birth"] = profile_info.get("date_of_birth")
    return resume


def _append_version(versions: list | None, resume: dict, label: str) -> list:
    versions = list(versions or [])
    versions.append(
        {
            "version": len(versions) + 1,
            "label": label,
            "data": resume,
        }
    )
    return versions


class TailorPipeline:
    """Runs the multi-pass tailor flow and optional add-ons (cover letter, gaps, interview)."""

    def __init__(self) -> None:
        settings = get_settings()
        self.flash_model = settings.LLM_FLASH_MODEL
        self.pro_model = settings.LLM_PRO_MODEL

    async def run(
        self,
        *,
        profile_info: dict,
        job_description: dict,
        user_id: str | None = None,
        reference_id: str | None = None,
        original_page_count: int | None = None,
    ) -> dict[str, Any]:
        """Full Phase-1 pipeline. Returns dict of fields to persist on Job."""
        normalized_profile = normalize_profile_for_tailor(profile_info)
        target_page_count = estimate_target_page_count(
            normalized_profile,
            original_page_count,
            split_fn=split_profile_bullets,
        )
        page_block = page_target_block(target_page_count)

        jd_analysis = await self.analyze_jd(job_description, user_id=user_id, reference_id=reference_id)
        evidence_map = await self.map_evidence(
            normalized_profile, jd_analysis, user_id=user_id, reference_id=reference_id
        )
        fit, raw_fit = compute_fit_verdict_and_raw(jd_analysis, evidence_map)
        keyword_checklist = build_keyword_checklist(jd_analysis, evidence_map)
        ats_threshold, supported_target, combined_target = fit_aware_thresholds(fit.fit_label)

        # Stage 5: Resume Planner — structured strategy BEFORE any prose is written.
        resume_plan = await self.plan_resume(
            normalized_profile, jd_analysis, evidence_map, fit, user_id=user_id, reference_id=reference_id
        )

        ats_before, meta_before = await self.score_resume(
            normalized_profile,
            job_description,
            jd_analysis,
            evidence_map,
            user_id=user_id,
            reference_id=reference_id,
            purpose="ats_score_before",
        )

        resume = await self.write_resume(
            normalized_profile,
            job_description,
            jd_analysis,
            evidence_map,
            fit,
            user_id=user_id,
            reference_id=reference_id,
            resume_plan=resume_plan,
            page_target_block=page_block,
            keyword_checklist=keyword_checklist,
        )
        resume = await self._repair_resume_honesty(
            resume,
            normalized_profile,
            job_description,
            jd_analysis,
            evidence_map,
            fit,
            user_id=user_id,
            reference_id=reference_id,
            page_target_block=page_block,
            keyword_checklist=keyword_checklist,
        )

        quality = await self.guardrail_specificity(
            normalized_profile, resume, evidence_map, user_id=user_id, reference_id=reference_id
        )
        if not quality.passed:
            resume = await self.write_resume(
                normalized_profile,
                job_description,
                jd_analysis,
                evidence_map,
                fit,
                user_id=user_id,
                reference_id=reference_id,
                resume_plan=resume_plan,
                quality_critique=quality.critique or _dumps(quality),
                page_target_block=page_block,
                keyword_checklist=keyword_checklist,
            )
            resume = await self._repair_resume_honesty(
                resume,
                normalized_profile,
                job_description,
                jd_analysis,
                evidence_map,
                fit,
                user_id=user_id,
                reference_id=reference_id,
                page_target_block=page_block,
                keyword_checklist=keyword_checklist,
            )

        # Stage 7: Recruiter Review — senior-recruiter critique of the draft, with a
        # bounded targeted rewrite loop when any sub-score is below threshold.
        # Runs BEFORE ATS scoring (draft → recruiter critique → rewrite → ATS critique).
        recruiter_result = await self.review_as_recruiter(
            resume, job_description, user_id=user_id, reference_id=reference_id
        )
        recruiter_passed, recruiter_min_score = recruiter_review_passed(recruiter_result)
        recruiter_passes = 0
        while not recruiter_passed and recruiter_passes < MAX_RECRUITER_PASSES:
            recruiter_passes += 1
            critique = recruiter_critique_from(recruiter_result)
            dummy_ats = ATSScoreResult(
                score=0,
                critique="(recruiter review pass — see quality critique)",
                matched_keywords=[],
                missing_keywords=[],
            )
            resume = await self.refine_resume(
                resume,
                job_description,
                evidence_map,
                dummy_ats,
                fit.fit_label,
                user_id=user_id,
                reference_id=reference_id,
                quality_critique=critique,
                page_target_block=page_block,
                keyword_checklist=keyword_checklist,
            )
            resume = await self._repair_resume_honesty(
                resume,
                normalized_profile,
                job_description,
                jd_analysis,
                evidence_map,
                fit,
                user_id=user_id,
                reference_id=reference_id,
                page_target_block=page_block,
                keyword_checklist=keyword_checklist,
            )
            recruiter_result = await self.review_as_recruiter(
                resume,
                job_description,
                user_id=user_id,
                reference_id=reference_id,
                purpose=f"recruiter_review_pass_{recruiter_passes}",
            )
            recruiter_passed, recruiter_min_score = recruiter_review_passed(recruiter_result)
        if not recruiter_passed:
            logger.warning(
                "recruiter_review_cap_hit reference_id=%s passes=%s min_score=%s",
                reference_id,
                recruiter_passes,
                recruiter_min_score,
            )

        ats_after, meta_after = await self.score_resume(
            resume,
            job_description,
            jd_analysis,
            evidence_map,
            user_id=user_id,
            reference_id=reference_id,
            purpose="ats_score_after",
        )

        refine_passes = 0
        while refine_passes < MAX_REFINE_PASSES:
            coverage = compute_keyword_coverage(resume, evidence_map)
            content_v = validate_content_preservation(
                normalized_profile, resume, split_fn=split_profile_bullets
            )
            structure_v = validate_structure(resume)
            formatting_v = validate_formatting(resume)
            needs_refine = ats_after.score < ats_threshold
            if fit.fit_label == FitLabel.STRONG and coverage.supported_pct < supported_target:
                needs_refine = True
            elif fit.fit_label == FitLabel.STRETCH and coverage.combined_pct < combined_target:
                needs_refine = True
            if not content_v.passed or not structure_v.passed or not formatting_v.passed:
                needs_refine = True
            if not needs_refine:
                break

            refine_passes += 1
            critique = validation_critique_from(
                coverage=coverage,
                content=content_v,
                structure=structure_v,
                formatting=formatting_v,
            )
            resume = await self.refine_resume(
                resume,
                job_description,
                evidence_map,
                ats_after,
                fit.fit_label,
                user_id=user_id,
                reference_id=reference_id,
                quality_critique=critique,
                page_target_block=page_block,
                keyword_checklist=keyword_checklist,
            )
            resume = await self._repair_resume_honesty(
                resume,
                normalized_profile,
                job_description,
                jd_analysis,
                evidence_map,
                fit,
                user_id=user_id,
                reference_id=reference_id,
                page_target_block=page_block,
                keyword_checklist=keyword_checklist,
            )
            quality = await self.guardrail_specificity(
                normalized_profile, resume, evidence_map, user_id=user_id, reference_id=reference_id
            )
            if not quality.passed:
                resume = await self.refine_resume(
                    resume,
                    job_description,
                    evidence_map,
                    ats_after,
                    fit.fit_label,
                    user_id=user_id,
                    reference_id=reference_id,
                    quality_critique=quality.critique or _dumps(quality),
                    page_target_block=page_block,
                    keyword_checklist=keyword_checklist,
                )
            ats_after, meta_after = await self.score_resume(
                resume,
                job_description,
                jd_analysis,
                evidence_map,
                user_id=user_id,
                reference_id=reference_id,
                purpose=f"ats_score_after_refine_{refine_passes}",
            )

        if refine_passes >= MAX_REFINE_PASSES:
            coverage = compute_keyword_coverage(resume, evidence_map)
            if ats_after.score < ats_threshold or (
                fit.fit_label == FitLabel.STRONG and coverage.supported_pct < supported_target
            ):
                logger.warning(
                    "refine_cap_hit reference_id=%s passes=%s ats_score=%s threshold=%s "
                    "supported_pct=%s",
                    reference_id,
                    refine_passes,
                    ats_after.score,
                    ats_threshold,
                    coverage.supported_pct,
                )

        resume = _inject_pii(resume, profile_info)
        versions = _append_version([], resume, "initial")
        bullet_diff = build_bullet_diff(profile_info, resume, evidence_map)
        gap_roadmap = await self.build_gap_roadmap(
            jd_analysis, evidence_map, fit, user_id=user_id, reference_id=reference_id
        )
        final_coverage = compute_keyword_coverage(resume, evidence_map)

        return {
            "custom_resume_data": resume,
            "target_page_count": target_page_count,
            "jd_analysis": jd_analysis.model_dump(mode="json"),
            "evidence_map": evidence_map.model_dump(mode="json"),
            "resume_plan": resume_plan.model_dump(mode="json"),
            "recruiter_review": {
                "review": recruiter_result.model_dump(mode="json"),
                "passed": recruiter_passed,
                "min_score": recruiter_min_score,
                "passes_used": recruiter_passes,
            },
            "fit_score": clamp_score(fit.fit_score),
            "fit_label": fit.fit_label.value,
            "fit_rationale": fit.rationale,
            "gap_list": fit.gap_list,
            "gap_roadmap": gap_roadmap.model_dump(mode="json") if gap_roadmap else None,
            "ats_score_before": clamp_score(ats_before.score),
            "ats_score_after": clamp_score(ats_after.score),
            "ats_score_detail": {
                "before": ats_before.model_dump(mode="json"),
                "after": ats_after.model_dump(mode="json"),
                "keyword_coverage": {
                    "supported_pct": round(final_coverage.supported_pct, 1),
                    "combined_pct": round(final_coverage.combined_pct, 1),
                    "missing_supported": final_coverage.missing_supported[:20],
                },
                "raw": {
                    "fit_score": raw_fit,
                    "ats_score_before": meta_before.get("llm_raw"),
                    "ats_score_after": meta_after.get("llm_raw"),
                },
                "structure": {
                    "before": meta_before.get("structure"),
                    "after": meta_after.get("structure"),
                },
                "llm_clamped": {
                    "before": meta_before.get("llm_clamped"),
                    "after": meta_after.get("llm_clamped"),
                },
            },
            "bullet_diff": bullet_diff,
            "resume_versions": versions,
        }

    async def analyze_fit_only(
        self,
        *,
        profile_info: dict,
        job_description: dict,
        user_id: str | None = None,
        reference_id: str | None = None,
    ) -> dict[str, Any]:
        """Free pre-generate fit analysis (JD + evidence + fit verdict + roadmap)."""
        jd_analysis = await self.analyze_jd(job_description, user_id=user_id, reference_id=reference_id)
        evidence_map = await self.map_evidence(
            profile_info, jd_analysis, user_id=user_id, reference_id=reference_id
        )
        fit = compute_fit_verdict(jd_analysis, evidence_map)
        gap_roadmap = await self.build_gap_roadmap(
            jd_analysis, evidence_map, fit, user_id=user_id, reference_id=reference_id
        )
        return {
            "jd_analysis": jd_analysis.model_dump(mode="json"),
            "evidence_map": evidence_map.model_dump(mode="json"),
            "fit_score": clamp_score(fit.fit_score),
            "fit_label": fit.fit_label.value,
            "fit_rationale": fit.rationale,
            "gap_list": fit.gap_list,
            "gap_roadmap": gap_roadmap.model_dump(mode="json") if gap_roadmap else None,
        }

    async def analyze_jd(
        self, job_description: dict, *, user_id: str | None, reference_id: str | None
    ) -> JDAnalysis:
        llm = LLMInference(model_name=self.flash_model)
        raw = await llm.run_inference(
            system_prompt=JD_ANALYSIS_SYSTEM_PROMPT,
            inputs=[JD_ANALYSIS_USER_PROMPT.format(job_description=_dumps(job_description))],
            structured_output_schema=JDAnalysis,
            user_id=user_id,
            purpose="jd_analysis",
            reference_id=reference_id,
        )
        return JDAnalysis.model_validate(raw)

    async def map_evidence(
        self,
        profile_info: dict,
        jd_analysis: JDAnalysis,
        *,
        user_id: str | None,
        reference_id: str | None,
    ) -> EvidenceMap:
        llm = LLMInference(model_name=self.flash_model)
        raw = await llm.run_inference(
            system_prompt=EVIDENCE_MAP_SYSTEM_PROMPT,
            inputs=[
                EVIDENCE_MAP_USER_PROMPT.format(
                    jd_analysis=_dumps(jd_analysis),
                    user_info=_dumps(profile_info),
                )
            ],
            structured_output_schema=EvidenceMap,
            user_id=user_id,
            purpose="evidence_map",
            reference_id=reference_id,
        )
        evidence = EvidenceMap.model_validate(raw)
        evidence, unverified = verify_evidence_quotes(evidence, profile_info)
        if unverified:
            logger.warning(
                "evidence_quote_unverified count=%s reference_id=%s",
                unverified,
                reference_id,
            )
        return evidence

    async def plan_resume(
        self,
        profile_info: dict,
        jd_analysis: JDAnalysis,
        evidence_map: EvidenceMap,
        fit: FitVerdict,
        *,
        user_id: str | None,
        reference_id: str | None,
    ) -> ResumePlan:
        """Stage 5: Resume Planner — structured writing strategy BEFORE any prose is written."""
        llm = LLMInference(model_name=self.flash_model)
        raw = await llm.run_inference(
            system_prompt=RESUME_PLAN_SYSTEM_PROMPT,
            inputs=[
                RESUME_PLAN_USER_PROMPT.format(
                    jd_analysis=_dumps(jd_analysis),
                    evidence_map=_dumps(evidence_map),
                    fit_verdict=_dumps(fit),
                    user_info=_dumps(profile_info),
                )
            ],
            structured_output_schema=ResumePlan,
            user_id=user_id,
            purpose="resume_plan",
            reference_id=reference_id,
        )
        return ResumePlan.model_validate(raw)

    async def write_resume(
        self,
        profile_info: dict,
        job_description: dict,
        jd_analysis: JDAnalysis,
        evidence_map: EvidenceMap,
        fit: FitVerdict,
        *,
        user_id: str | None,
        reference_id: str | None,
        resume_plan: ResumePlan | dict | None = None,
        quality_critique: str | None = None,
        page_target_block: str = "",
        keyword_checklist: str = "",
    ) -> dict:
        llm = LLMInference(model_name=self.pro_model)
        raw = await llm.run_inference(
            system_prompt=CUSTOM_RESUME_WRITE_SYSTEM_PROMPT.format(
                write_mode_block=write_mode_block(fit.fit_label),
                page_target_block=page_target_block,
            ),
            inputs=[
                CUSTOM_RESUME_WRITE_USER_PROMPT.format(
                    job_description=_dumps(job_description),
                    jd_analysis=_dumps(jd_analysis),
                    evidence_map=_dumps(evidence_map),
                    fit_verdict=_dumps(fit),
                    user_info=_dumps(profile_info),
                    quality_critique_block=_quality_critique_block(quality_critique),
                    keyword_checklist=keyword_checklist,
                    resume_plan=_dumps(resume_plan) if resume_plan is not None else "(no plan provided)",
                )
            ],
            structured_output_schema=CustomResumeInfo,
            user_id=user_id,
            purpose="resume_tailoring",
            reference_id=reference_id,
        )
        return dict(raw)

    async def review_as_recruiter(
        self,
        resume: dict,
        job_description: dict,
        *,
        user_id: str | None,
        reference_id: str | None,
        purpose: str = "recruiter_review",
    ) -> RecruiterReviewResult:
        """Stage 7: Recruiter Review — senior-recruiter critique of a resume draft.

        Pass/fail is computed deterministically from sub-scores by the caller
        (validators.recruiter_review_passed) rather than trusted from the LLM.
        """
        llm = LLMInference(model_name=self.flash_model)
        raw = await llm.run_inference(
            system_prompt=RECRUITER_REVIEW_SYSTEM_PROMPT,
            inputs=[
                RECRUITER_REVIEW_USER_PROMPT.format(
                    job_description=_dumps(job_description),
                    tailored_resume=_dumps(resume),
                )
            ],
            structured_output_schema=RecruiterReviewResult,
            user_id=user_id,
            purpose=purpose,
            reference_id=reference_id,
        )
        return RecruiterReviewResult.model_validate(raw)

    async def build_gap_roadmap(
        self,
        jd_analysis: JDAnalysis,
        evidence_map: EvidenceMap,
        fit: FitVerdict,
        *,
        user_id: str | None,
        reference_id: str | None,
    ) -> GapRoadmap | None:
        """Flash gap-closing roadmap for Stretch/Mismatch; skip on STRONG."""
        if fit.fit_label == FitLabel.STRONG:
            return None
        llm = LLMInference(model_name=self.flash_model)
        raw = await llm.run_inference(
            system_prompt=GAP_ROADMAP_SYSTEM_PROMPT,
            inputs=[
                GAP_ROADMAP_USER_PROMPT.format(
                    jd_analysis=_dumps(jd_analysis),
                    evidence_map=_dumps(evidence_map),
                    fit_verdict=_dumps(fit),
                    gap_list=_dumps(fit.gap_list),
                )
            ],
            structured_output_schema=GapRoadmap,
            user_id=user_id,
            purpose="gap_roadmap",
            reference_id=reference_id,
        )
        roadmap = GapRoadmap.model_validate(raw)
        # Keep 3–5 steps
        if len(roadmap.steps) > 5:
            roadmap = roadmap.model_copy(update={"steps": roadmap.steps[:5]})
        return roadmap

    async def guardrail_specificity(
        self,
        profile_info: dict,
        tailored: dict,
        evidence_map: EvidenceMap,
        *,
        user_id: str | None,
        reference_id: str | None,
    ) -> BulletQualityResult:
        """Flash pass: reject tailored bullets that lost specificity vs original."""
        regression = specificity_regression(profile_info, tailored, split_fn=split_profile_bullets)
        if not regression.passed:
            return BulletQualityResult(
                passed=False,
                critique="; ".join(regression.issues),
            )
        llm = LLMInference(model_name=self.flash_model)
        raw = await llm.run_inference(
            system_prompt=BULLET_QUALITY_SYSTEM_PROMPT,
            inputs=[
                BULLET_QUALITY_USER_PROMPT.format(
                    evidence_map=_dumps(evidence_map),
                    user_info=_dumps(profile_info),
                    tailored_resume=_dumps(tailored),
                )
            ],
            structured_output_schema=BulletQualityResult,
            user_id=user_id,
            purpose="bullet_quality_guardrail",
            reference_id=reference_id,
        )
        return BulletQualityResult.model_validate(raw)

    async def score_resume(
        self,
        resume_or_profile: dict,
        job_description: dict,
        jd_analysis: JDAnalysis,
        evidence_map: EvidenceMap,
        *,
        user_id: str | None,
        reference_id: str | None,
        purpose: str,
    ) -> tuple[ATSScoreResult, dict[str, Any]]:
        """Score resume; returns (blended result, scoring meta for analytics)."""
        llm = LLMInference(model_name=self.flash_model)
        raw = await llm.run_inference(
            system_prompt=ATS_SCORE_SYSTEM_PROMPT,
            inputs=[
                ATS_SCORE_USER_PROMPT.format(
                    job_description=_dumps(job_description),
                    jd_analysis=_dumps(jd_analysis),
                    evidence_map=_dumps(evidence_map),
                    tailored_resume=_dumps(resume_or_profile),
                )
            ],
            structured_output_schema=ATSScoreResult,
            user_id=user_id,
            purpose=purpose,
            reference_id=reference_id,
        )
        result, llm_raw = _coerce_ats_score(raw)
        structure = structural_ats_score(resume_or_profile if isinstance(resume_or_profile, dict) else {})
        llm_clamped = result.score
        blended = blend_ats_score(llm_clamped, structure)
        result = result.model_copy(update={"score": blended})
        meta = {
            "llm_raw": llm_raw,
            "llm_clamped": llm_clamped,
            "structure": structure,
            "blended": blended,
        }
        return result, meta

    async def refine_resume(
        self,
        resume: dict,
        job_description: dict,
        evidence_map: EvidenceMap,
        ats: ATSScoreResult,
        fit_label: FitLabel | str,
        *,
        user_id: str | None,
        reference_id: str | None,
        quality_critique: str | None = None,
        page_target_block: str = "",
        keyword_checklist: str = "",
    ) -> dict:
        llm = LLMInference(model_name=self.pro_model)
        raw = await llm.run_inference(
            system_prompt=CUSTOM_RESUME_REFINE_SYSTEM_PROMPT.format(
                write_mode_block=write_mode_block(fit_label),
                page_target_block=page_target_block,
            ),
            inputs=[
                CUSTOM_RESUME_REFINE_USER_PROMPT.format(
                    evidence_map=_dumps(evidence_map),
                    ats_critique=_dumps(ats),
                    tailored_resume=_dumps(resume),
                    job_description=_dumps(job_description),
                    quality_critique_block=_quality_critique_block(quality_critique),
                    keyword_checklist=keyword_checklist,
                )
            ],
            structured_output_schema=CustomResumeInfo,
            user_id=user_id,
            purpose="resume_refine",
            reference_id=reference_id,
        )
        return dict(raw)

    async def _repair_resume_honesty(
        self,
        resume: dict,
        profile_info: dict,
        job_description: dict,
        jd_analysis: JDAnalysis,
        evidence_map: EvidenceMap,
        fit: FitVerdict,
        *,
        user_id: str | None,
        reference_id: str | None,
        page_target_block: str,
        keyword_checklist: str,
    ) -> dict:
        """One repair refine if resume implies MISSING tools."""
        hits = await self._honesty_hits(
            resume,
            evidence_map,
            user_id=user_id,
            reference_id=reference_id,
            purpose="resume_implied_scan",
            resume_mode=True,
        )
        if not hits:
            return resume
        logger.warning("Resume honesty hit: %s — repair refine once", hits)
        critique = validation_critique_from(honesty_hits=hits)
        dummy_ats = ATSScoreResult(score=0, critique=critique, matched_keywords=[], missing_keywords=[])
        repaired = await self.refine_resume(
            resume,
            job_description,
            evidence_map,
            dummy_ats,
            fit.fit_label,
            user_id=user_id,
            reference_id=reference_id,
            quality_critique=critique,
            page_target_block=page_target_block,
            keyword_checklist=keyword_checklist,
        )
        hits2 = await self._honesty_hits(
            repaired,
            evidence_map,
            user_id=user_id,
            reference_id=reference_id,
            purpose="resume_implied_scan_repair",
            resume_mode=True,
        )
        if hits2:
            logger.warning(
                "Resume still has honesty hits after repair: %s — keeping repaired resume "
                "(no JSON redaction; generic/JD boilerplate hits ignored)",
                hits2,
            )
        return repaired

    async def restore_resume_for_page_count(
        self,
        *,
        resume: dict,
        profile_info: dict,
        job_description: dict,
        jd_analysis: JDAnalysis | dict,
        evidence_map: EvidenceMap | dict,
        fit_label: FitLabel | str,
        target_page_count: int,
        actual_page_count: int,
        user_id: str | None = None,
        reference_id: str | None = None,
    ) -> dict:
        """One content-restore refine when compiled PDF is shorter than the original upload."""
        if isinstance(evidence_map, dict):
            evidence_map = EvidenceMap.model_validate(evidence_map)
        if isinstance(jd_analysis, dict):
            jd_analysis = JDAnalysis.model_validate(jd_analysis)
        page_block = page_target_block(target_page_count)
        keyword_checklist = build_keyword_checklist(jd_analysis, evidence_map)
        critique = validation_critique_from(page_restore=(actual_page_count, target_page_count))
        dummy_ats = ATSScoreResult(score=0, critique=critique, matched_keywords=[], missing_keywords=[])
        restored = await self.refine_resume(
            resume,
            job_description,
            evidence_map,
            dummy_ats,
            fit_label,
            user_id=user_id,
            reference_id=reference_id,
            quality_critique=critique,
            page_target_block=page_block,
            keyword_checklist=keyword_checklist,
        )
        return _inject_pii(restored, profile_info)

    async def fix_keyword_gaps(
        self,
        *,
        resume: dict,
        job_description: dict,
        evidence_map: dict | EvidenceMap,
        keywords: list[str],
        profile_info: dict,
        user_id: str | None = None,
        reference_id: str | None = None,
    ) -> dict:
        if isinstance(evidence_map, dict):
            evidence_map = EvidenceMap.model_validate(evidence_map)
        # Only allow SUPPORTED/PARTIAL keywords
        allowed = set()
        for item in evidence_map.items:
            support = item.support if isinstance(item.support, EvidenceSupport) else EvidenceSupport(item.support)
            if support in (EvidenceSupport.SUPPORTED, EvidenceSupport.PARTIAL):
                allowed.add(item.requirement.lower())
        filtered = [k for k in keywords if k.lower() in allowed or any(k.lower() in a for a in allowed)]
        if not filtered:
            filtered = keywords[:5]

        llm = LLMInference(model_name=self.pro_model)
        raw = await llm.run_inference(
            system_prompt=GAP_FIX_SYSTEM_PROMPT,
            inputs=[
                GAP_FIX_USER_PROMPT.format(
                    keywords=_dumps(filtered),
                    evidence_map=_dumps(evidence_map),
                    tailored_resume=_dumps(resume),
                    job_description=_dumps(job_description),
                )
            ],
            structured_output_schema=CustomResumeInfo,
            user_id=user_id,
            purpose="keyword_gap_fix",
            reference_id=reference_id,
        )
        return _inject_pii(dict(raw), profile_info)

    async def scan_implied_claims(
        self,
        draft_text: str,
        evidence_map: EvidenceMap,
        *,
        user_id: str | None,
        reference_id: str | None,
        purpose: str = "implied_claim_scan",
    ) -> list[str]:
        """Flash semantic scan for paraphrased MISSING-tool claims. Returns requirement strings."""
        missing = missing_requirements_for_implied_scan(evidence_map)
        if not missing or not (draft_text or "").strip():
            return []
        llm = LLMInference(model_name=self.flash_model)
        raw = await llm.run_inference(
            system_prompt=IMPLIED_CLAIM_SCAN_SYSTEM_PROMPT,
            inputs=[
                IMPLIED_CLAIM_SCAN_USER_PROMPT.format(
                    missing_requirements=_dumps(missing),
                    draft_text=draft_text,
                )
            ],
            structured_output_schema=ImpliedClaimScan,
            user_id=user_id,
            purpose=purpose,
            reference_id=reference_id,
        )
        scan = ImpliedClaimScan.model_validate(raw)
        return [v.requirement.strip() for v in scan.violations if v.requirement and v.requirement.strip()]

    def _honesty_scan_payload(self, text_or_obj: str | dict) -> str | dict:
        """Payload for honesty scans — interview packet gaps are study topics, not claims."""
        if isinstance(text_or_obj, str):
            return text_or_obj
        return {k: v for k, v in text_or_obj.items() if k != "gaps_to_prepare"}

    async def _honesty_hits(
        self,
        text_or_obj: str | dict,
        evidence_map: EvidenceMap,
        *,
        user_id: str | None,
        reference_id: str | None,
        purpose: str,
        resume_mode: bool = False,
    ) -> list[str]:
        """Union of substring forbidden hits and semantic implied-claim hits."""
        del resume_mode  # same filtering for resume and side content
        scan_payload = self._honesty_scan_payload(text_or_obj)
        forbidden = forbidden_tool_tokens_from_evidence(evidence_map)
        if isinstance(scan_payload, str):
            hits = find_forbidden_in_text(scan_payload, forbidden)
            draft = scan_payload
        else:
            hits = find_forbidden_in_obj(scan_payload, forbidden)
            draft = _dumps(scan_payload)
        implied = await self.scan_implied_claims(
            draft,
            evidence_map,
            user_id=user_id,
            reference_id=reference_id,
            purpose=purpose,
        )
        # Preserve order, de-dupe case-insensitively
        seen: set[str] = set()
        merged: list[str] = []
        for h in list(hits) + list(implied):
            key = h.lower()
            if key not in seen:
                seen.add(key)
                merged.append(h)
        return filter_resume_honesty_hits(merged, evidence_map)

    async def generate_cover_letter(
        self,
        *,
        profile_info: dict,
        job_description: dict,
        evidence_map: dict | EvidenceMap,
        user_id: str | None = None,
        reference_id: str | None = None,
    ) -> str:
        if isinstance(evidence_map, dict):
            evidence_map = EvidenceMap.model_validate(evidence_map)
        llm = LLMInference(model_name=self.pro_model)
        raw = await llm.run_inference(
            system_prompt=COVER_LETTER_SYSTEM_PROMPT,
            inputs=[
                COVER_LETTER_USER_PROMPT.format(
                    job_description=_dumps(job_description),
                    evidence_map=_dumps(evidence_map),
                    user_info=_dumps(profile_info),
                )
            ],
            structured_output_schema=CoverLetterResult,
            user_id=user_id,
            purpose="cover_letter",
            reference_id=reference_id,
        )
        letter = CoverLetterResult.model_validate(raw).cover_letter
        hits = await self._honesty_hits(
            letter,
            evidence_map,
            user_id=user_id,
            reference_id=reference_id,
            purpose="cover_letter_implied_scan",
        )
        if hits:
            logger.warning("Cover letter honesty hit: %s — re-prompting once", hits)
            raw2 = await llm.run_inference(
                system_prompt=COVER_LETTER_SYSTEM_PROMPT,
                inputs=[
                    COVER_LETTER_USER_PROMPT.format(
                        job_description=_dumps(job_description),
                        evidence_map=_dumps(evidence_map),
                        user_info=_dumps(profile_info),
                    ),
                    COVER_LETTER_REPAIR_PROMPT.format(violations=", ".join(hits)),
                ],
                structured_output_schema=CoverLetterResult,
                user_id=user_id,
                purpose="cover_letter_repair",
                reference_id=reference_id,
            )
            letter = CoverLetterResult.model_validate(raw2).cover_letter
            hits2 = await self._honesty_hits(
                letter,
                evidence_map,
                user_id=user_id,
                reference_id=reference_id,
                purpose="cover_letter_implied_scan_repair",
            )
            if hits2:
                logger.warning("Cover letter still dirty after repair: %s — redacting", hits2)
                letter = strip_forbidden_mentions(letter, hits2)
        return letter

    async def generate_interview_packet(
        self,
        *,
        profile_info: dict,
        job_description: dict,
        evidence_map: dict | EvidenceMap,
        user_id: str | None = None,
        reference_id: str | None = None,
    ) -> dict:
        if isinstance(evidence_map, dict):
            evidence_map = EvidenceMap.model_validate(evidence_map)
        llm = LLMInference(model_name=self.flash_model)
        raw = await llm.run_inference(
            system_prompt=INTERVIEW_PACKET_SYSTEM_PROMPT,
            inputs=[
                INTERVIEW_PACKET_USER_PROMPT.format(
                    job_description=_dumps(job_description),
                    evidence_map=_dumps(evidence_map),
                    user_info=_dumps(profile_info),
                )
            ],
            structured_output_schema=InterviewPacket,
            user_id=user_id,
            purpose="interview_packet",
            reference_id=reference_id,
        )
        packet = InterviewPacket.model_validate(raw).model_dump(mode="json")
        hits = await self._honesty_hits(
            packet,
            evidence_map,
            user_id=user_id,
            reference_id=reference_id,
            purpose="interview_packet_implied_scan",
        )
        if hits:
            logger.warning("Interview packet honesty hit: %s — re-prompting once", hits)
            raw2 = await llm.run_inference(
                system_prompt=INTERVIEW_PACKET_SYSTEM_PROMPT,
                inputs=[
                    INTERVIEW_PACKET_USER_PROMPT.format(
                        job_description=_dumps(job_description),
                        evidence_map=_dumps(evidence_map),
                        user_info=_dumps(profile_info),
                    ),
                    INTERVIEW_PACKET_REPAIR_PROMPT.format(violations=", ".join(hits)),
                ],
                structured_output_schema=InterviewPacket,
                user_id=user_id,
                purpose="interview_packet_repair",
                reference_id=reference_id,
            )
            packet = InterviewPacket.model_validate(raw2).model_dump(mode="json")
            hits2 = await self._honesty_hits(
                packet,
                evidence_map,
                user_id=user_id,
                reference_id=reference_id,
                purpose="interview_packet_implied_scan_repair",
            )
            if hits2:
                logger.warning("Interview packet still dirty after repair: %s — redacting strings", hits2)
                packet = _redact_packet(packet, hits2)
        return packet

    async def generate_outreach_message(
        self,
        *,
        profile_info: dict,
        job_description: dict,
        evidence_map: dict,
        contact_info: dict | None = None,
        outreach_type: str = "known_contact",
        user_id: str = "",
        reference_id: str = "",
    ) -> str:
        """Generate honest warm outreach message (known contact, cold LinkedIn, or referral template)."""
        jd_str = json.dumps(job_description, ensure_ascii=False)
        ev_str = json.dumps(evidence_map, ensure_ascii=False)
        prof_str = json.dumps(profile_info, ensure_ascii=False)
        contact_str = json.dumps(contact_info or {}, ensure_ascii=False)

        user_prompt = OUTREACH_MESSAGE_USER_PROMPT.format(
            job_description=jd_str,
            evidence_map=ev_str,
            user_info=prof_str,
            contact_info=contact_str,
            outreach_type=outreach_type,
        )

        llm = LLMInference(model_name=self.pro_model)
        raw = await llm.run_inference(
            system_prompt=OUTREACH_MESSAGE_SYSTEM_PROMPT,
            inputs=[user_prompt],
            user_id=user_id or None,
            purpose="generate_outreach_message",
            reference_id=reference_id,
        )
        msg_text = (raw if isinstance(raw, str) else str(raw or "")).strip()

        forbidden = forbidden_tool_tokens_from_evidence(evidence_map)
        if forbidden:
            hits = filter_resume_honesty_hits(
                find_forbidden_in_text(msg_text, forbidden),
                evidence_map,
            )
            if hits:
                msg_text = strip_forbidden_mentions(msg_text, hits)

        return msg_text


def _redact_packet(packet: dict, hits: list[str]) -> dict:
    """Redact forbidden terms from string fields in an interview packet."""
    out = dict(packet)
    for key in ("elevator_pitch",):
        if isinstance(out.get(key), str):
            out[key] = strip_forbidden_mentions(out[key], hits)
    for key in ("likely_questions", "star_stories", "gaps_to_prepare"):
        vals = out.get(key) or []
        out[key] = [
            strip_forbidden_mentions(v, hits) if isinstance(v, str) else v for v in vals
        ]
    return out
