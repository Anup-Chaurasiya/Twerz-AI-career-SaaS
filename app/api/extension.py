"""Browser extension: JD capture, Apply Assist context, and form answers."""

from __future__ import annotations

from logging import getLogger

from fastapi import APIRouter, Body, Depends, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.background import create_tracked_task
from app.config import get_settings
from app.database.session import async_session_factory, get_db
from app.dependencies import get_current_user
from app.exceptions import BadRequestError, NotFoundError, UsageLimitExceeded
from app.models.job import Job, JobStatus
from app.models.profile import Profile, ProfileStatus
from app.models.user import User
from app.schemas.job import JobDescription
from app.services.credit.entitlements import has_pro_access, require_pro_or_pass
from app.services.credit.service import CreditService
from app.services.extension.form_answers import build_form_answers
from app.services.extension.helpers import find_job_by_page_url, job_source_url
from app.services.extension.scam_check import assess_listing_risk
from app.services.job.service import JobService
from app.services.job.tailor_pipeline import LOW_FIT_LABELS

router = APIRouter(prefix="/extension", tags=["extension"])
job_service = JobService()
credit_service = CreditService()
logger = getLogger(__name__)

EXTENSION_SCHEMA_VERSION = 1

ALLOWED_EXTENSION_EVENTS = frozenset({
    "capture_started",
    "capture_done",
    "analyze_started",
    "analyze_done",
    "analyze_failed",
    "generate_clicked",
    "generate_done",
    "generate_failed",
    "apply_sidebar_opened",
    "autofill_consented",
    "autofill_done",
    "autofill_partial",
})


class ExtensionCapturePayload(BaseModel):
    profile_id: int
    company: str = Field(..., min_length=1)
    role: str = Field(..., min_length=1)
    description: str = Field(..., min_length=20)
    source_url: str | None = None


class FormQuestionPayload(BaseModel):
    id: str | None = None
    label: str = Field(..., min_length=1)
    field_type: str | None = None


class FormAnswersRequest(BaseModel):
    questions: list[FormQuestionPayload] = Field(default_factory=list)
    confirm_low_fit: bool = False
    allow_eeoc: bool = False


class GenerateResumeExtensionRequest(BaseModel):
    confirm_low_fit: bool = Field(
        default=False,
        description="Required true when fit_label is STRETCH or MISMATCH",
    )


class ExtensionEventPayload(BaseModel):
    event: str = Field(..., min_length=1)
    job_id: int | None = None
    meta: dict | None = None


async def _generation_eligibility(job: Job, user_id: str, db: AsyncSession) -> dict:
    settings = get_settings()
    balance = await credit_service.get_balance(db, user_id)
    has_credits = await credit_service.has_credits_available(db, user_id)
    status_ok = job.status.value in ("PENDING", "FAILED")
    fit_ok = job.fit_label not in LOW_FIT_LABELS or job.low_fit_confirmed
    analyzed = job.fit_score is not None
    can = status_ok and has_credits and fit_ok and analyzed
    reason = None
    if not analyzed:
        reason = "analyze_required"
    elif not has_credits:
        reason = "no_credits"
    elif not fit_ok:
        reason = "low_fit_unconfirmed"
    elif not status_ok:
        reason = f"status_{job.status.value.lower()}"
    return {
        "effective_generation_cost": 0 if balance["has_unlimited"] else settings.RESUME_GENERATION_CREDIT_COST,
        "credits_available": has_credits,
        "has_unlimited": balance["has_unlimited"],
        "can_generate": can,
        "generation_block_reason": reason,
    }


def _badge_text_for_phase(phase: str, fit_score: int | None) -> str:
    if phase == "ready_to_apply":
        return "✓"
    if phase == "failed":
        return "!"
    if phase == "generating":
        return "…"
    if phase == "fit_analyzed":
        if fit_score is not None and fit_score >= 0:
            return str(min(fit_score, 99))
        return "#"
    if phase == "captured":
        return "."
    return "…"


def _job_extension_status(job: Job, *, credit_ctx: dict | None = None) -> dict:
    ready = (
        job.status in (JobStatus.READY, JobStatus.RESUME_GENERATED)
        and bool(job.custom_resume_data)
    )
    phase = "ready_to_apply"
    if job.status == JobStatus.PENDING:
        phase = "fit_analyzed" if job.fit_score is not None else "captured"
    elif job.status in (JobStatus.GENERATING_RESUME, JobStatus.GENERATING_PDF):
        phase = "generating"
    elif job.status == JobStatus.FAILED:
        phase = "failed"
    elif ready:
        phase = "ready_to_apply"
    elif job.fit_score is not None:
        phase = "fit_analyzed"

    jd = job.job_description or {}
    gaps_raw = job.gap_list or []
    gap_items = []
    for item in gaps_raw[:3]:
        if isinstance(item, str):
            gap_items.append(item)
        elif isinstance(item, dict):
            gap_items.append(item.get("requirement") or item.get("gap") or str(item))
        else:
            gap_items.append(str(item))

    rationale = job.fit_rationale or ""
    if len(rationale) > 200:
        rationale = rationale[:197].rstrip() + "…"

    payload = {
        "schema_version": EXTENSION_SCHEMA_VERSION,
        "job_id": job.id,
        "status": job.status.value,
        "phase": phase,
        "fit_score": job.fit_score,
        "fit_label": job.fit_label,
        "fit_rationale": rationale or None,
        "gap_list": gap_items,
        "company": jd.get("company"),
        "role": jd.get("role"),
        "requires_override": job.fit_label in LOW_FIT_LABELS,
        "low_fit_confirmed": bool(job.low_fit_confirmed),
        "has_cover_letter": bool(job.cover_letter),
        "ready_to_apply": ready,
        "application_status": job.application_status.value,
        "badge_text": _badge_text_for_phase(phase, job.fit_score),
    }
    if credit_ctx:
        payload.update(credit_ctx)
    return payload


async def _extension_status_for_job(job: Job, user_id: str, db: AsyncSession) -> dict:
    credit_ctx = await _generation_eligibility(job, user_id, db)
    return _job_extension_status(job, credit_ctx=credit_ctx)


async def _run_generate_resume(job_id: int, user_id: str, confirm_low_fit: bool) -> Job:
    async with async_session_factory() as db:
        job = await job_service.get_job(db, job_id, user_id, for_update=True)

        if job.status.value not in ("PENDING", "FAILED"):
            raise ValueError(f"Job is already {job.status.value} — cannot re-generate")

        if job.fit_score is None or not job.fit_label:
            job = await job_service.analyze_fit(db, job_id, user_id)
            job = await job_service.get_job(db, job_id, user_id, for_update=True)
            if job.status.value not in ("PENDING", "FAILED"):
                raise ValueError(f"Job is already {job.status.value} — cannot re-generate")

        if job.fit_label in LOW_FIT_LABELS and not confirm_low_fit and not job.low_fit_confirmed:
            raise ValueError(
                f"Fit is {job.fit_label} — set confirm_low_fit=true to generate anyway, "
                "or skip to avoid spending a credit."
            )

        if confirm_low_fit and job.fit_label in LOW_FIT_LABELS:
            job.low_fit_confirmed = True

        source = await credit_service.check_and_deduct(db, user_id, job_id)
        job.status = JobStatus.GENERATING_RESUME
        await db.commit()

    async def _generate():
        async with async_session_factory() as bg_db:
            phase1_succeeded = False
            try:
                await job_service.generate_custom_resume(bg_db, job_id, user_id)
                phase1_succeeded = True
                job = await job_service.get_job(bg_db, job_id, user_id)
                if job.status.value == "RESUME_GENERATED":
                    await job_service.generate_pdf(bg_db, job_id, user_id)
            except Exception:
                logger.exception("Background generation failed for extension job %s", job_id)
                if not phase1_succeeded and source != "time_pass":
                    try:
                        await credit_service.refund_credit(bg_db, user_id, job_id, source)
                    except Exception:
                        logger.exception("Failed to refund credit for extension job %s", job_id)

    create_tracked_task(_generate())

    async with async_session_factory() as db:
        return await job_service.get_job(db, job_id, user_id)


@router.get("/me")
async def extension_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Profiles + entitlement summary for the extension popup."""
    await require_pro_or_pass(
        db,
        current_user.id,
        feature="extension",
        message="Browser extension requires Job Hunt Pro or an active time pass.",
    )
    result = await db.execute(
        select(Profile)
        .where(
            Profile.user_id == current_user.id,
            Profile.is_active == True,  # noqa: E712
            Profile.status == ProfileStatus.READY,
        )
        .order_by(Profile.updated_at.desc())
    )
    profiles = result.scalars().all()
    balance = await credit_service.get_balance(db, current_user.id)
    settings = get_settings()
    api_base = settings.API_BASE_URL.strip() or None
    return {
        "user_id": current_user.id,
        "email": current_user.email,
        "has_pro_access": await has_pro_access(db, current_user.id),
        "credits_available": await credit_service.has_credits_available(db, current_user.id),
        "credit_balance": balance["balance"],
        "daily_free_remaining": balance["daily_free_remaining"],
        "has_unlimited": balance["has_unlimited"],
        "frontend_url": settings.FRONTEND_URL.rstrip("/"),
        "api_base_url": api_base,
        "profiles": [
            {
                "id": p.id,
                "label": (p.resume_info or {}).get("name") or p.source_filename or f"Profile #{p.id}",
                "source_filename": p.source_filename,
            }
            for p in profiles
        ],
    }


@router.get("/jobs/match")
async def match_job_by_url(
    url: str = Query(..., min_length=8),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Find a captured job that matches the active browser tab URL."""
    await require_pro_or_pass(
        db,
        current_user.id,
        feature="extension",
        message="Browser extension requires Job Hunt Pro or an active time pass.",
    )
    job, match_method = await find_job_by_page_url(db, current_user.id, url)
    if not job:
        raise NotFoundError("No matching job found for this page. Capture the JD first in Twerz.")
    jd = job.job_description or {}
    return {
        "job_id": job.id,
        "company": jd.get("company"),
        "role": jd.get("role"),
        "status": job.status.value,
        "fit_score": job.fit_score,
        "fit_label": job.fit_label,
        "application_status": job.application_status.value,
        "source_url": job_source_url(job),
        "ready_to_apply": job.status in (JobStatus.READY, JobStatus.RESUME_GENERATED)
        and bool(job.custom_resume_data),
        "match_method": match_method or "url",
        "requires_override": job.fit_label in LOW_FIT_LABELS,
        "low_fit_confirmed": bool(job.low_fit_confirmed),
    }


@router.get("/jobs/recent")
async def recent_jobs(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recent captured jobs for manual picker when URL match fails."""
    await require_pro_or_pass(
        db,
        current_user.id,
        feature="extension",
        message="Browser extension requires Job Hunt Pro or an active time pass.",
    )
    result = await db.execute(
        select(Job)
        .where(Job.user_id == current_user.id)
        .order_by(Job.updated_at.desc())
        .limit(limit)
    )
    items = []
    for job in result.scalars().all():
        jd = job.job_description or {}
        status_payload = _job_extension_status(job)
        items.append({
            "job_id": job.id,
            "company": jd.get("company"),
            "role": jd.get("role"),
            "fit_score": job.fit_score,
            "fit_label": job.fit_label,
            "phase": status_payload["phase"],
            "ready_to_apply": status_payload["ready_to_apply"],
            "source_url": job_source_url(job),
        })
    return {"items": items}


@router.get("/jobs/{job_id}/status")
async def extension_job_status(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lightweight status for extension badge polling after capture."""
    await require_pro_or_pass(
        db,
        current_user.id,
        feature="extension",
        message="Browser extension requires Job Hunt Pro or an active time pass.",
    )
    job = await job_service.get_job(db, job_id, current_user.id)
    return await _extension_status_for_job(job, current_user.id, db)


@router.post("/jobs/{job_id}/analyze-fit", status_code=200)
async def extension_analyze_fit(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Free fit analysis for extension capture flow."""
    await require_pro_or_pass(
        db,
        current_user.id,
        feature="extension",
        message="Browser extension requires Job Hunt Pro or an active time pass.",
    )
    await job_service.analyze_fit(db, job_id, current_user.id)
    job = await job_service.get_job(db, job_id, current_user.id)
    return await _extension_status_for_job(job, current_user.id, db)


@router.post("/jobs/{job_id}/generate-resume", status_code=202)
async def extension_generate_resume(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    payload: GenerateResumeExtensionRequest = Body(default_factory=GenerateResumeExtensionRequest),
):
    """Generate tailored resume from extension (same credit rules as dashboard)."""
    await require_pro_or_pass(
        db,
        current_user.id,
        feature="extension",
        message="Browser extension requires Job Hunt Pro or an active time pass.",
    )
    try:
        job = await _run_generate_resume(job_id, current_user.id, payload.confirm_low_fit)
    except UsageLimitExceeded:
        raise
    except ValueError as exc:
        raise BadRequestError(str(exc)) from exc
    status_payload = await _extension_status_for_job(job, current_user.id, db)
    return {**status_payload, "status": job.status.value}


@router.patch("/jobs/{job_id}/confirm-low-fit")
async def extension_confirm_low_fit(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Persist low-fit override for extension popup and Apply Assist sidebar."""
    await require_pro_or_pass(
        db,
        current_user.id,
        feature="extension",
        message="Browser extension requires Job Hunt Pro or an active time pass.",
    )
    job = await job_service.get_job(db, job_id, current_user.id)
    if job.fit_label not in LOW_FIT_LABELS:
        raise BadRequestError("Job does not require a low-fit override.")
    job.low_fit_confirmed = True
    await db.commit()
    await db.refresh(job)
    return await _extension_status_for_job(job, current_user.id, db)


@router.get("/jobs/{job_id}/apply-context")
async def get_apply_context(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fit gate + tailored assets for Apply Assist sidebar."""
    await require_pro_or_pass(
        db,
        current_user.id,
        feature="extension",
        message="Browser extension requires Job Hunt Pro or an active time pass.",
    )
    job = await job_service.get_job(db, job_id, current_user.id)
    if not job.custom_resume_data:
        raise NotFoundError("Tailored resume not ready. Generate a resume in the dashboard first.")
    if job.status not in (JobStatus.READY, JobStatus.RESUME_GENERATED):
        raise NotFoundError(f"Resume is not ready yet (status: {job.status.value}).")

    settings = get_settings()
    api_base = (settings.API_BASE_URL or "").rstrip("/")
    pdf_path = f"/jobs/{job_id}/pdf"
    jd = job.job_description or {}
    listing_risk = assess_listing_risk(job)

    return {
        "job_id": job.id,
        "company": jd.get("company"),
        "role": jd.get("role"),
        "status": job.status.value,
        "fit_score": job.fit_score,
        "fit_label": job.fit_label,
        "fit_rationale": job.fit_rationale,
        "is_mismatch": job.fit_label == "MISMATCH",
        "is_stretch": job.fit_label == "STRETCH",
        "requires_override": job.fit_label in LOW_FIT_LABELS,
        "low_fit_confirmed": bool(job.low_fit_confirmed),
        "cover_letter": job.cover_letter,
        "outreach_available": bool(job.evidence_map),
        "pdf_download_path": pdf_path,
        "pdf_download_url": f"{api_base}{pdf_path}" if api_base else pdf_path,
        "application_status": job.application_status.value,
        "applied_via": job.applied_via,
        "source_url": job_source_url(job),
        "dashboard_url": f"/dashboard/jobs/{job.id}",
        "rate_nudge": "Best results: 3–5 thoughtful applications per day.",
        "listing_risk": listing_risk,
    }


@router.post("/jobs/{job_id}/form-answers")
async def get_form_answers(
    job_id: int,
    payload: FormAnswersRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Evidence-grounded answers for scraped application form fields."""
    await require_pro_or_pass(
        db,
        current_user.id,
        feature="extension",
        message="Browser extension requires Job Hunt Pro or an active time pass.",
    )
    job = await job_service.get_job(db, job_id, current_user.id)
    if not job.custom_resume_data:
        raise NotFoundError("Tailored resume required before form answers can be generated.")
    confirmed = payload.confirm_low_fit or job.low_fit_confirmed
    if job.fit_label in LOW_FIT_LABELS and not confirmed:
        raise BadRequestError(
            f"Fit is {job.fit_label}. Set confirm_low_fit=true to fill application forms anyway."
        )
    return build_form_answers(
        job,
        [q.model_dump() for q in payload.questions],
        allow_eeoc=payload.allow_eeoc,
    )


@router.post("/capture-job", status_code=201)
async def capture_job(
    payload: ExtensionCapturePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a job from a browser-extension JD capture (does not auto-generate)."""
    await require_pro_or_pass(
        db,
        current_user.id,
        feature="extension",
        message="Browser extension capture requires Job Hunt Pro or an active time pass.",
    )

    has_credits = await credit_service.has_credits_available(db, current_user.id)
    if not has_credits:
        raise UsageLimitExceeded(
            "No credits available. Purchase credits or wait for daily free credits to reset."
        )

    jd_dict = JobDescription(
        company=payload.company,
        role=payload.role,
        description=payload.description.strip(),
        source_url=payload.source_url.strip() if payload.source_url else None,
    )

    job = await job_service.create_job(
        db,
        current_user.id,
        payload.profile_id,
        jd_dict,
    )
    return {
        "job_id": job.id,
        "status": job.status.value,
        "open_url": f"/dashboard/jobs/{job.id}",
        "message": "Job captured. Analyze fit in the extension or dashboard.",
    }


@router.post("/events", status_code=204)
async def extension_event(
    payload: ExtensionEventPayload,
    current_user: User = Depends(get_current_user),
):
    """Lightweight funnel telemetry from the browser extension."""
    if payload.event not in ALLOWED_EXTENSION_EVENTS:
        raise BadRequestError(f"Unknown extension event: {payload.event}")
    logger.info(
        "extension_event user=%s event=%s job_id=%s meta=%s",
        current_user.id,
        payload.event,
        payload.job_id,
        payload.meta or {},
    )
    return Response(status_code=204)


@router.get("/ping")
async def extension_ping(current_user: User = Depends(get_current_user)):
    return {"ok": True, "user_id": current_user.id, "email": current_user.email}
