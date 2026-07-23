"""Unit tests for resume quality validators."""

from __future__ import annotations

from app.schemas.tailor import EvidenceItem, EvidenceMap, EvidenceSupport, FitLabel, RecruiterReviewResult
from app.services.job.tailor_pipeline import normalize_profile_for_tailor, split_profile_bullets
from app.services.job.validators import (
    RECRUITER_SCORE_THRESHOLD,
    compute_keyword_coverage,
    estimate_target_page_count,
    fit_aware_thresholds,
    page_target_block,
    recruiter_critique_from,
    recruiter_review_passed,
    validate_content_preservation,
    validate_formatting,
    validate_structure,
)


VALID_SUMMARY = (
    "Built production SaaS APIs and web apps with measurable impact across several products "
    "and teams. Delivered features on schedule with strong measurable results."
)


def _rich_profile() -> dict:
    """Synthetic ~3-page profile: 6 roles, 4 projects."""
    roles = []
    for i in range(6):
        roles.append(
            {
                "company_name": f"Company{i}",
                "role": f"Engineer{i}",
                "start_date": "2018",
                "end_date": "2020",
                "description": "\n".join(
                    [f"Bullet {j} for role {i} with metric {j * 10}%" for j in range(1, 6)]
                ),
            }
        )
    projects = []
    for i in range(4):
        projects.append(
            {
                "name": f"Project{i}",
                "description": "\n".join([f"Project bullet {j}" for j in range(1, 5)]),
            }
        )
    return {
        "name": "Test User",
        "email": "test@example.com",
        "past_experience": roles,
        "projects": projects,
        "educations": [{"degree": "BS", "institution": "Uni", "start_date": "2014", "end_date": "2018"}],
    }


def test_estimate_target_page_count_uses_original():
    profile = _rich_profile()
    assert estimate_target_page_count(profile, 3, split_fn=split_profile_bullets) == 3


def test_estimate_target_page_count_fallback_from_content():
    profile = _rich_profile()
    estimated = estimate_target_page_count(profile, None, split_fn=split_profile_bullets)
    assert estimated >= 2


def test_page_target_block_mentions_page_count():
    block = page_target_block(3)
    assert "3 page" in block.lower()
    assert "never drop" in block.lower()


def test_compute_keyword_coverage():
    evidence = EvidenceMap(
        items=[
            EvidenceItem(requirement="Python", support=EvidenceSupport.SUPPORTED),
            EvidenceItem(requirement="React", support=EvidenceSupport.SUPPORTED),
            EvidenceItem(requirement="Okta", support=EvidenceSupport.MISSING),
        ]
    )
    resume = {
        "headline": "Python Engineer",
        "summary": VALID_SUMMARY,
        "past_experience": [{"description": ["Built services in Python and React"]}],
        "skills": {"languages": ["Python", "React"]},
    }
    cov = compute_keyword_coverage(resume, evidence)
    assert cov.supported_total == 2
    assert cov.supported_matched == 2
    assert cov.supported_pct == 100.0
    assert "Okta" not in cov.missing_supported


def test_validate_content_preservation_detects_dropped_role():
    profile = _rich_profile()
    tailored = {
        "name": "Test User",
        "past_experience": profile["past_experience"][:3],
        "projects": profile["projects"],
    }
    result = validate_content_preservation(profile, tailored, split_fn=split_profile_bullets)
    assert not result.passed
    assert any("Missing experiences" in i for i in result.issues)


def test_validate_structure_requires_summary_and_skills():
    bad = {"headline": "Eng", "summary": "short", "past_experience": [], "skills": {}}
    result = validate_structure(bad)
    assert not result.passed

    good = {
        "headline": "Software Engineer",
        "summary": VALID_SUMMARY,
        "past_experience": [{"company_name": "Acme", "role": "Eng", "start_date": "2020", "description": ["x"]}],
        "skills": {"languages": ["Python"], "frameworks": ["FastAPI"], "databases": ["PostgreSQL"]},
    }
    assert validate_structure(good).passed


def test_normalize_profile_for_tailor_splits_bullets():
    profile = {
        "past_experience": [{"company_name": "Acme", "role": "Eng", "description": "Line one\nLine two"}],
        "projects": [],
        "achievements": [{"name": "Award", "description": "Top performer"}],
    }
    normalized = normalize_profile_for_tailor(profile)
    assert normalized["past_experience"][0]["description"] == ["Line one", "Line two"]
    assert normalized["achievements"] == ["Award: Top performer"]


def test_fit_aware_thresholds():
    assert fit_aware_thresholds(FitLabel.STRONG)[0] == 85
    assert fit_aware_thresholds(FitLabel.STRETCH)[0] == 78
    assert fit_aware_thresholds(FitLabel.MISMATCH)[0] == 72


def test_rich_profile_target_page_count_three():
    profile = _rich_profile()
    assert estimate_target_page_count(profile, 3, split_fn=split_profile_bullets) == 3
    normalized = normalize_profile_for_tailor(profile)
    assert len(normalized["past_experience"]) == 6
    assert len(normalized["projects"]) == 4


def test_validate_formatting_clean_resume_passes():
    resume = {
        "skills": {"languages": ["Python"], "frameworks": ["React"], "databases": ["PostgreSQL"]},
        "past_experience": [
            {
                "description": [
                    "Built REST APIs serving 10k daily requests",
                    "Optimized database queries cutting latency 40%",
                    "Debugged production incidents across the payments pipeline",
                ]
            }
        ],
        "projects": [],
    }
    assert validate_formatting(resume).passed


def test_validate_formatting_detects_duplicate_skills():
    resume = {
        "skills": {"languages": ["Python", "python"], "frameworks": ["React"]},
        "past_experience": [],
        "projects": [],
    }
    result = validate_formatting(resume)
    assert not result.passed
    assert any("Duplicate skill" in i for i in result.issues)


def test_validate_formatting_detects_repeated_consecutive_verbs():
    resume = {
        "skills": {"languages": ["Python"]},
        "past_experience": [
            {
                "description": [
                    "Built REST APIs for checkout",
                    "Built GraphQL resolvers for catalog",
                    "Built internal tooling for support",
                ]
            }
        ],
        "projects": [],
    }
    result = validate_formatting(resume)
    assert not result.passed
    assert any("repeated" in i.lower() for i in result.issues)


def test_validate_formatting_detects_overlong_bullet():
    long_bullet = "Built " + "very " * 40 + "long bullet describing everything at once without impact"
    resume = {
        "skills": {"languages": ["Python"]},
        "past_experience": [{"description": [long_bullet]}],
        "projects": [],
    }
    result = validate_formatting(resume)
    assert not result.passed
    assert any("exceeds" in i.lower() for i in result.issues)


def test_recruiter_review_passed_gate():
    strong = RecruiterReviewResult(
        readability=9, professionalism=9, trust=9, scanability=9, shortlist_likelihood=9
    )
    passed, min_score = recruiter_review_passed(strong)
    assert passed
    assert min_score == 9

    weak = RecruiterReviewResult(
        readability=9, professionalism=9, trust=6, scanability=9, shortlist_likelihood=9
    )
    passed, min_score = recruiter_review_passed(weak)
    assert not passed
    assert min_score == 6
    assert RECRUITER_SCORE_THRESHOLD == 8


def test_recruiter_critique_from_assembles_all_feedback():
    review = RecruiterReviewResult(
        readability=5,
        professionalism=5,
        trust=5,
        scanability=5,
        shortlist_likelihood=5,
        critique="Tighten the summary.",
        summary_feedback="Generic filler.",
        flow_feedback="Reads like a bullet dump.",
        repetitive_notes=["Built used 4 times"],
        weak_bullets=["Worked on stuff"],
        bullets_to_move=["Move the Docker bullet up"],
    )
    text = recruiter_critique_from(review)
    assert "Tighten the summary." in text
    assert "Generic filler." in text
    assert "bullet dump" in text
    assert "Built used 4 times" in text
    assert "Worked on stuff" in text
    assert "Docker bullet" in text
