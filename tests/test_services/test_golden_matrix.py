"""Golden JD matrix — CI-safe deterministic regression gate (no LLM)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.custom_resume import CustomResumeInfo
from app.schemas.tailor import (
    ATSScoreResult,
    BulletQualityResult,
    FitLabel,
    GapRoadmap,
    GapRoadmapStep,
    RecruiterReviewResult,
    ResumePlan,
)
from app.services.job.tailor_pipeline import TailorPipeline, compute_fit_verdict
from tests.test_services.golden_invariants import (
    assert_ats_moved_or_structure_improved,
    assert_evidence_categories_sum,
    assert_keyword_coverage,
    assert_no_forbidden_tools,
    assert_roadmap_policy,
    assert_scores_in_range,
    assert_specificity_non_regression,
)
from tests.test_services.golden_loader import (
    cell_id,
    load_evidence_bundle,
    load_matrix,
    load_persona,
    load_tailored,
    matrix_cells,
)


def _passing_recruiter_review() -> RecruiterReviewResult:
    return RecruiterReviewResult(
        would_shortlist=True,
        ten_second_clarity=True,
        readability=9,
        professionalism=9,
        trust=9,
        scanability=9,
        shortlist_likelihood=9,
        critique="",
    )


@pytest.fixture(scope="module")
def matrix():
    return load_matrix()


@pytest.mark.parametrize("cell", matrix_cells(), ids=lambda c: cell_id(c))
def test_matrix_cell_fit_verdict_matches_manifest(cell):
    jd, evidence = load_evidence_bundle(cell["persona"], cell["jd_key"])
    assert_evidence_categories_sum(evidence)
    fit = compute_fit_verdict(jd, evidence)
    assert fit.fit_label.value == cell["expected_fit_label"]
    assert cell["expected_fit_score_min"] <= fit.fit_score <= cell["expected_fit_score_max"]
    assert 0 <= fit.fit_score <= 100


def test_matrix_has_twelve_cells(matrix):
    assert len(matrix["cells"]) == 12
    assert "rubric" in matrix and len(matrix["rubric"]) >= 4


def test_existing_tailored_fixtures_quality_and_forbidden():
    strong = load_tailored("junior_generalist", "strong_match")
    assert strong is not None
    CustomResumeInfo.model_validate(strong)

    mismatch = load_tailored("junior_generalist", "mismatch")
    assert mismatch is not None
    CustomResumeInfo.model_validate(mismatch)
    assert_no_forbidden_tools(
        mismatch, {"okta", "saml", "oidc", "cyberark", "azure ad", "sailpoint"}
    )


@pytest.mark.asyncio
async def test_mocked_run_strong_cell_invariants():
    persona, jd_key = "junior_generalist", "strong_match"
    jd, evidence = load_evidence_bundle(persona, jd_key)
    fit = compute_fit_verdict(jd, evidence)
    assert fit.fit_label == FitLabel.STRONG

    tailored = load_tailored(persona, jd_key)
    assert tailored is not None
    profile = load_persona(persona)

    pipeline = TailorPipeline.__new__(TailorPipeline)
    pipeline.flash_model = "test-flash"
    pipeline.pro_model = "test-pro"
    pipeline.analyze_jd = AsyncMock(return_value=jd)
    pipeline.map_evidence = AsyncMock(return_value=evidence)

    import app.services.job.tailor_pipeline as tp

    original = tp.compute_fit_verdict_and_raw
    tp.compute_fit_verdict_and_raw = MagicMock(return_value=(fit, fit.fit_score))

    low = ATSScoreResult(score=40, critique="structure weak")
    high = ATSScoreResult(score=78, critique="better")

    async def fake_score(*_a, purpose: str = "", **_k):
        meta_low = {"llm_raw": 40, "llm_clamped": 40, "structure": 50, "blended": 40}
        meta_hi = {"llm_raw": 78, "llm_clamped": 78, "structure": 85, "blended": 78}
        if purpose == "ats_score_before":
            return low, meta_low
        return high, meta_hi

    pipeline.score_resume = AsyncMock(side_effect=fake_score)
    pipeline.write_resume = AsyncMock(return_value=dict(tailored))
    pipeline.refine_resume = AsyncMock(return_value=dict(tailored))
    pipeline.guardrail_specificity = AsyncMock(
        return_value=BulletQualityResult(passed=True, issues=[], critique="")
    )
    pipeline.build_gap_roadmap = AsyncMock(return_value=None)
    pipeline._repair_resume_honesty = AsyncMock(side_effect=lambda resume, *a, **k: resume)
    pipeline.plan_resume = AsyncMock(return_value=ResumePlan())
    pipeline.review_as_recruiter = AsyncMock(return_value=_passing_recruiter_review())

    try:
        result = await pipeline.run(profile_info=profile, job_description={"text": "FS"})
    finally:
        tp.compute_fit_verdict_and_raw = original

    assert_scores_in_range(result)
    assert_ats_moved_or_structure_improved(
        result["ats_score_before"],
        result["ats_score_after"],
        result["ats_score_detail"]["structure"]["before"],
        result["ats_score_detail"]["structure"]["after"],
    )
    assert_roadmap_policy(result["fit_label"], result.get("gap_roadmap"))
    assert result.get("bullet_diff") is not None
    assert_specificity_non_regression(result["bullet_diff"])
    assert_keyword_coverage(result, fit_label=result["fit_label"], min_supported_pct=0)


@pytest.mark.asyncio
async def test_mocked_run_mismatch_cell_invariants():
    persona, jd_key = "junior_generalist", "mismatch"
    jd, evidence = load_evidence_bundle(persona, jd_key)
    fit = compute_fit_verdict(jd, evidence)
    assert fit.fit_label == FitLabel.MISMATCH

    tailored = load_tailored(persona, jd_key)
    assert tailored is not None
    profile = load_persona(persona)
    cell = next(c for c in matrix_cells() if c["persona"] == persona and c["jd_key"] == jd_key)

    roadmap = GapRoadmap(
        summary="Path toward identity engineering",
        steps=[
            GapRoadmapStep(title="Okta fundamentals", detail="Complete Okta admin trail", category="skill"),
            GapRoadmapStep(title="SAML lab", detail="Build a SAML SP", category="project"),
            GapRoadmapStep(title="OIDC deep dive", detail="Implement OIDC client", category="skill"),
        ],
    )

    pipeline = TailorPipeline.__new__(TailorPipeline)
    pipeline.flash_model = "test-flash"
    pipeline.pro_model = "test-pro"
    pipeline.analyze_jd = AsyncMock(return_value=jd)
    pipeline.map_evidence = AsyncMock(return_value=evidence)

    import app.services.job.tailor_pipeline as tp

    original = tp.compute_fit_verdict_and_raw
    tp.compute_fit_verdict_and_raw = MagicMock(return_value=(fit, 0))

    before = ATSScoreResult(score=30, critique="weak")
    after = ATSScoreResult(score=48, critique="better structure")

    async def fake_score(*_a, purpose: str = "", **_k):
        meta_b = {"llm_raw": 30, "llm_clamped": 30, "structure": 45, "blended": 30}
        meta_a = {"llm_raw": 48, "llm_clamped": 48, "structure": 70, "blended": 48}
        if purpose == "ats_score_before":
            return before, meta_b
        return after, meta_a

    pipeline.score_resume = AsyncMock(side_effect=fake_score)
    pipeline.write_resume = AsyncMock(return_value=dict(tailored))
    pipeline.refine_resume = AsyncMock(return_value=dict(tailored))
    pipeline.guardrail_specificity = AsyncMock(
        return_value=BulletQualityResult(passed=True, issues=[], critique="")
    )
    pipeline.build_gap_roadmap = AsyncMock(return_value=roadmap)
    pipeline._repair_resume_honesty = AsyncMock(side_effect=lambda resume, *a, **k: resume)
    pipeline.plan_resume = AsyncMock(return_value=ResumePlan())
    pipeline.review_as_recruiter = AsyncMock(return_value=_passing_recruiter_review())

    try:
        result = await pipeline.run(profile_info=profile, job_description={"text": "IAM"})
    finally:
        tp.compute_fit_verdict_and_raw = original

    assert_scores_in_range(result)
    assert_ats_moved_or_structure_improved(
        result["ats_score_before"],
        result["ats_score_after"],
        result["ats_score_detail"]["structure"]["before"],
        result["ats_score_detail"]["structure"]["after"],
    )
    assert_roadmap_policy(result["fit_label"], result.get("gap_roadmap"))
    assert_no_forbidden_tools(result["custom_resume_data"], cell["forbidden_tools"])
    assert result.get("bullet_diff") is not None


def test_roadmap_policy_helper():
    assert_roadmap_policy("STRONG", None)
    assert_roadmap_policy(
        "MISMATCH",
        {"steps": [{"title": "a", "detail": "d"}, {"title": "b", "detail": "d"}, {"title": "c", "detail": "d"}]},
    )
    with pytest.raises(AssertionError):
        assert_roadmap_policy("STRONG", {"steps": [{"title": "x", "detail": "y"}]})
    with pytest.raises(AssertionError):
        assert_roadmap_policy("STRETCH", {"steps": [{"title": "only one", "detail": "d"}]})
