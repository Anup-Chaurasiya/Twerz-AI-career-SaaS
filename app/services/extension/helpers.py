"""URL matching and job lookup helpers for the browser extension."""

from __future__ import annotations

import re
from urllib.parse import urlparse, urlunparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job

_WORKDAY_REQ = re.compile(r"_(R\d+)\b", re.IGNORECASE)
_GREENHOUSE_JOB = re.compile(r"/jobs/(\d+)", re.IGNORECASE)
_LEVER_POSTING = re.compile(r"jobs\.lever\.co/[^/]+/([a-f0-9-]{36})", re.IGNORECASE)

_SENIORITY_TOKENS = (
    "senior",
    "sr",
    "junior",
    "jr",
    "lead",
    "staff",
    "principal",
    "associate",
    "intern",
    "ii",
    "iii",
    "iv",
)


def normalize_job_url(url: str) -> str:
    if not url:
        return ""
    url = url.strip()
    parsed = urlparse(url.lower())
    path = parsed.path.rstrip("/")
    return urlunparse((parsed.scheme, parsed.netloc, path, "", "", ""))


def normalize_company(company: str) -> str:
    if not company:
        return ""
    return re.sub(r"[^a-z0-9]+", "", company.lower())


def normalize_role(role: str) -> str:
    """Lowercase role with seniority tokens stripped for fuzzy cross-domain match."""
    if not role:
        return ""
    r = role.lower().strip()
    for token in _SENIORITY_TOKENS:
        r = re.sub(rf"\b{re.escape(token)}\.?\b", " ", r)
    r = re.sub(r"[^a-z0-9]+", "-", r).strip("-")
    return r


def extract_posting_key(url: str) -> str | None:
    """Stable identifier shared between JD and apply URLs on the same posting."""
    if not url:
        return None
    lower = url.lower()
    workday = _WORKDAY_REQ.search(url)
    if workday:
        return f"workday:{workday.group(1).upper()}"
    if "greenhouse.io" in lower:
        gh = _GREENHOUSE_JOB.search(url)
        if gh:
            return f"greenhouse:{gh.group(1)}"
    if "lever.co" in lower:
        lv = _LEVER_POSTING.search(url)
        if lv:
            return f"lever:{lv.group(1)}"
    return None


def job_source_url(job: Job) -> str | None:
    jd = job.job_description or {}
    stored = jd.get("source_url")
    if stored:
        return str(stored)
    desc = jd.get("description") or ""
    marker = "\n\nSource:"
    if marker in desc:
        tail = desc.split(marker, 1)[1].strip()
        return tail.split("\n", 1)[0].strip()
    return None


def urls_match(candidate: str, reference: str) -> bool:
    left = normalize_job_url(candidate)
    right = normalize_job_url(reference)
    if not left or not right:
        return False
    if left == right:
        return True
    left_key = extract_posting_key(candidate)
    right_key = extract_posting_key(reference)
    if left_key and right_key and left_key == right_key:
        return True
    return left in right or right in left


def _company_role_match(job: Job, page_url: str) -> bool:
    jd = job.job_description or {}
    company = normalize_company(jd.get("company") or "")
    role = normalize_role(jd.get("role") or "")
    if not company or not role:
        return False
    parsed = urlparse(page_url.lower())
    host_path = re.sub(r"[^a-z0-9]+", "-", f"{parsed.netloc}{parsed.path}").strip("-")
    company_slug = company
    role_slug = role.replace("-", "")
    return company_slug in host_path.replace("-", "") and role_slug in host_path.replace("-", "")


async def find_job_by_page_url(
    db: AsyncSession,
    user_id: str,
    page_url: str,
    *,
    limit: int = 200,
) -> tuple[Job | None, str | None]:
    """Find the most recent job matching the active tab URL or company+role."""
    result = await db.execute(
        select(Job)
        .where(Job.user_id == user_id)
        .order_by(Job.updated_at.desc())
        .limit(limit)
    )
    page_key = extract_posting_key(page_url)
    company_role_candidate: Job | None = None

    for job in result.scalars().all():
        source = job_source_url(job)
        if source and urls_match(page_url, source):
            return job, "url"
        if page_key:
            source_key = extract_posting_key(source or "")
            if source_key and source_key == page_key:
                return job, "url"
        if company_role_candidate is None and _company_role_match(job, page_url):
            company_role_candidate = job

    if company_role_candidate is not None:
        return company_role_candidate, "company_role"
    return None, None
