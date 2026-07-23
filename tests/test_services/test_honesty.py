"""Unit tests for honesty helpers (quote verification, forbidden scan)."""

from app.schemas.tailor import EvidenceItem, EvidenceMap, EvidenceSupport
from app.services.job.honesty import (
    quote_matches_source,
    verify_evidence_quotes,
    forbidden_tools_from_evidence,
    forbidden_tool_tokens_from_evidence,
    filter_resume_honesty_hits,
    find_forbidden_in_text,
)


def test_quote_matches_source_substring():
    src = 'Built GraphQL APIs processing 100+ daily requests at Acme'
    assert quote_matches_source("GraphQL APIs processing 100+", src)
    assert not quote_matches_source("administered Okta for 500 users", src)


def test_verify_evidence_quotes_downgrades_unsupported():
    profile = {
        "past_experience": [
            {"description": "Designed GraphQL APIs processing 100+ daily requests"}
        ]
    }
    evidence = EvidenceMap(
        items=[
            EvidenceItem(
                requirement="GraphQL",
                support=EvidenceSupport.SUPPORTED,
                evidence_quote="Designed GraphQL APIs processing 100+ daily requests",
            ),
            EvidenceItem(
                requirement="Okta",
                support=EvidenceSupport.SUPPORTED,
                evidence_quote="Administered Okta enterprise SSO for 10k users",
            ),
        ]
    )
    updated, count = verify_evidence_quotes(evidence, profile)
    assert count == 1
    by_req = {i.requirement: i for i in updated.items}
    assert by_req["GraphQL"].support == EvidenceSupport.SUPPORTED
    assert by_req["Okta"].support == EvidenceSupport.PARTIAL


def test_forbidden_tools_missing_only():
    evidence = EvidenceMap(
        items=[
            EvidenceItem(requirement="Okta", support=EvidenceSupport.MISSING),
            EvidenceItem(requirement="OAuth", support=EvidenceSupport.PARTIAL),
        ]
    )
    forbidden = forbidden_tools_from_evidence(evidence)
    assert "okta" in forbidden
    assert "oauth" not in forbidden
    assert find_forbidden_in_text("I used Okta daily", forbidden)
    assert not find_forbidden_in_text("I used OAuth daily", forbidden)


def test_forbidden_tokens_skip_jd_boilerplate():
    """Full JD sentences must not produce generic forbidden tokens like 'experience'."""
    evidence = EvidenceMap(
        items=[
            EvidenceItem(
                requirement="Experience with Spring, Spring Boot, Spring MVC",
                support=EvidenceSupport.MISSING,
            ),
            EvidenceItem(
                requirement="Excellent analytical and time management skills",
                support=EvidenceSupport.MISSING,
            ),
        ]
    )
    tokens = forbidden_tool_tokens_from_evidence(evidence)
    assert "experience" not in tokens
    assert "skills" not in tokens
    assert "with" not in tokens
    assert "time" not in tokens
    assert "spring" in tokens

    resume_text = (
        "Software engineer with experience building REST APIs and microservices "
        "using Java and data pipelines."
    )
    assert not find_forbidden_in_text(resume_text, tokens)


def test_filter_resume_honesty_hits_drops_generic():
    evidence = EvidenceMap(
        items=[
            EvidenceItem(
                requirement="Experience with Spring, Spring Boot, Spring MVC",
                support=EvidenceSupport.MISSING,
            ),
        ]
    )
    noisy_hits = [
        "experience",
        "software",
        "skills",
        "with",
        "spring",  # substring scan on resume text
        "Experience with Spring, Spring Boot, Spring MVC",  # implied scan — should drop
    ]
    filtered = filter_resume_honesty_hits(noisy_hits, evidence)
    assert "experience" not in [h.lower() for h in filtered]
    assert "software" not in [h.lower() for h in filtered]
    assert any(h.lower() == "spring" for h in filtered)
    assert not any("spring boot" in h.lower() for h in filtered)


def test_soft_skill_jd_requirements_do_not_trigger_resume_honesty_repair():
    """Reproduce live false positives: JD soft-skill MISSING lines must not flag honest resumes."""
    evidence = EvidenceMap(
        items=[
            EvidenceItem(
                requirement="Strong understanding of data structures",
                support=EvidenceSupport.MISSING,
            ),
            EvidenceItem(
                requirement="Strong understanding of algorithms",
                support=EvidenceSupport.MISSING,
            ),
            EvidenceItem(
                requirement="Experience with CI/CD pipelines",
                support=EvidenceSupport.MISSING,
            ),
            EvidenceItem(
                requirement="Exceptional analytical abilities",
                support=EvidenceSupport.MISSING,
            ),
            EvidenceItem(
                requirement="Problem-solving skills",
                support=EvidenceSupport.MISSING,
            ),
        ]
    )
    tokens = forbidden_tool_tokens_from_evidence(evidence)
    assert "pipelines" not in tokens
    assert "structures" not in tokens
    assert "algorithms" not in tokens

    resume_text = (
        "Built data pipelines and REST APIs. Strong analytical problem-solving on production "
        "systems. Designed algorithms for ranking features."
    )
    assert not find_forbidden_in_text(resume_text, tokens)

    implied_hits = [
        "pipelines",
        "Strong understanding of data structures",
        "Strong understanding of algorithms",
        "Experience with CI/CD pipelines",
        "Exceptional analytical abilities",
        "Problem-solving skills",
    ]
    assert filter_resume_honesty_hits(implied_hits, evidence) == []


def test_missing_requirements_for_implied_scan_skips_soft_skills():
    from app.services.job.honesty import missing_requirements_for_implied_scan

    evidence = EvidenceMap(
        items=[
            EvidenceItem(requirement="Strong understanding of data structures", support=EvidenceSupport.MISSING),
            EvidenceItem(requirement="Okta", support=EvidenceSupport.MISSING),
        ]
    )
    missing = missing_requirements_for_implied_scan(evidence)
    assert missing == ["Okta"]
