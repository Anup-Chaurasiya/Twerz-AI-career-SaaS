"""Public Growth Engine API — Phase 5: Organic acquisition + peer referral.

Endpoints:
- POST /public/ats-check — No-auth, rate-limited public ATS score check.
- GET /public/stats — Anonymized, aggregated success wall statistics for the landing page.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database.session import get_db
from app.models.job import Job, JobStatus
from app.models.roast import Roast, RoastStatus
from app.schemas.roast import RoastResult
from app.services.ai.inference import LLMInference
from app.services.ai.prompts import ROAST_SYSTEM_PROMPT
from app.services.ocr.extractor import PDFExtractor

router = APIRouter(prefix="/public", tags=["public"])


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
