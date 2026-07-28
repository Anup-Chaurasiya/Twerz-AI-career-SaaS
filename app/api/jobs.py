import asyncio
import math
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.background import create_tracked_task
from app.models.job import JobStatus
from app.models.user import User
from app.dependencies import get_current_user
from app.services.job.service import JobService, PDF_DIR
from app.services.job.tailor_pipeline import (
    LOW_FIT_LABELS,
    evidence_counts_from_map,
    fit_score_breakdown_from_stored,
)
from app.services.credit.service import CreditService
from app.schemas.job import JobCreate
from logging import getLogger

logger = getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])
service = JobService()
credit_service = CreditService()


class GenerateResumeRequest(BaseModel):
    confirm_low_fit: bool = Field(
        default=False,
        description="Required true when fit_label is STRETCH or MISMATCH",
    )


def _pdf_filename(job) -> str:
    """Build a descriptive PDF filename from job data."""
    jd = job.job_description or {}
    cr = job.custom_resume_data or {}
    name = cr.get("name", "")
    role = jd.get("role", "")
    company = jd.get("company", "")
    if name and role and company:
        filename = f"{name} - {role} ({company}).pdf"
    elif role and company:
        filename = f"{role} ({company}).pdf"
    else:
        filename = f"resume_{job.id}.pdf"
    for ch in '/\\?%*:|"<>':
        filename = filename.replace(ch, "")
    return filename


@router.get("", include_in_schema=False)
@router.get("/")
async def list_jobs(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List user's jobs with pagination.
    
    Returns empty state information to help frontend show
    appropriate guidance for users with no job applications yet.
    """
    offset = (page - 1) * limit
    jobs, total = await service.get_jobs(db, current_user.id, offset=offset, limit=limit)
    return {
        "items": [
            {
                "id": j.id,
                "profile_id": j.profile_id,
                "job_description": j.job_description,
                "candidate_name": (j.custom_resume_data or {}).get("name"),
                "status": j.status.value,
                "fit_score": j.fit_score,
                "fit_label": j.fit_label,
                "ats_score_after": j.ats_score_after,
                "evidence_counts": evidence_counts_from_map(j.evidence_map),
                "application_status": j.application_status.value if j.application_status else "SAVED",
                "applied_via": j.applied_via,
                "follow_up_at": j.follow_up_at.isoformat() if j.follow_up_at else None,
                "created_at": j.created_at.isoformat(),
                "updated_at": j.updated_at.isoformat(),
            }
            for j in jobs
        ],
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if total > 0 else 1,
        "limit": limit,
        "is_empty": total == 0,  # Frontend can use this for empty state
    }


@router.post("", status_code=201, include_in_schema=False)
@router.post("/", status_code=201)
async def create_job(
    payload: JobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Pre-check credits before creating the job — don't leave dead PENDING jobs
    has_credits = await credit_service.has_credits_available(db, current_user.id)
    if not has_credits:
        from app.exceptions import UsageLimitExceeded
        raise UsageLimitExceeded("No credits available. Purchase credits or wait for daily free credits to reset.")
    job = await service.create_job(db, current_user.id, payload.profile_id, payload.job_description)
    return {"job_id": job.id, "status": job.status.value}


@router.post("/{job_id}/generate-resume", status_code=202)
async def generate_resume(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    payload: GenerateResumeRequest = Body(default_factory=GenerateResumeRequest),
):
    # SELECT FOR UPDATE prevents double-charge race: second concurrent request
    # blocks here until the first commits GENERATING_RESUME, then fails the guard.
    job = await service.get_job(db, job_id, current_user.id, for_update=True)

    # Guard: only allow generation from PENDING or FAILED states
    if job.status.value not in ("PENDING", "FAILED"):
        raise ValueError(
            f"Job is already {job.status.value} — cannot re-generate"
        )

    # Free analyze-fit if not yet run, then gate low-fit before charging
    if job.fit_score is None or not job.fit_label:
        job = await service.analyze_fit(db, job_id, current_user.id)
        # Re-lock after analyze commit
        job = await service.get_job(db, job_id, current_user.id, for_update=True)
        if job.status.value not in ("PENDING", "FAILED"):
            raise ValueError(
                f"Job is already {job.status.value} — cannot re-generate"
            )

    if job.fit_label in LOW_FIT_LABELS and not payload.confirm_low_fit and not job.low_fit_confirmed:
        raise ValueError(
            f"Fit is {job.fit_label} — set confirm_low_fit=true to generate anyway, "
            "or skip to avoid spending a credit."
        )

    if payload.confirm_low_fit and job.fit_label in LOW_FIT_LABELS:
        job.low_fit_confirmed = True

    # Deduct credit synchronously — raises 429 if no credits available
    source = await credit_service.check_and_deduct(db, current_user.id, job_id)

    # Update status synchronously to prevent double-charge on rapid re-calls
    job.status = JobStatus.GENERATING_RESUME
    await db.commit()

    from app.database.session import async_session_factory

    user_id = current_user.id

    async def _generate():
        async with async_session_factory() as bg_db:
            phase1_succeeded = False
            try:
                await service.generate_custom_resume(bg_db, job_id, user_id)
                phase1_succeeded = True
                # Auto-chain: if Phase 1 succeeded, immediately run Phase 2
                job = await service.get_job(bg_db, job_id, user_id)
                if job.status.value == "RESUME_GENERATED":
                    await service.generate_pdf(bg_db, job_id, user_id)
            except Exception:
                logger.exception(f"Background generation failed for job {job_id}")
                # Only refund if Phase 1 (AI) failed — if Phase 1 succeeded
                # the user already has their tailored resume and can retry PDF for free.
                if not phase1_succeeded and source != "time_pass":
                    try:
                        await credit_service.refund_credit(bg_db, user_id, job_id, source)
                        logger.info(f"Refunded credit for failed job {job_id}")
                    except Exception:
                        logger.exception(f"Failed to refund credit for job {job_id}")

    create_tracked_task(_generate())
    return {"job_id": job_id, "status": "GENERATING_RESUME"}


@router.post("/{job_id}/generate-pdf", status_code=202)
async def generate_pdf(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate or recompile PDF from existing resume data.
    
    This endpoint is FREE when custom_resume_data already exists (recompilation).
    Only the initial resume generation (via /generate-resume) costs a credit.
    
    Use cases:
    - Recompile after chat edits to resume content
    - Recompile after direct manual JSON edits
    - Retry PDF generation if it failed (LaTeX error, GCS upload failure, etc.)
    """
    job = await service.get_job(db, job_id, current_user.id)

    # Guard: only allow PDF generation from RESUME_GENERATED or READY states
    # Note: READY state recompile is for when user edits via chat or manual JSON
    if job.status.value not in ("RESUME_GENERATED", "READY", "FAILED"):
        raise ValueError(
            f"Job is {job.status.value} — PDF generation requires RESUME_GENERATED or READY state"
        )
    
    # Verify custom_resume_data exists (should always be true if status is RESUME_GENERATED or READY)
    if not job.custom_resume_data:
        raise ValueError(
            "No resume data found. Please generate the resume first via POST /jobs/{job_id}/generate-resume"
        )

    from app.database.session import async_session_factory

    user_id = current_user.id

    async def _generate():
        async with async_session_factory() as bg_db:
            # recompile=True prevents setting status to FAILED on error
            # (preserves previous PDF and READY status)
            await service.generate_pdf(bg_db, job_id, user_id, recompile=True)

    create_tracked_task(_generate())
    return {"job_id": job_id, "status": "GENERATING_PDF"}


@router.get("/{job_id}")
async def get_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.profile import Profile

    job = await service.get_job(db, job_id, current_user.id)
    profile = await db.get(Profile, job.profile_id)
    return {
        "id": job.id,
        "profile_id": job.profile_id,
        "job_description": job.job_description,
        "custom_resume_data": job.custom_resume_data,
        "status": job.status.value,
        "gcs_upload_failed": job.gcs_upload_failed,
        "pdf_error_log": job.pdf_error_log,
        "pdf_verified_readable": job.pdf_verified_readable,
        "jd_analysis": job.jd_analysis,
        "evidence_map": job.evidence_map,
        "fit_score": job.fit_score,
        "fit_label": job.fit_label,
        "fit_rationale": job.fit_rationale,
        "fit_score_breakdown": fit_score_breakdown_from_stored(job.jd_analysis, job.evidence_map),
        "evidence_counts": evidence_counts_from_map(job.evidence_map),
        "gap_list": job.gap_list or [],
        "gap_roadmap": job.gap_roadmap,
        "resume_plan": job.resume_plan,
        "recruiter_review": job.recruiter_review,
        "ats_score_before": job.ats_score_before,
        "ats_score_after": job.ats_score_after,
        "ats_score_detail": job.ats_score_detail,
        "bullet_diff": job.bullet_diff,
        "template_id": job.template_id or "classic",
        "docx_source": job.docx_source,
        "pdf_source": job.pdf_source,
        "output_mode": job.output_mode or "preserve_original",
        "suggested_template_id": job.template_id or "classic",
        "source_format": profile.source_format if profile else None,
        "preservation_eligible": profile.preservation_eligible if profile else None,
        "layout_signals": profile.layout_signals if profile else None,
        "resume_versions": [
            {"version": v.get("version"), "label": v.get("label"), "template_id": v.get("template_id")}
            for v in (job.resume_versions or [])
        ],
        "cover_letter": job.cover_letter,
        "interview_packet": job.interview_packet,
        "known_contacts": job.known_contacts or [],
        "applied_via": job.applied_via,
        "application_status": job.application_status.value if job.application_status else "SAVED",
        "applied_at": job.applied_at.isoformat() if job.applied_at else None,
        "follow_up_at": job.follow_up_at.isoformat() if job.follow_up_at else None,
        "application_notes": job.application_notes,
        "created_at": job.created_at.isoformat(),
        "updated_at": job.updated_at.isoformat(),
    }


@router.post("/{job_id}/analyze-fit", status_code=200)
async def analyze_fit(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Free pre-generate fit analysis (does not deduct credits)."""
    job = await service.analyze_fit(db, job_id, current_user.id)
    return {
        "job_id": job.id,
        "fit_score": job.fit_score,
        "fit_label": job.fit_label,
        "fit_rationale": job.fit_rationale,
        "fit_score_breakdown": fit_score_breakdown_from_stored(job.jd_analysis, job.evidence_map),
        "evidence_counts": evidence_counts_from_map(job.evidence_map),
        "gap_list": job.gap_list or [],
        "gap_roadmap": job.gap_roadmap,
        "jd_analysis": job.jd_analysis,
        "evidence_map": job.evidence_map,
    }


@router.patch("/{job_id}/output-mode", status_code=202)
async def update_output_mode(
    job_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle between preserved original layout and house LaTeX template."""
    output_mode = payload.get("output_mode")
    if output_mode not in ("preserve_original", "house_template"):
        raise ValueError("output_mode must be preserve_original or house_template")

    job = await service.update_output_mode(db, job_id, current_user.id, output_mode)

    from app.database.session import async_session_factory

    user_id = current_user.id

    async def _recompile():
        async with async_session_factory() as bg_db:
            await service.generate_pdf(bg_db, job_id, user_id, recompile=True)

    if job.custom_resume_data:
        create_tracked_task(_recompile())

    return {"job_id": job_id, "output_mode": job.output_mode, "status": "GENERATING_PDF"}


@router.post("/{job_id}/fix-gaps", status_code=200)
async def fix_gaps(
    job_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    keywords = payload.get("keywords") or []
    if not isinstance(keywords, list) or not keywords:
        raise ValueError("keywords must be a non-empty list")
    job = await service.fix_keyword_gaps(db, job_id, current_user.id, keywords)
    return {
        "success": True,
        "custom_resume_data": job.custom_resume_data,
        "status": job.status.value,
        "resume_versions": [
            {"version": v.get("version"), "label": v.get("label"), "template_id": v.get("template_id")}
            for v in (job.resume_versions or [])
        ],
    }


@router.patch("/{job_id}/template", status_code=202)
async def update_template(
    job_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Switch resume template and recompile PDF for free (no credit charge)."""
    template_id = payload.get("template_id")
    if not template_id or not isinstance(template_id, str):
        raise ValueError("template_id is required")

    job = await service.update_template(db, job_id, current_user.id, template_id)

    from app.database.session import async_session_factory

    user_id = current_user.id

    async def _recompile():
        async with async_session_factory() as bg_db:
            await service.generate_pdf(bg_db, job_id, user_id, recompile=True)

    create_tracked_task(_recompile())
    return {"job_id": job_id, "template_id": job.template_id, "status": "GENERATING_PDF"}


@router.post("/{job_id}/restore-version", status_code=200)
async def restore_version(
    job_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    version = payload.get("version")
    if not isinstance(version, int):
        raise ValueError("version must be an integer")
    job = await service.restore_version(db, job_id, current_user.id, version)

    from app.database.session import async_session_factory

    user_id = current_user.id

    async def _recompile():
        async with async_session_factory() as bg_db:
            await service.generate_pdf(bg_db, job_id, user_id, recompile=True)

    if job.custom_resume_data:
        create_tracked_task(_recompile())

    return {
        "success": True,
        "custom_resume_data": job.custom_resume_data,
        "status": job.status.value,
        "template_id": job.template_id,
    }


@router.post("/{job_id}/cover-letter", status_code=200)
async def generate_cover_letter(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = await service.generate_cover_letter(db, job_id, current_user.id)
    return {"cover_letter": job.cover_letter}


@router.post("/{job_id}/interview-packet", status_code=200)
async def generate_interview_packet(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.credit.entitlements import require_pro_or_pass

    await require_pro_or_pass(
        db,
        current_user.id,
        feature="interview_packets",
        message="Interview packets require Job Hunt Pro or an active time pass.",
    )
    job = await service.generate_interview_packet(db, job_id, current_user.id)
    return {"interview_packet": job.interview_packet}


@router.patch("/{job_id}/application", status_code=200)
async def update_application(
    job_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime

    # None = leave unchanged; "" / null in JSON = clear; ISO string = set
    if "follow_up_at" not in payload:
        follow_up = None
    elif payload.get("follow_up_at") in (None, ""):
        follow_up = ""
    else:
        follow_up = datetime.fromisoformat(
            str(payload["follow_up_at"]).replace("Z", "+00:00")
        )
    job = await service.update_application_status(
        db,
        job_id,
        current_user.id,
        application_status=payload.get("application_status"),
        notes=payload.get("application_notes"),
        follow_up_at=follow_up,
        applied_via=payload.get("applied_via"),
    )
    return {
        "application_status": job.application_status.value,
        "applied_via": job.applied_via,
        "applied_at": job.applied_at.isoformat() if job.applied_at else None,
        "follow_up_at": job.follow_up_at.isoformat() if job.follow_up_at else None,
        "application_notes": job.application_notes,
    }


@router.post("/{job_id}/outreach-message", status_code=200)
async def generate_outreach_message(
    job_id: int,
    payload: dict = Body(default_factory=dict),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate an honest warm outreach or referral request message.

    outreach_type options: 'known_contact', 'cold_linkedin', 'referral_request'
    """
    outreach_type = payload.get("outreach_type", "known_contact")
    if outreach_type not in ("known_contact", "cold_linkedin", "referral_request"):
        raise ValueError("outreach_type must be one of: known_contact, cold_linkedin, referral_request")
    contact_info = payload.get("contact_info")
    message = await service.generate_outreach_message(
        db,
        job_id,
        current_user.id,
        contact_info=contact_info,
        outreach_type=outreach_type,
    )
    return {"outreach_message": message, "outreach_type": outreach_type}


@router.put("/{job_id}/contacts", status_code=200)
async def update_known_contacts(
    job_id: int,
    payload: list[dict] | dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update user-entered known contacts for a job application."""
    if isinstance(payload, dict):
        contacts = payload.get("known_contacts", [])
    else:
        contacts = payload
    if not isinstance(contacts, list):
        raise ValueError("contacts must be a list of contact objects")
    job = await service.update_known_contacts(db, job_id, current_user.id, contacts)
    return {"known_contacts": job.known_contacts, "job_id": job.id}


@router.get("/{job_id}/docx")
async def download_docx(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.latex.docx_builder import build_docx_bytes
    from app.exceptions import NotFoundError
    from pathlib import Path

    job = await service.get_job(db, job_id, current_user.id)
    if not job.custom_resume_data:
        raise NotFoundError("No tailored resume data available")

    docx_source = "generated"
    if job.preserved_docx_path and Path(job.preserved_docx_path).exists():
        docx_bytes = await asyncio.to_thread(Path(job.preserved_docx_path).read_bytes)
        docx_source = "preserved"
    else:
        docx_bytes = build_docx_bytes(job.custom_resume_data)
        if job.docx_source == "fallback":
            docx_source = "fallback"

    jd = job.job_description or {}
    filename = f"Resume_{(jd.get('role') or 'tailored').replace(' ', '_')}.docx"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Docx-Source": docx_source,
        },
    )


@router.get("/{job_id}/status")
async def get_job_status(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = await service.get_job(db, job_id, current_user.id)
    return {
        "id": job.id,
        "status": job.status.value,
        "fit_score": job.fit_score,
        "fit_label": job.fit_label,
        "ats_score_after": job.ats_score_after,
    }


@router.get("/{job_id}/pdf")
async def download_pdf(
    job_id: int,
    inline: bool = Query(False),
    force_house: bool = Query(False, description="Force house LaTeX PDF instead of preserved layout"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a job's PDF resume (preserved original layout or house LaTeX template)."""
    from app.exceptions import NotFoundError

    job = await service.get_job(db, job_id, current_user.id)

    try:
        pdf_bytes, pdf_source = await service.get_pdf(
            db, job_id, current_user.id, force_house=force_house
        )
    except ValueError:
        can_recompile = job.status.value in ("RESUME_GENERATED", "READY") and job.custom_resume_data
        raise NotFoundError(
            "PDF not available. This can happen if our servers restarted. "
            + ("You can recompile your PDF for free." if can_recompile else "Please regenerate your resume.")
        )

    filename = _pdf_filename(job)
    ascii_filename = filename.encode("ascii", "replace").decode("ascii")
    encoded_filename = quote(filename)
    disposition = "inline" if inline else "attachment"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'{disposition}; filename="{ascii_filename}"; '
                f"filename*=UTF-8''{encoded_filename}"
            ),
            "X-Pdf-Source": pdf_source,
        },
    )


@router.put("/{job_id}/custom-resume")
async def update_custom_resume(
    job_id: int,
    custom_resume_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Direct edit endpoint for custom_resume_data.
    Allows users to manually edit the tailored resume JSON.
    """
    from app.schemas.custom_resume import CustomResumeInfo
    from app.exceptions import BadRequestError, ForbiddenError
    from pydantic import ValidationError
    
    # Get job and verify ownership
    job = await service.get_job(db, job_id, current_user.id)
    
    # Only allow editing in RESUME_GENERATED or READY states
    if job.status.value not in ("RESUME_GENERATED", "READY"):
        raise BadRequestError(
            f"Cannot edit while resume is being generated. Current status: {job.status.value}"
        )
    
    # Validate the custom resume data against schema
    try:
        validated_data = CustomResumeInfo(**custom_resume_data)
    except ValidationError as e:
        raise BadRequestError(f"Invalid resume data: {e.errors()}")

    job = await service.update_custom_resume(
        db, job_id, current_user.id, validated_data.model_dump()
    )

    return {
        "success": True,
        "job": {
            "id": job.id,
            "status": job.status.value,
            "custom_resume_data": job.custom_resume_data,
            "template_id": job.template_id,
            "updated_at": job.updated_at.isoformat(),
        }
    }
