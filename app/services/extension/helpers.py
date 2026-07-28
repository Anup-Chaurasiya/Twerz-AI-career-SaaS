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


def normalize_job_url(url: str) -> str:
    if not url:
        return ""
    url = url.strip()
    parsed = urlparse(url.lower())
    path = parsed.path.rstrip("/")
    return urlunparse((parsed.scheme, parsed.netloc, path, "", "", ""))


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


async def find_job_by_page_url(
    db: AsyncSession,
    user_id: str,
    page_url: str,
    *,
    limit: int = 200,
) -> Job | None:
    """Find the most recent job whose captured source URL matches the active tab."""
    result = await db.execute(
        select(Job)
        .where(Job.user_id == user_id)
        .order_by(Job.updated_at.desc())
        .limit(limit)
    )
    page_key = extract_posting_key(page_url)
    for job in result.scalars().all():
        source = job_source_url(job)
        if source and urls_match(page_url, source):
            return job
        if page_key:
            source_key = extract_posting_key(source or "")
            if source_key and source_key == page_key:
                return job
        jd = job.job_description or {}
        company = (jd.get("company") or "").lower()
        role = (jd.get("role") or "").lower()
        parsed = urlparse(page_url.lower())
        host_path = f"{parsed.netloc}{parsed.path}"
        if company and company in host_path:
            if role and role.replace(" ", "-") in host_path.replace(" ", "-"):
                return job
    return None
