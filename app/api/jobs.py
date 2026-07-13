import asyncio
import math
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.background import create_tracked_task
from app.models.job import JobStatus
from app.models.user import User
from app.dependencies import get_current_user
from app.services.job.service import JobService, PDF_DIR
from app.services.credit.service import CreditService
from app.schemas.job import JobCreate
from logging import getLogger

logger = getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])
service = JobService()
credit_service = CreditService()


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
):
    # SELECT FOR UPDATE prevents double-charge race: second concurrent request
    # blocks here until the first commits GENERATING_RESUME, then fails the guard.
    job = await service.get_job(db, job_id, current_user.id, for_update=True)

    # Guard: only allow generation from PENDING or FAILED states
    if job.status.value not in ("PENDING", "FAILED"):
        raise ValueError(
            f"Job is already {job.status.value} — cannot re-generate"
        )

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
    job = await service.get_job(db, job_id, current_user.id)
    return {
        "id": job.id,
        "profile_id": job.profile_id,
        "job_description": job.job_description,
        "custom_resume_data": job.custom_resume_data,
        "status": job.status.value,
        "gcs_upload_failed": job.gcs_upload_failed,
        "pdf_error_log": job.pdf_error_log,
        "created_at": job.created_at.isoformat(),
        "updated_at": job.updated_at.isoformat(),
    }


@router.get("/{job_id}/status")
async def get_job_status(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = await service.get_job(db, job_id, current_user.id)
    return {"id": job.id, "status": job.status.value}


@router.get("/{job_id}/pdf")
async def download_pdf(
    job_id: int,
    inline: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a job's PDF resume.
    
    Priority order:
    1. If PDF is in GCS → redirect to signed URL (1 hour expiry)
    2. If PDF exists locally → stream it directly
    3. If neither available → return 404 with recompile option
    
    Signed URLs are preferred for GCS-stored PDFs because:
    - They survive Cloud Run container restarts
    - They offload bandwidth from our servers
    - They provide temporary secure access without auth
    """
    from app.services.storage.gcs import GCSClient
    from fastapi.responses import RedirectResponse
    from app.exceptions import NotFoundError
    
    job = await service.get_job(db, job_id, current_user.id)
    
    # Priority 1: Try GCS with signed URL (best for production)
    if job.pdf_gcs_path and not job.gcs_upload_failed:
        # Path should be relative like "resumes/user_id/job_id.pdf"
        if not job.pdf_gcs_path.startswith("/"):
            try:
                gcs = GCSClient()
                # Generate 1-hour signed URL
                signed_url = await asyncio.to_thread(
                    gcs.generate_signed_url, job.pdf_gcs_path, expiration_seconds=3600
                )
                logger.info(f"[job:{job_id}] Redirecting to signed GCS URL (expires in 1h)")
                return RedirectResponse(url=signed_url)
            except Exception as e:
                logger.warning(f"[job:{job_id}] Failed to generate signed URL, falling back to local: {e}")
    
    # Priority 2: Try local file (fallback for dev or if GCS failed)
    local_candidates = []
    if job.pdf_gcs_path and job.pdf_gcs_path.startswith("/"):
        local_candidates.append(Path(job.pdf_gcs_path))
    # Also check known temp path
    local_candidates.append(PDF_DIR / f"{current_user.id}_{job_id}.pdf")
    
    for local_path in local_candidates:
        if await asyncio.to_thread(local_path.exists):
            pdf_bytes = await asyncio.to_thread(local_path.read_bytes)
            filename = _pdf_filename(job)
            ascii_filename = filename.encode("ascii", "replace").decode("ascii")
            encoded_filename = quote(filename)
            disposition = "inline" if inline else "attachment"
            logger.info(f"[job:{job_id}] Serving PDF from local file: {local_path}")
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": (
                        f'{disposition}; filename="{ascii_filename}"; '
                        f"filename*=UTF-8''{encoded_filename}"
                    )
                },
            )
    
    # Priority 3: PDF not available anywhere
    # This can happen if Cloud Run container restarted and GCS upload failed
    can_recompile = job.status.value in ("RESUME_GENERATED", "READY") and job.custom_resume_data
    
    raise NotFoundError(
        "PDF not available. This can happen if our servers restarted. "
        + ("You can recompile your PDF for free." if can_recompile else "Please regenerate your resume.")
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
    
    # Update the job
    job.custom_resume_data = validated_data.model_dump()
    
    # PDF is now outdated, set status back to RESUME_GENERATED
    if job.status == JobStatus.READY:
        job.status = JobStatus.RESUME_GENERATED
    
    await db.commit()
    await db.refresh(job)
    
    return {
        "success": True,
        "job": {
            "id": job.id,
            "status": job.status.value,
            "custom_resume_data": job.custom_resume_data,
            "updated_at": job.updated_at.isoformat(),
        }
    }
