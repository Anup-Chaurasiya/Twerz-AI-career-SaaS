"""Unit tests for honesty helpers (quote verification, forbidden scan)."""

from app.schemas.tailor import EvidenceItem, EvidenceMap, EvidenceSupport
from app.services.job.honesty import (
    quote_matches_source,
    verify_evidence_quotes,
    forbidden_tools_from_evidence,
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
