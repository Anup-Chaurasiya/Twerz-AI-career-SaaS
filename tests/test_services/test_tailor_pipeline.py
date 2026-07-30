"""
Golden fixtures + deterministic fit/eval helpers for the tailor pipeline.

These tests do NOT call live LLMs. They validate:
- fit verdict logic (IAM mismatch vs strong match)
- score clamping to [0, 100]
- refine still runs on MISMATCH when ATS is below threshold
- CustomResumeInfo schema requirements (headline/summary)
- LaTeX builder renders headline + summary
- eval helper asserts no invented forbidden tools
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.custom_resume import CustomResumeInfo
from app.schemas.tailor import (
    ATSScoreResult,
    BulletQualityResult,
    EvidenceItem,
    EvidenceMap,
    EvidenceSupport,
    FitLabel,
    FitVerdict,
    GapRoadmap,
    GapRoadmapStep,
    JDAnalysis,
    RecruiterReviewResult,
    ResumePlan,
)
from app.services.job.tailor_pipeline import (
    REFINE_SCORE_THRESHOLD,
    MAX_REFINE_PASSES,
    max_refine_passes,
    TailorPipeline,
    _coerce_ats_score,
    blend_ats_score,
    build_bullet_diff,
    clamp_score,
    compute_fit_verdict,
    compute_fit_verdict_and_raw,
    split_profile_bullets,
    structural_ats_score,
    write_mode_block,
)
from app.services.latex.builder import build_resume
from app.services.latex.docx_builder import build_docx_bytes
from app.services.latex.sanitizer import sanitize_special_chars

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


FORBIDDEN_IAM_TOOLS = {"okta", "sailpoint", "ping identity", "azure ad", "saml", "oidc", "cyberark"}

VALID_SUMMARY = (
    "Built production SaaS APIs and web apps with measurable impact across several products "
    "and teams. Delivered features on schedule with strong measurable results."
)


def _pipeline_resume(**overrides) -> dict:
    base = {
        "name": "Test",
        "email": "t@example.com",
        "headline": "Full Stack Engineer",
        "summary": VALID_SUMMARY,
        "past_experience": [
            {
                "company_name": "Acme",
                "role": "Engineer",
                "start_date": "2020",
                "end_date": "Present",
                "description": ["Built REST APIs with Python reducing latency 40%"],
            }
        ],
        "projects": [],
        "skills": {
            "languages": ["Python"],
            "frameworks": ["React"],
            "databases": ["PostgreSQL"],
        },
        "educations": [{"degree": "BS", "institution": "Uni", "start_date": "2016", "end_date": "2020"}],
    }
    base.update(overrides)
    return base


def _passing_recruiter_review(**overrides) -> RecruiterReviewResult:
    base = dict(
        would_shortlist=True,
        ten_second_clarity=True,
        readability=9,
        professionalism=9,
        trust=9,
        scanability=9,
        shortlist_likelihood=9,
        critique="",
    )
    base.update(overrides)
    return RecruiterReviewResult(**base)


def _mock_pipeline_extras(pipeline):
    """Mock honesty repair + new Stage 5/7 (planner, recruiter review) to avoid LLM calls in unit tests."""
    pipeline._repair_resume_honesty = AsyncMock(side_effect=lambda resume, *a, **k: resume)
    pipeline.plan_resume = AsyncMock(return_value=ResumePlan())
    pipeline.review_as_recruiter = AsyncMock(return_value=_passing_recruiter_review())


def assert_no_forbidden_tools(resume: dict, forbidden: set[str]) -> None:
    blob = json.dumps(resume).lower()
    for tool in forbidden:
        assert tool not in blob, f"Invented/forbidden tool present: {tool}"


def assert_tailored_quality(resume: dict) -> None:
    info = CustomResumeInfo.model_validate(resume)
    assert info.headline and len(info.headline.strip()) > 5
    assert info.summary and len(info.summary.strip()) > 40
    assert info.past_experience or info.projects


def test_clamp_score_bounds():
    assert clamp_score(None) is None
    assert clamp_score(0) == 0
    assert clamp_score(100) == 100
    assert clamp_score(-100) == 0
    assert clamp_score(150) == 100
    assert clamp_score(72.6) == 73
    assert clamp_score(-0.4) == 0


def test_structural_ats_score_rewards_tailored_fields():
    bare_profile = {
        "name": "A",
        "email": "a@x.com",
        "past_experience": [{"description": "Built APIs"}],
        "skills": ["Python", "React"],
    }
    tailored = {
        "name": "A",
        "email": "a@x.com",
        "headline": "Full Stack Engineer",
        "summary": "Built production SaaS APIs and web apps with measurable impact across several products and teams.",
        "past_experience": [
            {
                "description": "Reduced recruiter effort by 60% by automating resume workflows across a team of 5."
            }
        ],
        "skills": {
            "languages": ["Python", "TypeScript"],
            "frameworks": ["React", "FastAPI"],
            "databases": ["PostgreSQL"],
            "security": ["OAuth", "JWT"],
            "other_technologies": ["Docker"],
        },
        "education": [{"institution": "Uni"}],
    }
    before = structural_ats_score(bare_profile)
    after = structural_ats_score(tailored)
    assert 0 <= before <= 100
    assert 0 <= after <= 100
    assert after > before


def test_blend_ats_score_moves_when_structure_improves():
    # Same LLM keyword score, better structure → higher blended ATS
    low = blend_ats_score(45, 35)
    high = blend_ats_score(45, 85)
    assert high > low
    assert 0 <= low <= 100
    assert 0 <= high <= 100


def test_coerce_ats_score_validates_range():
    """Out-of-range LLM scores fail validation (inference retries); in-range pass through."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        _coerce_ats_score(
            {
                "score": -100,
                "matched_keywords": [],
                "missing_keywords": ["Okta"],
                "strengths": [],
                "weaknesses": ["low"],
                "critique": "needs structure",
            }
        )

    with pytest.raises(ValidationError):
        _coerce_ats_score({"score": 140, "critique": "ok"})

    result, raw = _coerce_ats_score(
        {
            "score": 72,
            "matched_keywords": ["Python"],
            "missing_keywords": [],
            "strengths": ["clear"],
            "weaknesses": [],
            "critique": "ok",
        }
    )
    assert raw == 72
    assert result.score == 72


def test_fit_verdict_seniority_penalty_raw_can_go_negative_then_clamped():
    """Heavy seniority gap + mostly missing → raw may be negative; stored score is clamped."""
    jd = JDAnalysis(
        role_title="Staff IAM Engineer",
        role_family="IAM/Security",
        seniority="staff",
        must_haves=["Okta", "SAML", "OIDC", "PKI"],
        keywords=["Okta"],
        responsibilities=["Own IAM"],
        summary="Staff IAM",
    )
    evidence = EvidenceMap(
        items=[
            EvidenceItem(requirement="Okta", support=EvidenceSupport.MISSING),
            EvidenceItem(requirement="SAML", support=EvidenceSupport.MISSING),
            EvidenceItem(requirement="OIDC", support=EvidenceSupport.MISSING),
            EvidenceItem(requirement="PKI", support=EvidenceSupport.MISSING),
        ],
        candidate_seniority_estimate="intern",
        gaps=["Okta", "SAML", "OIDC", "PKI"],
    )
    fit, raw = compute_fit_verdict_and_raw(jd, evidence)
    assert raw <= 0  # coverage 0 minus seniority penalty
    assert 0 <= fit.fit_score <= 100
    assert fit.fit_label == FitLabel.MISMATCH


def test_fit_verdict_iam_mismatch():
    jd = JDAnalysis(
        role_title="Senior Identity and Access Management Engineer",
        company="DigiMoksha",
        role_family="IAM/Security",
        seniority="senior",
        must_haves=["Okta", "SAML", "OIDC", "Azure AD", "IAM architecture"],
        nice_to_haves=["SailPoint"],
        keywords=["Okta", "SAML", "OIDC", "Azure AD", "RBAC"],
        responsibilities=["Design IAM systems"],
        summary="Senior IAM engineer for enterprise identity.",
    )
    evidence = EvidenceMap(
        items=[
            EvidenceItem(requirement="Okta", support=EvidenceSupport.MISSING),
            EvidenceItem(requirement="SAML", support=EvidenceSupport.MISSING),
            EvidenceItem(requirement="OIDC", support=EvidenceSupport.MISSING),
            EvidenceItem(requirement="Azure AD", support=EvidenceSupport.MISSING),
            EvidenceItem(
                requirement="IAM architecture",
                support=EvidenceSupport.PARTIAL,
                evidence_quote="Built OAuth/JWT auth for SaaS APIs",
                transferable_angle="Authn/authz platform experience",
            ),
        ],
        candidate_seniority_estimate="junior",
        transferable_themes=["OAuth", "JWT", "API authorization"],
        gaps=["Okta", "SAML", "OIDC", "Azure AD"],
    )
    fit = compute_fit_verdict(jd, evidence)
    assert fit.fit_label == FitLabel.MISMATCH
    assert fit.fit_score < 40
    assert 0 <= fit.fit_score <= 100
    assert any("Okta" in g or "okta" in g.lower() for g in fit.gap_list)


def test_fit_verdict_strong_fullstack_match():
    jd = JDAnalysis(
        role_title="Full Stack Engineer",
        company="Acme",
        role_family="Full-Stack",
        seniority="junior",
        must_haves=["React", "Node.js", "PostgreSQL", "REST APIs"],
        nice_to_haves=["GraphQL"],
        keywords=["React", "Node.js", "PostgreSQL", "GraphQL", "Docker"],
        responsibilities=["Build product features"],
        summary="Junior/mid full-stack product engineer.",
    )
    evidence = EvidenceMap(
        items=[
            EvidenceItem(requirement="React", support=EvidenceSupport.SUPPORTED, evidence_quote="React"),
            EvidenceItem(requirement="Node.js", support=EvidenceSupport.SUPPORTED, evidence_quote="Node"),
            EvidenceItem(requirement="PostgreSQL", support=EvidenceSupport.SUPPORTED, evidence_quote="Postgres"),
            EvidenceItem(requirement="REST APIs", support=EvidenceSupport.SUPPORTED, evidence_quote="REST"),
            EvidenceItem(requirement="GraphQL", support=EvidenceSupport.SUPPORTED, evidence_quote="GraphQL"),
        ],
        candidate_seniority_estimate="junior",
        transferable_themes=["Full-stack", "AI SaaS"],
        gaps=[],
    )
    fit = compute_fit_verdict(jd, evidence)
    assert fit.fit_label == FitLabel.STRONG
    assert fit.fit_score >= 70
    assert fit.fit_score <= 100


@pytest.mark.asyncio
async def test_pipeline_refines_on_mismatch_when_ats_low():
    """MISMATCH must NOT skip refine when ATS after < threshold."""
    pipeline = TailorPipeline.__new__(TailorPipeline)
    pipeline.flash_model = "test-flash"
    pipeline.pro_model = "test-pro"

    jd = JDAnalysis(
        role_title="Senior IAM Engineer",
        role_family="IAM/Security",
        seniority="senior",
        must_haves=["Okta"],
        keywords=["Okta"],
        responsibilities=["IAM"],
        summary="IAM",
    )
    evidence = EvidenceMap(
        items=[EvidenceItem(requirement="Okta", support=EvidenceSupport.MISSING)],
        candidate_seniority_estimate="junior",
        gaps=["Okta"],
    )
    fit = FitVerdict(
        fit_score=0,
        fit_label=FitLabel.MISMATCH,
        rationale="mismatch",
        gap_list=["Okta"],
    )
    assert fit.fit_label == FitLabel.MISMATCH

    low_ats = ATSScoreResult(score=25, critique="weak structure")
    refined_ats = ATSScoreResult(score=80, critique="better structure")
    resume = _pipeline_resume(past_experience=[], projects=[], educations=[])

    pipeline.analyze_jd = AsyncMock(return_value=jd)
    pipeline.map_evidence = AsyncMock(return_value=evidence)

    import app.services.job.tailor_pipeline as tp

    original = tp.compute_fit_verdict_and_raw
    tp.compute_fit_verdict_and_raw = MagicMock(return_value=(fit, -12))

    score_calls: list[str] = []

    async def fake_score(*_a, purpose: str = "", **_k):
        score_calls.append(purpose)
        meta_low = {"llm_raw": 25, "llm_clamped": 25, "structure": 40, "blended": 25}
        meta_hi = {"llm_raw": 80, "llm_clamped": 80, "structure": 70, "blended": 80}
        if purpose == "ats_score_before":
            return low_ats, meta_low
        if purpose == "ats_score_after":
            return low_ats, meta_low
        if purpose.startswith("ats_score_after_refine"):
            return refined_ats, meta_hi
        return low_ats, meta_low

    pipeline.score_resume = AsyncMock(side_effect=fake_score)
    pipeline.write_resume = AsyncMock(return_value=dict(resume))
    pipeline.refine_resume = AsyncMock(return_value=dict(resume))
    pipeline.guardrail_specificity = AsyncMock(
        return_value=BulletQualityResult(passed=True, issues=[], critique="")
    )
    pipeline.build_gap_roadmap = AsyncMock(
        return_value=GapRoadmap(
            summary="Learn IAM fundamentals",
            steps=[
                GapRoadmapStep(title="Okta basics", detail="Complete Okta admin trail", category="skill"),
                GapRoadmapStep(title="SAML lab", detail="Build a SAML SP demo", category="project"),
                GapRoadmapStep(title="Security+ or IAM cert", detail="Study identity protocols", category="cert"),
            ],
        )
    )
    _mock_pipeline_extras(pipeline)

    try:
        result = await pipeline.run(
            profile_info={"name": "Test", "email": "t@example.com"},
            job_description={"text": "Senior IAM"},
        )
    finally:
        tp.compute_fit_verdict_and_raw = original

    assert pipeline.refine_resume.await_count >= 1
    assert any(c.startswith("ats_score_after_refine") for c in score_calls)
    assert result["fit_score"] == 0
    assert result["fit_label"] == "MISMATCH"
    assert result["gap_roadmap"] is not None
    assert len(result["gap_roadmap"]["steps"]) == 3
    assert result["ats_score_before"] == 25
    assert result["ats_score_after"] == 80
    assert result["ats_score_detail"]["raw"]["fit_score"] == -12
    assert result["ats_score_detail"]["raw"]["ats_score_before"] == 25
    assert result["ats_score_detail"]["raw"]["ats_score_after"] == 80
    assert result["ats_score_detail"]["structure"]["after"] == 70
    assert "bullet_diff" in result
    assert 0 <= result["fit_score"] <= 100
    assert 0 <= result["ats_score_after"] <= 100
    assert low_ats.score < REFINE_SCORE_THRESHOLD


@pytest.mark.asyncio
async def test_pipeline_refine_cap_hits_max_passes(caplog):
    """When ATS stays below threshold, refine at most MAX_REFINE_PASSES and log."""
    pipeline = TailorPipeline.__new__(TailorPipeline)
    pipeline.flash_model = "test-flash"
    pipeline.pro_model = "test-pro"

    jd = JDAnalysis(
        role_title="Role",
        role_family="Eng",
        seniority="mid",
        must_haves=["Python"],
        keywords=["Python"],
        responsibilities=["Build"],
        summary="eng",
    )
    evidence = EvidenceMap(
        items=[EvidenceItem(requirement="Python", support=EvidenceSupport.PARTIAL)],
        gaps=[],
    )
    fit = FitVerdict(fit_score=55, fit_label=FitLabel.STRETCH, rationale="stretch", gap_list=[])
    low_ats = ATSScoreResult(score=30, critique="low")
    resume = _pipeline_resume()

    pipeline.analyze_jd = AsyncMock(return_value=jd)
    pipeline.map_evidence = AsyncMock(return_value=evidence)
    import app.services.job.tailor_pipeline as tp

    original = tp.compute_fit_verdict_and_raw
    tp.compute_fit_verdict_and_raw = MagicMock(return_value=(fit, 55))

    async def fake_score(*_a, purpose: str = "", **_k):
        meta = {"llm_raw": 30, "llm_clamped": 30, "structure": 40, "blended": 30}
        return low_ats, meta

    pipeline.score_resume = AsyncMock(side_effect=fake_score)
    pipeline.write_resume = AsyncMock(return_value=dict(resume))
    pipeline.refine_resume = AsyncMock(return_value=dict(resume))
    pipeline.guardrail_specificity = AsyncMock(
        return_value=BulletQualityResult(passed=True, issues=[], critique="")
    )
    pipeline.build_gap_roadmap = AsyncMock(return_value=None)
    _mock_pipeline_extras(pipeline)

    try:
        with caplog.at_level("WARNING"):
            result = await pipeline.run(
                profile_info={"name": "T", "email": "t@x.com"},
                job_description={"text": "Python"},
                reference_id="job-cap",
            )
    finally:
        tp.compute_fit_verdict_and_raw = original

    assert pipeline.refine_resume.await_count == max_refine_passes()
    assert result["ats_score_after"] == 30
    assert any("refine_cap_hit" in r.message for r in caplog.records)

def test_split_profile_bullets():
    assert split_profile_bullets("Built APIs\n• Cut latency 40%\n- Shipped GraphQL") == [
        "Built APIs",
        "Cut latency 40%",
        "Shipped GraphQL",
    ]
    assert split_profile_bullets(["A", "B"]) == ["A", "B"]


def test_build_bullet_diff_pairs_and_keywords():
    profile = {
        "past_experience": [
            {
                "company_name": "Acme",
                "role": "Engineer",
                "description": "Built REST APIs\nReduced latency by 40% using Redis",
            }
        ],
        "projects": [
            {"name": "Resume SaaS", "description": "Integrated OAuth login\nAdded GraphQL"}
        ],
    }
    tailored = {
        "past_experience": [
            {
                "company_name": "Acme",
                "role": "Engineer",
                "description": [
                    "Built REST APIs for product features",
                    "Reduced latency by 40% using Redis caching",
                ],
            }
        ],
        "projects": [
            {
                "name": "Resume SaaS",
                "description": ["Integrated OAuth login for SSO-ready auth", "Added GraphQL resolvers"],
            }
        ],
    }
    evidence = EvidenceMap(
        items=[
            EvidenceItem(requirement="OAuth", support=EvidenceSupport.SUPPORTED),
            EvidenceItem(requirement="GraphQL", support=EvidenceSupport.PARTIAL),
            EvidenceItem(requirement="Okta", support=EvidenceSupport.MISSING),
        ]
    )
    diff = build_bullet_diff(profile, tailored, evidence)
    assert len(diff["experiences"]) == 1
    assert len(diff["experiences"][0]["pairs"]) == 2
    assert "40%" in diff["experiences"][0]["pairs"][1]["original"]
    assert "40%" in diff["experiences"][0]["pairs"][1]["tailored"]
    assert diff["projects"][0]["pairs"][0]["keyword"] == "OAuth"
    assert diff["projects"][0]["pairs"][1]["keyword"] == "GraphQL"


@pytest.mark.asyncio
async def test_guardrail_fail_triggers_one_rewrite():
    pipeline = TailorPipeline.__new__(TailorPipeline)
    pipeline.flash_model = "test-flash"
    pipeline.pro_model = "test-pro"

    jd = JDAnalysis(
        role_title="Full Stack Engineer",
        role_family="Full-Stack",
        seniority="junior",
        must_haves=["React"],
        keywords=["React"],
        responsibilities=["Build"],
        summary="FS",
    )
    evidence = EvidenceMap(
        items=[EvidenceItem(requirement="React", support=EvidenceSupport.SUPPORTED)],
        candidate_seniority_estimate="junior",
        gaps=[],
    )
    fit = FitVerdict(fit_score=80, fit_label=FitLabel.STRONG, rationale="strong", gap_list=[])
    high_ats = ATSScoreResult(score=80, critique="good")
    resume_v1 = _pipeline_resume(
        past_experience=[{"company_name": "Acme", "role": "Eng", "start_date": "2020", "description": ["Did stuff"]}],
    )
    resume_v2 = {
        **resume_v1,
        "past_experience": [
            {
                "company_name": "Acme",
                "role": "Eng",
                "start_date": "2020",
                "description": ["Shipped React features reducing load time 30%"],
            }
        ],
    }

    pipeline.analyze_jd = AsyncMock(return_value=jd)
    pipeline.map_evidence = AsyncMock(return_value=evidence)
    import app.services.job.tailor_pipeline as tp

    original = tp.compute_fit_verdict_and_raw
    tp.compute_fit_verdict_and_raw = MagicMock(return_value=(fit, 80))

    write_calls: list[str | None] = []

    async def fake_write(*_a, quality_critique=None, **_k):
        write_calls.append(quality_critique)
        return dict(resume_v2 if quality_critique else resume_v1)

    pipeline.write_resume = AsyncMock(side_effect=fake_write)
    pipeline.score_resume = AsyncMock(
        return_value=(high_ats, {"llm_raw": 80, "llm_clamped": 80, "structure": 90, "blended": 80})
    )
    pipeline.refine_resume = AsyncMock(return_value=dict(resume_v2))
    pipeline.guardrail_specificity = AsyncMock(
        side_effect=[
            BulletQualityResult(passed=False, critique="Restore the 30% metric"),
            BulletQualityResult(passed=True, critique=""),
            BulletQualityResult(passed=True, critique=""),
            BulletQualityResult(passed=True, critique=""),
            BulletQualityResult(passed=True, critique=""),
        ]
    )
    _mock_pipeline_extras(pipeline)

    try:
        result = await pipeline.run(
            profile_info={
                "name": "T",
                "email": "t@x.com",
                "past_experience": [
                    {
                        "company_name": "Acme",
                        "role": "Eng",
                        "start_date": "2020",
                        "description": "Shipped React features reducing load time 30%",
                    }
                ],
            },
            job_description={"text": "FS"},
        )
    finally:
        tp.compute_fit_verdict_and_raw = original

    assert len(write_calls) == 2
    assert write_calls[0] is None
    assert write_calls[1] and "30%" in write_calls[1]
    # STRONG fit uses ATS threshold 85; score 80 triggers refine passes
    assert pipeline.refine_resume.await_count >= 1
    assert result["bullet_diff"]["experiences"][0]["pairs"][0]["keyword"] == "React"
    assert "30%" in result["bullet_diff"]["experiences"][0]["pairs"][0]["tailored"]
    assert result["gap_roadmap"] is None  # STRONG skips roadmap


@pytest.mark.asyncio
async def test_recruiter_review_fail_triggers_one_rewrite():
    """A low recruiter sub-score must trigger exactly one targeted refine_resume rewrite,
    with a passing re-review afterward stopping the loop (bounded by MAX_RECRUITER_PASSES)."""
    pipeline = TailorPipeline.__new__(TailorPipeline)
    pipeline.flash_model = "test-flash"
    pipeline.pro_model = "test-pro"

    jd = JDAnalysis(
        role_title="Full Stack Engineer",
        role_family="Full-Stack",
        seniority="junior",
        must_haves=["React"],
        keywords=["React"],
        responsibilities=["Build"],
        summary="FS",
    )
    evidence = EvidenceMap(
        items=[EvidenceItem(requirement="React", support=EvidenceSupport.SUPPORTED)],
        candidate_seniority_estimate="junior",
        gaps=[],
    )
    fit = FitVerdict(fit_score=80, fit_label=FitLabel.STRONG, rationale="strong", gap_list=[])
    high_ats = ATSScoreResult(score=90, critique="good")
    resume = _pipeline_resume()

    pipeline.analyze_jd = AsyncMock(return_value=jd)
    pipeline.map_evidence = AsyncMock(return_value=evidence)
    pipeline.plan_resume = AsyncMock(return_value=ResumePlan())
    import app.services.job.tailor_pipeline as tp

    original = tp.compute_fit_verdict_and_raw
    tp.compute_fit_verdict_and_raw = MagicMock(return_value=(fit, 80))

    pipeline.write_resume = AsyncMock(return_value=dict(resume))
    pipeline.refine_resume = AsyncMock(return_value=dict(resume))
    pipeline.score_resume = AsyncMock(
        return_value=(high_ats, {"llm_raw": 90, "llm_clamped": 90, "structure": 90, "blended": 90})
    )
    pipeline.guardrail_specificity = AsyncMock(
        return_value=BulletQualityResult(passed=True, issues=[], critique="")
    )
    pipeline._repair_resume_honesty = AsyncMock(side_effect=lambda resume, *a, **k: resume)
    pipeline.build_gap_roadmap = AsyncMock(return_value=None)

    failing_review = _passing_recruiter_review(readability=5, critique="Tighten the summary, cut repetition.")
    passing_review = _passing_recruiter_review()
    pipeline.review_as_recruiter = AsyncMock(side_effect=[failing_review, passing_review])

    try:
        result = await pipeline.run(
            profile_info={"name": "T", "email": "t@x.com"},
            job_description={"text": "FS"},
        )
    finally:
        tp.compute_fit_verdict_and_raw = original

    assert result["recruiter_review"]["passed"] is True
    assert result["recruiter_review"]["passes_used"] == 1
    assert pipeline.review_as_recruiter.await_count == 2
    # One recruiter-triggered rewrite via refine_resume (before the ATS-threshold refine loop,
    # which shouldn't trigger here since ATS is 90 and STRONG threshold is 85 with full coverage).
    assert pipeline.refine_resume.await_count == 1


@pytest.mark.asyncio
async def test_recruiter_review_cap_hit_logs_warning(caplog):
    """When recruiter sub-scores never clear the bar, cap rewrites at MAX_RECRUITER_PASSES and log."""
    pipeline = TailorPipeline.__new__(TailorPipeline)
    pipeline.flash_model = "test-flash"
    pipeline.pro_model = "test-pro"

    jd = JDAnalysis(
        role_title="Role",
        role_family="Eng",
        seniority="mid",
        must_haves=["Python"],
        keywords=["Python"],
        responsibilities=["Build"],
        summary="eng",
    )
    evidence = EvidenceMap(items=[EvidenceItem(requirement="Python", support=EvidenceSupport.PARTIAL)], gaps=[])
    fit = FitVerdict(fit_score=55, fit_label=FitLabel.STRETCH, rationale="stretch", gap_list=[])
    ats = ATSScoreResult(score=90, critique="fine")
    resume = _pipeline_resume()

    pipeline.analyze_jd = AsyncMock(return_value=jd)
    pipeline.map_evidence = AsyncMock(return_value=evidence)
    pipeline.plan_resume = AsyncMock(return_value=ResumePlan())
    import app.services.job.tailor_pipeline as tp

    original = tp.compute_fit_verdict_and_raw
    tp.compute_fit_verdict_and_raw = MagicMock(return_value=(fit, 55))

    pipeline.write_resume = AsyncMock(return_value=dict(resume))
    pipeline.refine_resume = AsyncMock(return_value=dict(resume))
    pipeline.score_resume = AsyncMock(
        return_value=(ats, {"llm_raw": 90, "llm_clamped": 90, "structure": 90, "blended": 90})
    )
    pipeline.guardrail_specificity = AsyncMock(
        return_value=BulletQualityResult(passed=True, issues=[], critique="")
    )
    pipeline._repair_resume_honesty = AsyncMock(side_effect=lambda resume, *a, **k: resume)
    pipeline.build_gap_roadmap = AsyncMock(return_value=None)

    always_failing = _passing_recruiter_review(readability=3, critique="Still weak.")
    pipeline.review_as_recruiter = AsyncMock(return_value=always_failing)

    try:
        with caplog.at_level("WARNING"):
            result = await pipeline.run(
                profile_info={"name": "T", "email": "t@x.com"},
                job_description={"text": "Python"},
            )
    finally:
        tp.compute_fit_verdict_and_raw = original

    from app.services.job.validators import max_recruiter_passes

    assert result["recruiter_review"]["passed"] is False
    assert result["recruiter_review"]["passes_used"] == max_recruiter_passes()
    assert any("recruiter_review_cap_hit" in r.message for r in caplog.records)


def test_write_mode_block_strong_stretch_transferable():
    strong = write_mode_block(FitLabel.STRONG)
    mismatch = write_mode_block(FitLabel.MISMATCH)
    stretch = write_mode_block("STRETCH")
    assert strong.startswith("## Write mode: STRONG")
    assert stretch.startswith("## Write mode: STRETCH")
    assert mismatch.startswith("## Write mode: TRANSFERABLE-ONLY")
    assert "Full keyword weave" in strong
    assert "Genuine reach" in stretch
    assert "Lighter keyword injection" in mismatch
    assert "Mismatch" in mismatch or "mismatch" in mismatch.lower()


@pytest.mark.asyncio
async def test_analyze_fit_only_returns_roadmap_on_mismatch():
    pipeline = TailorPipeline.__new__(TailorPipeline)
    pipeline.flash_model = "test-flash"
    pipeline.pro_model = "test-pro"

    jd = JDAnalysis(
        role_title="Senior IAM Engineer",
        role_family="IAM/Security",
        seniority="senior",
        must_haves=["Okta", "SAML"],
        keywords=["Okta"],
        responsibilities=["IAM"],
        summary="IAM",
    )
    evidence = EvidenceMap(
        items=[
            EvidenceItem(requirement="Okta", support=EvidenceSupport.MISSING),
            EvidenceItem(requirement="SAML", support=EvidenceSupport.MISSING),
        ],
        candidate_seniority_estimate="junior",
        transferable_themes=["API integration", "OAuth/JWT"],
        gaps=["Okta", "SAML"],
    )
    roadmap = GapRoadmap(
        summary="Build toward identity engineering",
        steps=[
            GapRoadmapStep(title="Learn SAML", detail="Build a demo SP", category="project"),
            GapRoadmapStep(title="Okta Developer", detail="Complete free Okta courses", category="skill"),
            GapRoadmapStep(title="PKI basics", detail="Study cert lifecycle", category="skill"),
        ],
    )

    pipeline.analyze_jd = AsyncMock(return_value=jd)
    pipeline.map_evidence = AsyncMock(return_value=evidence)
    pipeline.build_gap_roadmap = AsyncMock(return_value=roadmap)

    result = await pipeline.analyze_fit_only(
        profile_info={"name": "T", "email": "t@x.com"},
        job_description={"role": "IAM", "description": "Okta SAML"},
    )
    assert result["fit_label"] == "MISMATCH"
    assert result["gap_roadmap"] is not None
    assert 3 <= len(result["gap_roadmap"]["steps"]) <= 5
    pipeline.build_gap_roadmap.assert_awaited_once()


@pytest.mark.asyncio
async def test_build_gap_roadmap_skipped_on_strong():
    pipeline = TailorPipeline.__new__(TailorPipeline)
    pipeline.flash_model = "test-flash"
    fit = FitVerdict(fit_score=85, fit_label=FitLabel.STRONG, rationale="good", gap_list=[])
    jd = JDAnalysis(
        role_title="Full Stack",
        role_family="Full-Stack",
        seniority="mid",
        must_haves=["React"],
        keywords=["React"],
        responsibilities=["Build"],
        summary="FS",
    )
    evidence = EvidenceMap(items=[], gaps=[])
    result = await pipeline.build_gap_roadmap(
        jd, evidence, fit, user_id=None, reference_id=None
    )
    assert result is None


def test_tailored_resume_schema_and_latex_from_fixture():
    resume = _load("strong_match_tailored_resume.json")
    assert_tailored_quality(resume)
    sanitized = sanitize_special_chars(resume)
    info = CustomResumeInfo.model_validate(sanitized)
    latex = build_resume(info)
    assert "Summary" in latex
    assert info.headline in latex or "textit" in latex
    assert "Security / Auth" in latex or not info.skills.domain_relevant
    docx = build_docx_bytes(info)
    assert docx[:2] == b"PK"  # zip/docx


def test_iam_tailored_example_has_no_invented_tools():
    resume = _load("iam_stretch_tailored_resume.json")
    assert_tailored_quality(resume)
    assert_no_forbidden_tools(resume, FORBIDDEN_IAM_TOOLS)
    # Should amplify auth-adjacent language honestly
    blob = json.dumps(resume).lower()
    assert "oauth" in blob or "jwt" in blob or "auth" in blob


def test_fixtures_exist():
    assert (FIXTURES / "fullstack_profile.json").exists()
    assert (FIXTURES / "iam_jd.json").exists()
    assert (FIXTURES / "fullstack_jd.json").exists()
