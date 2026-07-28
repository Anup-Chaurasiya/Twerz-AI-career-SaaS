"""Extension URL matching helpers."""

from app.models.job import Job
from app.services.extension.helpers import (
    extract_posting_key,
    normalize_company,
    normalize_role,
    urls_match,
)


def test_normalize_role_strips_seniority():
    assert normalize_role("Senior Full Stack Engineer") == "full-stack-engineer"
    assert normalize_role("Jr. Backend Developer") == "backend-developer"


def test_normalize_company():
    assert normalize_company("Acme Corp.") == "acmecorp"


def test_workday_url_matching():
    jd = "https://company.wd5.myworkdayjobs.com/en-US/Acme/job/Bengaluru/Engineer_R01234"
    apply = "https://company.wd5.myworkdayjobs.com/en-US/Acme/job/Bengaluru/Engineer_R01234/apply"
    assert extract_posting_key(jd) == extract_posting_key(apply)
    assert urls_match(jd, apply)


def test_company_role_slugs():
    role = normalize_role("Full Stack Engineer")
    company = normalize_company("Acme")
    assert "full" in role and "stack" in role
    assert company == "acme"


def test_job_source_url_from_description_marker():
    job = Job(
        user_id="u",
        profile_id=1,
        job_description={
            "company": "Acme",
            "role": "Engineer",
            "description": "Build things.\n\nSource: https://example.com/job/1",
        },
    )
    from app.services.extension.helpers import job_source_url

    assert job_source_url(job) == "https://example.com/job/1"
