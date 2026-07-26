import asyncio
import math
from logging import getLogger
from fastapi import APIRouter, Depends, UploadFile, File, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.background import create_tracked_task
from app.models.user import User
from app.dependencies import get_current_user
from app.services.profile.service import ProfileService
from app.services.storage.gcs import GCSClient
from app.schemas.profile import UpsertPayload

logger = getLogger(__name__)

router = APIRouter(prefix="/profiles", tags=["profiles"])
service = ProfileService()


@router.post("/upload", status_code=202)
async def upload_profile(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pdf_bytes = await file.read()
    profile_id = await service.create_profile(
        db, current_user.id, pdf_bytes, source_filename=file.filename
    )

    # Fast-path: extract text immediately (pdfplumber/docx is near-instant)
    # so the frontend can animate through the content while AI structures in background
    extracted_text = await service.extract_text_fast(pdf_bytes, source_filename=file.filename)

    # Process in background — pass extracted text so it doesn't re-extract
    from app.database.session import async_session_factory

    async def _process():
        async with async_session_factory() as bg_db:
            await service.process_profile(bg_db, profile_id, pdf_bytes, extracted_text=extracted_text)

    create_tracked_task(_process())

    # Store uploaded PDF in GCS (fire-and-forget)
    async def _store_pdf():
        try:
            gcs = GCSClient()
            gcs_path = f"uploads/profiles/{current_user.id}/{profile_id}.pdf"
            await asyncio.to_thread(gcs.upload_pdf, pdf_bytes, gcs_path)
        except FileNotFoundError:
            logger.debug("Skipping GCS upload for profile %s (credentials not configured)", profile_id)
        except Exception:
            logger.warning(f"Failed to store uploaded PDF for profile {profile_id}", exc_info=True)

    create_tracked_task(_store_pdf())

    return {"profile_id": profile_id, "status": "PENDING", "extracted_text": extracted_text}


@router.get("", include_in_schema=False)
@router.get("/")
async def list_profiles(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List user's profiles with pagination.
    
    Returns empty state information to help frontend show
    appropriate onboarding guidance for new users.
    """
    offset = (page - 1) * limit
    profiles, total = await service.get_profiles(db, current_user.id, offset=offset, limit=limit)
    return {
        "items": [
            {
                "id": p.id,
                "status": p.status.value,
                "is_active": p.is_active,
                "source_filename": p.source_filename,
                "resume_info": p.resume_info,
                "created_at": p.created_at.isoformat(),
                "updated_at": p.updated_at.isoformat(),
            }
            for p in profiles
        ],
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if total > 0 else 1,
        "limit": limit,
        "is_empty": total == 0,  # Frontend can use this for empty state
    }


@router.get("/{profile_id}")
async def get_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = await service.get_profile(db, profile_id, current_user.id)
    return {
        "id": profile.id,
        "status": profile.status.value,
        "is_active": profile.is_active,
        "source_filename": profile.source_filename,
        "resume_info": profile.resume_info,
        "created_at": profile.created_at.isoformat(),
        "updated_at": profile.updated_at.isoformat(),
    }


@router.get("/{profile_id}/status")
async def get_profile_status(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = await service.get_profile(db, profile_id, current_user.id)
    return {"id": profile.id, "status": profile.status.value}


@router.put("/{profile_id}")
async def update_profile(
    profile_id: int,
    payload: UpsertPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = await service.update_resume_info(db, profile_id, current_user.id, payload.resume_info)
    return {"id": profile.id, "status": profile.status.value}


@router.post("/{profile_id}/enhance")
async def enhance_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = await service.enhance_profile(db, profile_id, current_user.id)
    return {"id": profile.id, "resume_info": profile.resume_info}


@router.post("/{profile_id}/linkedin-optimize")
async def linkedin_optimize(
    profile_id: int,
    payload: dict = Body(default_factory=dict),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate LinkedIn headline, About text, and skills list for a profile.

    Optionally accepts `target_jd` in body JSON to angle optimization toward a target role.
    """
    target_jd = payload.get("target_jd")
    result = await service.linkedin_optimize(
        db, profile_id, current_user.id, target_jd=target_jd
    )
    return result



@router.delete("/{profile_id}")
async def delete_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await service.deactivate_profile(db, profile_id, current_user.id)
    return {"detail": "Profile deactivated"}
