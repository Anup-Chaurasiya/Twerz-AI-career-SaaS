"""Browser extension helper: capture JD from LinkedIn/Naukri/Indeed pages."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.job import JobDescription
from app.services.job.service import JobService
from app.services.credit.service import CreditService
from app.services.credit.entitlements import require_pro_or_pass
from app.exceptions import UsageLimitExceeded

router = APIRouter(prefix="/extension", tags=["extension"])
job_service = JobService()
credit_service = CreditService()


class ExtensionCapturePayload(BaseModel):
    profile_id: int
    company: str = Field(..., min_length=1)
    role: str = Field(..., min_length=1)
    description: str = Field(..., min_length=20)
    source_url: str | None = None


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

    desc = payload.description
    if payload.source_url:
        desc = f"{desc}\n\nSource: {payload.source_url}"

    job = await job_service.create_job(
        db,
        current_user.id,
        payload.profile_id,
        JobDescription(
            company=payload.company,
            role=payload.role,
            description=desc,
        ),
    )
    return {
        "job_id": job.id,
        "status": job.status.value,
        "open_url": f"/dashboard/jobs/{job.id}",
        "message": "Job captured. Open in ATS Beater to analyze fit and generate.",
    }


@router.get("/ping")
async def extension_ping(current_user: User = Depends(get_current_user)):
    return {"ok": True, "user_id": current_user.id, "email": current_user.email}
