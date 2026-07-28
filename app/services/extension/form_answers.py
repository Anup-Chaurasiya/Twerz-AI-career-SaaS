"""Evidence-grounded application form answers for the browser extension."""

from __future__ import annotations

import re

from app.models.job import Job
from app.services.job.tailor_pipeline import LOW_FIT_LABELS

_EEOC = re.compile(
    r"(race|ethnic|gender|sex|veteran|disability|eeo|demographic|pronoun|sexual orientation)",
    re.IGNORECASE,
)
_YEARS = re.compile(r"(\d+)\+?\s*years?", re.IGNORECASE)


def _first_last(name: str) -> tuple[str, str]:
    parts = (name or "").strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[-1]


def _skills_text(custom_resume: dict) -> str:
    skills = custom_resume.get("skills") or []
    if isinstance(skills, list):
        flat: list[str] = []
        for item in skills:
            if isinstance(item, str):
                flat.append(item)
            elif isinstance(item, dict):
                flat.extend(item.get("items") or [])
        return ", ".join(flat[:12])
    return ""


def _summary_text(custom_resume: dict, job: Job) -> str:
    summary = (custom_resume.get("summary") or custom_resume.get("professional_summary") or "").strip()
    if summary:
        return summary
    headline = (custom_resume.get("headline") or "").strip()
    jd = job.job_description or {}
    role = jd.get("role") or "this role"
    company = jd.get("company") or "your company"
    if headline:
        return f"{headline} I am excited to apply for {role} at {company}."
    return f"I am interested in the {role} position at {company}."


def _why_answer(job: Job) -> str:
    if job.cover_letter:
        paragraphs = [p.strip() for p in job.cover_letter.split("\n\n") if p.strip()]
        if paragraphs:
            return paragraphs[0][:800]
    rationale = (job.fit_rationale or "").strip()
    if rationale:
        return rationale[:800]
    jd = job.job_description or {}
    return (
        f"I am motivated to join {jd.get('company') or 'your team'} as {jd.get('role') or 'this role'} "
        "because my experience aligns with the requirements outlined in the posting."
    )


def _experience_years(custom_resume: dict) -> str:
    experience = custom_resume.get("experience") or []
    if not isinstance(experience, list) or not experience:
        return ""
    total = 0
    for entry in experience:
        if not isinstance(entry, dict):
            continue
        duration = entry.get("duration") or entry.get("dates") or ""
        match = _YEARS.search(str(duration))
        if match:
            total += int(match.group(1))
    if total > 0:
        return str(total)
    return str(len(experience))


def _match_single_label(label: str, custom_resume: dict, job: Job) -> str | None:
    text = label.lower()
    name = custom_resume.get("name") or ""
    first, last = _first_last(name)
    email = custom_resume.get("email") or ""
    phone = custom_resume.get("phone") or custom_resume.get("mobile") or ""
    linkedin = custom_resume.get("linkedin") or custom_resume.get("linkedin_url") or ""
    website = custom_resume.get("website") or custom_resume.get("portfolio") or ""
    location = custom_resume.get("location") or ""

    if any(k in text for k in ("first name", "given name", "forename")):
        return first or None
    if any(k in text for k in ("last name", "surname", "family name")):
        return last or None
    if "full name" in text or text.strip() in ("name", "your name"):
        return name or None
    if "email" in text:
        return email or None
    if any(k in text for k in ("phone", "mobile", "telephone")):
        return phone or None
    if "linkedin" in text:
        return linkedin or None
    if any(k in text for k in ("website", "portfolio", "github", "personal site")):
        return website or None
    if any(k in text for k in ("city", "location", "address")):
        return location or None
    if "years" in text and "experience" in text:
        return _experience_years(custom_resume) or None
    if any(k in text for k in ("skill", "technologies", "tech stack")):
        return _skills_text(custom_resume) or None
    if any(k in text for k in ("cover letter", "additional information", "anything else")):
        return job.cover_letter or None
    if any(k in text for k in ("why", "motivat", "interest", "this role", "this company", "join us")):
        return _why_answer(job)
    if any(k in text for k in ("summary", "about you", "about yourself", "tell us", "introduce")):
        return _summary_text(custom_resume, job)
    if "headline" in text or "current title" in text:
        return (custom_resume.get("headline") or "").strip() or None
    return None


def build_form_answers(job: Job, questions: list[dict], *, allow_eeoc: bool = False) -> dict:
    """Map scraped form field labels to evidence-grounded answers."""
    custom_resume = job.custom_resume_data or {}
    answers: dict[str, dict] = {}
    for question in questions:
        label = (question.get("label") or "").strip()
        field_id = str(question.get("id") or label or "").strip()
        if not field_id:
            continue
        if _EEOC.search(label) and not allow_eeoc:
            answers[field_id] = {
                "value": None,
                "skip": True,
                "reason": "eeoc_requires_explicit_consent",
            }
            continue
        if _EEOC.search(label) and allow_eeoc:
            answers[field_id] = {
                "value": None,
                "skip": True,
                "reason": "eeoc_manual_only",
            }
            continue
        value = _match_single_label(label, custom_resume, job)
        if value:
            answers[field_id] = {"value": value, "skip": False}
        else:
            answers[field_id] = {"value": None, "skip": True, "reason": "no_evidence_match"}
    return {
        "answers": answers,
        "fit_label": job.fit_label,
        "requires_mismatch_override": job.fit_label in LOW_FIT_LABELS,
    }
