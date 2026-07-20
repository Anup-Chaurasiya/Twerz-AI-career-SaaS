import asyncio
import json
import time
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.profile import Profile, ProfileStatus
from app.schemas.resume import ResumeInfo
from app.services.ocr.extractor import PDFExtractor
from app.services.ai.inference import LLMInference
from app.services.ai.prompts import STRUCTURED_RESUME_SYSTEM_PROMPT, ENHANCED_RESUME_SYSTEM_PROMPT
from app.config import get_settings
from app.exceptions import ProfileNotFoundError
from logging import getLogger

logger = getLogger(__name__)

# OCR text longer than this with empty experience → sparse parse warning
_SPARSE_OCR_MIN_CHARS = 200


def _completeness_warning(result: dict | object, *, ocr_text_len: int) -> str | None:
    """Return a soft warning if structured resume looks incomplete vs OCR length."""
    if hasattr(result, "model_dump"):
        data = result.model_dump()
    elif isinstance(result, dict):
        data = result
    else:
        data = {}
    name = (data.get("name") or "").strip()
    experiences = data.get("past_experience") or []
    if not name:
        return "Structured resume is missing a name — review and edit before generating jobs."
    if ocr_text_len >= _SPARSE_OCR_MIN_CHARS and not experiences:
        return (
            "OCR extracted substantial text but no work experience was structured — "
            "review the profile; fields may have been dropped."
        )
    return None


class ProfileService:
    def __init__(self):
        self.extractor = PDFExtractor()
        settings = get_settings()
        self.flash_model = settings.LLM_FLASH_MODEL

    async def create_profile(self, db: AsyncSession, user_id: str, pdf_bytes: bytes) -> int:
        """Create profile row (PENDING), then extract and structure in background."""
        profile = Profile(user_id=user_id, status=ProfileStatus.PENDING)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        return profile.id

    async def extract_text_fast(self, pdf_bytes: bytes) -> str:
        """pdfplumber extraction, run in thread to avoid blocking the event loop.

        Returns empty string on failure — the background task will retry with vision fallback.
        """
        try:
            return await asyncio.to_thread(self.extractor.extract_text, pdf_bytes)
        except Exception as e:
            logger.warning(f"Fast text extraction failed: {e}")
            return ""

    async def process_profile(
        self, db: AsyncSession, profile_id: int, pdf_bytes: bytes, extracted_text: str = ""
    ) -> None:
        """Background task: extract text (if not provided), structure via AI, update profile."""
        t_start = time.monotonic()
        profile = await db.get(Profile, profile_id)
        if not profile:
            logger.error(f"Profile {profile_id} not found during processing")
            return

        try:
            profile.status = ProfileStatus.PROCESSING
            await db.commit()
            logger.info(f"[profile:{profile_id}] Processing started (pdf_size={len(pdf_bytes)} bytes, pre_extracted={bool(extracted_text.strip())})")

            # Use pre-extracted text if available
            t0 = time.monotonic()
            text = extracted_text if extracted_text.strip() else ""
            if not text:
                text = await asyncio.to_thread(self.extractor.extract_text, pdf_bytes)
                logger.info(f"[profile:{profile_id}] PDF text extraction: {int((time.monotonic() - t0) * 1000)}ms ({len(text)} chars)")
            else:
                logger.info(f"[profile:{profile_id}] Using pre-extracted text ({len(text)} chars)")

            needs_vision = len(text.strip()) < 50 or self.extractor._has_high_non_ascii_ratio(text)

            t0 = time.monotonic()
            if needs_vision:
                logger.info(f"[profile:{profile_id}] Using vision path (text_len={len(text.strip())}, high_non_ascii={self.extractor._has_high_non_ascii_ratio(text)})")
                result = await self.extractor.extract_and_structure_via_vision(
                    pdf_bytes,
                    user_id=profile.user_id,
                    reference_id=str(profile_id),
                )
            else:
                logger.info(f"[profile:{profile_id}] Using text path → AI structuring")
                llm = LLMInference(model_name=self.flash_model)
                result = await llm.run_inference(
                    system_prompt=STRUCTURED_RESUME_SYSTEM_PROMPT,
                    inputs=[text],
                    structured_output_schema=ResumeInfo,
                    user_id=profile.user_id,
                    purpose="profile_structuring",
                    reference_id=str(profile_id),
                )
            ai_ms = int((time.monotonic() - t0) * 1000)
            logger.info(f"[profile:{profile_id}] AI structuring: {ai_ms}ms {'(SLOW >60s)' if ai_ms > 60000 else ''}")

            t0 = time.monotonic()
            # Soft completeness warning — never invent fields, but surface sparse parses.
            data = result.model_dump() if hasattr(result, "model_dump") else dict(result)
            warning = _completeness_warning(data, ocr_text_len=len(text.strip()))
            if warning:
                data = {**data, "_completeness_warning": warning}
                logger.warning(f"[profile:{profile_id}] Completeness warning: {warning}")

            profile.resume_info = data
            profile.status = ProfileStatus.READY
            await db.commit()
            logger.info(f"[profile:{profile_id}] DB save: {int((time.monotonic() - t0) * 1000)}ms")

            total_ms = int((time.monotonic() - t_start) * 1000)
            logger.info(f"[profile:{profile_id}] COMPLETE total={total_ms}ms {'(SLOW >60s)' if total_ms > 60000 else ''}")

        except Exception as e:
            total_ms = int((time.monotonic() - t_start) * 1000)
            logger.exception(f"[profile:{profile_id}] FAILED after {total_ms}ms: {e}")
            await db.rollback()
            try:
                result = await db.execute(
                    select(Profile).where(Profile.id == profile_id)
                )
                profile = result.scalar_one_or_none()
                if profile:
                    profile.status = ProfileStatus.FAILED
                    await db.commit()
            except Exception:
                logger.exception(f"Failed to mark profile {profile_id} as FAILED")

    async def get_profile(self, db: AsyncSession, profile_id: int, user_id: str) -> Profile:
        result = await db.execute(
            select(Profile).where(Profile.id == profile_id, Profile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise ProfileNotFoundError(f"Profile {profile_id} not found")
        return profile

    async def get_profiles(
        self, db: AsyncSession, user_id: str, *, offset: int = 0, limit: int = 10
    ) -> tuple[list[Profile], int]:
        base = select(Profile).where(Profile.user_id == user_id, Profile.is_active == True)
        # Total count
        count_result = await db.execute(select(func.count()).select_from(base.subquery()))
        total = count_result.scalar() or 0
        # Paginated items
        result = await db.execute(
            base.order_by(Profile.created_at.desc()).offset(offset).limit(limit)
        )
        return list(result.scalars().all()), total

    async def update_resume_info(
        self, db: AsyncSession, profile_id: int, user_id: str, resume_info: dict
    ) -> Profile:
        profile = await self.get_profile(db, profile_id, user_id)
        profile.resume_info = resume_info
        await db.commit()
        await db.refresh(profile)
        return profile

    async def enhance_profile(self, db: AsyncSession, profile_id: int, user_id: str) -> Profile:
        # Profile enhancement is intentionally free — no credit deduction
        # This is a retention feature; the paid action is job resume generation
        
        profile = await self.get_profile(db, profile_id, user_id)
        
        # Rate limit: max 3 enhances per profile per 24 hours
        from datetime import datetime, timezone, timedelta
        from app.exceptions import UsageLimitExceeded
        
        now = datetime.now(timezone.utc)
        
        # Check if we need to reset the counter
        if hasattr(profile, 'enhance_reset_at') and profile.enhance_reset_at:
            if profile.enhance_reset_at < now:
                profile.enhance_count_today = 0
                profile.enhance_reset_at = now + timedelta(days=1)
        else:
            # First time, initialize
            if not hasattr(profile, 'enhance_count_today'):
                profile.enhance_count_today = 0
            if not hasattr(profile, 'enhance_reset_at'):
                profile.enhance_reset_at = now + timedelta(days=1)
        
        # Check rate limit
        enhance_count = getattr(profile, 'enhance_count_today', 0)
        if enhance_count >= 3:
            raise UsageLimitExceeded("You've enhanced this profile 3 times today. Try again tomorrow.")
        
        llm = LLMInference(model_name=self.flash_model)
        result = await llm.run_inference(
            system_prompt=ENHANCED_RESUME_SYSTEM_PROMPT,
            inputs=[json.dumps(profile.resume_info or {})],
            structured_output_schema=ResumeInfo,
            user_id=profile.user_id,
            purpose="profile_enhancement",
            reference_id=str(profile_id),
        )
        
        # Store original for potential reset
        profile.resume_info = result
        profile.enhance_count_today = enhance_count + 1
        
        await db.commit()
        await db.refresh(profile)
        return profile

    async def deactivate_profile(self, db: AsyncSession, profile_id: int, user_id: str) -> None:
        profile = await self.get_profile(db, profile_id, user_id)
        profile.is_active = False
        await db.commit()
