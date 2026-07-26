"""Public Growth Engine API — Phase 5: Organic acquisition + peer referral.

Endpoints:
- POST /public/ats-check — No-auth, rate-limited public ATS score check.
- POST /public/profile-upload — No-auth guest resume upload with AI structuring.
- GET /public/profiles/{id}/status — Guest token status polling.
- GET /public/profiles/{id}/preview — Guest token teaser preview.
- GET /public/stats — Anonymized, aggregated success wall statistics for the landing page.
"""

from __future__ import annotations

import asyncio
from logging import getLogger

from fastapi import APIRouter, Depends, File, Header, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.background import create_tracked_task
from app.config import get_settings
from app.database.session import async_session_factory, get_db
from app.models.job import Job, JobStatus
from app.models.roast import Roast, RoastStatus
from app.schemas.roast import RoastResult
from app.services.ai.inference import LLMInference
from app.services.ai.prompts import ROAST_SYSTEM_PROMPT
from app.services.auth.jwt_handler import create_guest_token
from app.services.ocr.extractor import PDFExtractor, detect_resume_format
from app.services.profile.service import ProfileService
from app.services.storage.gcs import GCSClient
from app.utils.client_ip import client_ip
from sqlalchemy import select, func

logger = getLogger(__name__)

router = APIRouter(prefix="/public", tags=["public"])
profile_service = ProfileService()


def _validate_public_resume(file: UploadFile, file_bytes: bytes) -> None:
    settings = get_settings()
    if not file.filename:
        raise ValueError("Only PDF and DOCX files are supported")
    try:
        detect_resume_format(file.filename, file_bytes)
    except ValueError as exc:
        raise ValueError(str(exc)) from exc
    if not file_bytes or len(file_bytes) < 100:
        raise ValueError("Uploaded file is empty or corrupted")
    if len(file_bytes) > settings.PUBLIC_UPLOAD_MAX_BYTES:
        raise ValueError(
            f"File too large. Maximum size is {settings.PUBLIC_UPLOAD_MAX_BYTES // 1_000_000}MB."
        )


async def _spawn_profile_processing(
    profile_id: int,
    pdf_bytes: bytes,
    extracted_text: str,
    *,
    gcs_path: str,
) -> None:
    async def _process():
        async with async_session_factory() as bg_db:
            await profile_service.process_profile(
                bg_db, profile_id, pdf_bytes, extracted_text=extracted_text
            )

    create_tracked_task(_process())

    async def _store_pdf():
        try:
            gcs = GCSClient()
            await asyncio.to_thread(gcs.upload_pdf, pdf_bytes, gcs_path)
        except FileNotFoundError:
            logger.debug("Skipping GCS upload for guest profile %s (credentials not configured)", profile_id)
        except Exception:
            logger.warning("Failed to store guest PDF for profile %s", profile_id, exc_info=True)

    create_tracked_task(_store_pdf())


@router.post("/ats-check")
async def public_ats_check(
    file: UploadFile = File(...),
):
    """Public, no-auth ATS structure check. Rate limited by IP via middleware."""
    settings = get_settings()

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise ValueError("Only PDF files are supported for public ATS check")

    pdf_bytes = await file.read()
    if not pdf_bytes or len(pdf_bytes) < 100:
        raise ValueError("Uploaded PDF file is empty or corrupted")
    if len(pdf_bytes) > settings.PUBLIC_UPLOAD_MAX_BYTES:
        raise ValueError(
            f"PDF too large. Maximum size is {settings.PUBLIC_UPLOAD_MAX_BYTES // 1_000_000}MB."
        )

    extractor = PDFExtractor()
    ocr_result = extractor.extract(pdf_bytes)

    llm = LLMInference()
    prompt = (
        "Analyze this resume for the 8-point ATS checklist.\n\n"
        f"<ocr_extracted_text>\n{ocr_result.text[:4000]}\n</ocr_extracted_text>"
    )

    raw = await llm.run_inference(
        system_prompt=ROAST_SYSTEM_PROMPT,
        inputs=[prompt],
        structured_output_schema=RoastResult,
        purpose="public_ats_check",
    )
    result = RoastResult.model_validate(raw)

    checklist = [item.model_dump(mode="json") for item in result.ats_checklist]
    passed_count = sum(1 for c in checklist if c.get("passed"))

    return {
        "ats_checklist": checklist,
        "passed_count": passed_count,
        "total_checks": len(checklist),
        "score_estimate": int((passed_count / len(checklist)) * 100) if checklist else 0,
        "cta": "Sign up for ATS Beater to tailor your resume for specific job descriptions and boost your interview rate by up to 3x!",
    }


@router.post("/profile-upload", status_code=202)
async def public_profile_upload(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """No-auth guest resume upload — full AI structuring, claimable after sign-in."""
    file_bytes = await file.read()
    _validate_public_resume(file, file_bytes)

    ip = client_ip(request)
    await profile_service.enforce_guest_upload_limits(db, ip)

    profile_id = await profile_service.create_guest_profile(
        db,
        file_bytes,
        guest_ip=ip,
        source_filename=file.filename,
    )
    guest_token = create_guest_token(profile_id)
    extracted_text = await profile_service.extract_text_fast(
        file_bytes, source_filename=file.filename
    )

    settings = get_settings()
    ext = detect_resume_format(file.filename, file_bytes)
    await _spawn_profile_processing(
        profile_id,
        file_bytes,
        extracted_text,
        gcs_path=f"uploads/guest/{profile_id}.{ext}",
    )

    return {
        "profile_id": profile_id,
        "guest_token": guest_token,
        "status": "PENDING",
        "extracted_text": extracted_text,
        "expires_in_hours": settings.GUEST_PROFILE_TTL_HOURS,
    }


@router.get("/profiles/{profile_id}/status")
async def public_guest_profile_status(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    x_guest_token: str = Header(..., alias="X-Guest-Token"),
):
    profile = await profile_service.get_guest_profile_by_token(db, profile_id, x_guest_token)
    return {"id": profile.id, "status": profile.status.value}


@router.get("/profiles/{profile_id}/preview")
async def public_guest_profile_preview(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    x_guest_token: str = Header(..., alias="X-Guest-Token"),
):
    return await profile_service.get_guest_preview(db, profile_id, x_guest_token)


@router.get("/stats")
async def public_success_wall_stats(
    db: AsyncSession = Depends(get_db),
):
    """Anonymized aggregate counts for the landing page success wall."""
    total_tailored = (
        await db.execute(select(func.count(Job.id)).where(Job.status == JobStatus.READY))
    ).scalar() or 0

    total_roasts = (
        await db.execute(select(func.count(Roast.id)).where(Roast.status == RoastStatus.READY))
    ).scalar() or 0

    avg_imp = (
        await db.execute(
            select(func.avg(Job.ats_score_after - Job.ats_score_before)).where(
                Job.ats_score_after.isnot(None),
                Job.ats_score_before.isnot(None),
                Job.status == JobStatus.READY,
            )
        )
    ).scalar()

    avg_improvement = round(float(avg_imp), 1) if avg_imp is not None else None

    return {
        "total_resumes_tailored": total_tailored,
        "total_roasts_completed": total_roasts,
        "avg_ats_score_improvement": avg_improvement,
        "has_improvement_data": avg_imp is not None,
    }
