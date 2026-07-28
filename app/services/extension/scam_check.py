"""Listing risk heuristics for Apply Assist (Phase 4 hardening)."""

from __future__ import annotations

import re
from urllib.parse import urlparse

from app.models.job import Job
from app.services.extension.helpers import job_source_url

_SCAM_PHRASES = (
    "wire transfer",
    "registration fee",
    "pay upfront",
    "upfront payment",
    "send ssn",
    "social security number",
    "background check fee",
    "training fee required",
    "whatsapp only",
    "telegram only",
    "crypto wallet",
)

_SUSPICIOUS_HOST_FRAGMENTS = (
    "bit.ly",
    "tinyurl.com",
    "t.me",
    "telegram.me",
    "wa.me",
)

_TRUSTED_ATS_HOSTS = (
    "greenhouse.io",
    "lever.co",
    "myworkdayjobs.com",
    "linkedin.com",
    "indeed.com",
    "naukri.com",
    "wellfound.com",
)

_TOO_GOOD_SALARY = re.compile(
    r"\$\s*\d{3,3}[,\s]?\d{3}\+?\s*(?:per\s+)?(?:week|day)\b",
    re.IGNORECASE,
)


def assess_listing_risk(job: Job, *, page_url: str | None = None) -> dict:
    """Return scam/safety signals for a job before Apply Assist fills a form."""
    jd = job.job_description or {}
    description = (jd.get("description") or "").lower()
    source = (page_url or job_source_url(job) or "").strip()
    warnings: list[str] = []
    risk_level = "low"

    for phrase in _SCAM_PHRASES:
        if phrase in description:
            warnings.append(f"Posting mentions “{phrase}” — verify this is a legitimate employer.")
            risk_level = "high"

    if _TOO_GOOD_SALARY.search(description):
        warnings.append("Unusually high pay frequency detected — common in scam listings.")
        risk_level = "high" if risk_level != "high" else risk_level
        if risk_level != "high":
            risk_level = "medium"

    parsed = urlparse(source.lower()) if source else None
    host = parsed.netloc if parsed else ""
    if host:
        if any(fragment in host for fragment in _SUSPICIOUS_HOST_FRAGMENTS):
            warnings.append("Application link uses a shortened or messaging-app URL.")
            risk_level = "high"
        elif not any(trusted in host for trusted in _TRUSTED_ATS_HOSTS):
            warnings.append(
                "Application is not on a known ATS/career board domain — double-check the employer."
            )
            if risk_level == "low":
                risk_level = "medium"

    company = (jd.get("company") or "").strip()
    if company and host and len(company) >= 4:
        slug = re.sub(r"[^a-z0-9]", "", company.lower())
        if slug and slug not in host.replace("-", "").replace(".", ""):
            # Only warn when host is not a major aggregator
            if any(trusted in host for trusted in ("greenhouse.io", "lever.co", "myworkdayjobs.com")):
                pass
            elif "linkedin.com" not in host and "indeed.com" not in host:
                warnings.append(
                    f"Company “{company}” may not match the application domain — confirm employer identity."
                )
                if risk_level == "low":
                    risk_level = "medium"

    return {
        "risk_level": risk_level,
        "warnings": warnings,
        "requires_acknowledgement": risk_level == "high",
        "blocked": False,
    }
