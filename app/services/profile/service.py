import asyncio
import json
import time
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.profile import Profile, ProfileStatus, UploadSource
from app.schemas.resume import ResumeInfo
from app.services.ocr.extractor import PDFExtractor, detect_resume_format, extract_docx_text
from app.services.ai.inference import LLMInference
from app.services.ai.prompts import (
    STRUCTURED_RESUME_SYSTEM_PROMPT,
    ENHANCED_RESUME_SYSTEM_PROMPT,
    BULLET_QUALITY_SYSTEM_PROMPT,
    BULLET_QUALITY_USER_PROMPT,
    LINKEDIN_OPTIMIZE_SYSTEM_PROMPT,
    LINKEDIN_OPTIMIZE_USER_PROMPT,
)
from app.schemas.profile import LinkedInOptimizeResult
from app.schemas.tailor import BulletQualityResult, EvidenceMap
from app.config import get_settings
from app.exceptions import ProfileNotFoundError, ConflictError, UsageLimitExceeded
from app.services.auth.jwt_handler import verify_guest_token
from logging import getLogger

logger = getLogger(__name__)

DOCX_DIR = Path(__file__).resolve().parent.parent / "data" / "docx"
DOCX_DIR.mkdir(parents=True, exist_ok=True)
PDF_ORIGINALS_DIR = Path(__file__).resolve().parent.parent / "data" / "pdfs" / "originals"
PDF_ORIGINALS_DIR.mkdir(parents=True, exist_ok=True)

# OCR text longer than this with empty experience → sparse parse warning
_SPARSE_OCR_MIN_CHARS = 200


def _inference_user_id(profile: Profile) -> str:
    return profile.user_id or "guest"


def _resume_info_as_dict(result: object) -> dict:
    if hasattr(result, "model_dump"):
        return result.model_dump(mode="json")
    if isinstance(result, dict):
        return result
    return {}


async def _enhance_density_check(
    llm: LLMInference,
    original: dict,
    enhanced: dict,
    *,
    user_id: str,
    reference_id: str,
) -> BulletQualityResult:
    """Reuse bullet-quality guardrail to catch fabrication / density loss on enhance."""
    raw = await llm.run_inference(
        system_prompt=BULLET_QUALITY_SYSTEM_PROMPT,
        inputs=[
            BULLET_QUALITY_USER_PROMPT.format(
                evidence_map=json.dumps(EvidenceMap().model_dump(mode="json")),
                user_info=json.dumps(original),
                tailored_resume=json.dumps(enhanced),
            )
        ],
        structured_output_schema=BulletQualityResult,
        user_id=user_id,
        purpose="profile_enhance_density",
        reference_id=reference_id,
    )
    return BulletQualityResult.model_validate(raw)


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

    async def create_profile(
        self,
        db: AsyncSession,
        user_id: str,
        pdf_bytes: bytes,
        *,
        source_filename: str | None = None,
        file_ext: str | None = None,
    ) -> int:
        """Create profile row (PENDING), then extract and structure in background."""
        profile = Profile(
            user_id=user_id,
            status=ProfileStatus.PENDING,
            source_filename=(source_filename or None),
            upload_source=UploadSource.AUTHENTICATED,
        )
        db.add(profile)
        await db.flush()
        if file_ext:
            profile.upload_gcs_path = f"uploads/profiles/{user_id}/{profile.id}.{file_ext}"
        await db.commit()
        await db.refresh(profile)
        return profile.id

    async def create_guest_profile(
        self,
        db: AsyncSession,
        pdf_bytes: bytes,
        *,
        guest_ip: str | None = None,
        source_filename: str | None = None,
        file_ext: str | None = None,
    ) -> int:
        from datetime import datetime, timezone, timedelta

        settings = get_settings()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.GUEST_PROFILE_TTL_HOURS)
        profile = Profile(
            user_id=None,
            status=ProfileStatus.PENDING,
            source_filename=(source_filename or None),
            guest_expires_at=expires_at,
            guest_ip=(guest_ip or None),
            upload_source=UploadSource.GUEST,
        )
        db.add(profile)
        await db.flush()
        if file_ext:
            profile.upload_gcs_path = f"uploads/guest/{profile.id}.{file_ext}"
        await db.commit()
        await db.refresh(profile)
        return profile.id

    async def enforce_guest_upload_limits(self, db: AsyncSession, guest_ip: str) -> None:
        from datetime import datetime, timezone, timedelta

        settings = get_settings()
        now = datetime.now(timezone.utc)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)

        daily_count = (
            await db.execute(
                select(func.count())
                .select_from(Profile)
                .where(
                    Profile.user_id.is_(None),
                    Profile.guest_ip == guest_ip,
                    Profile.created_at >= start_of_day,
                )
            )
        ).scalar() or 0
        if daily_count >= settings.GUEST_UPLOAD_MAX_PER_IP_PER_DAY:
            raise UsageLimitExceeded(
                "Daily free upload limit reached. Sign in to continue uploading resumes."
            )

        cooldown_since = now - timedelta(seconds=settings.GUEST_UPLOAD_COOLDOWN_SECONDS)
        recent = (
            await db.execute(
                select(Profile.id)
                .where(
                    Profile.user_id.is_(None),
                    Profile.guest_ip == guest_ip,
                    Profile.created_at >= cooldown_since,
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if recent is not None:
            raise UsageLimitExceeded("Please wait a moment before uploading again.")

    async def get_guest_profile_by_token(
        self, db: AsyncSession, profile_id: int, guest_token: str
    ) -> Profile:
        token_profile_id = verify_guest_token(guest_token)
        if token_profile_id != profile_id:
            raise ProfileNotFoundError(f"Profile {profile_id} not found")
        return await self._get_unclaimed_guest_profile(db, profile_id)

    async def _get_unclaimed_guest_profile(self, db: AsyncSession, profile_id: int) -> Profile:
        from datetime import datetime, timezone

        result = await db.execute(
            select(Profile).where(
                Profile.id == profile_id,
                Profile.user_id.is_(None),
                Profile.is_active == True,
            )
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise ProfileNotFoundError(f"Profile {profile_id} not found")
        if profile.guest_expires_at and profile.guest_expires_at < datetime.now(timezone.utc):
            raise ProfileNotFoundError(f"Profile {profile_id} not found")
        return profile

    async def get_guest_preview(self, db: AsyncSession, profile_id: int, guest_token: str) -> dict:
        profile = await self.get_guest_profile_by_token(db, profile_id, guest_token)
        info = profile.resume_info or {}
        experiences = info.get("past_experience") or []
        skills = info.get("skills") or []
        if isinstance(skills, dict):
            skills_count = sum(len(v or []) for v in skills.values())
        elif isinstance(skills, list):
            skills_count = len(skills)
        else:
            skills_count = 0
        return {
            "id": profile.id,
            "status": profile.status.value,
            "source_filename": profile.source_filename,
            "name": (info.get("name") or "").strip() or None,
            "title": (info.get("title") or info.get("headline") or "").strip() or None,
            "experience_count": len(experiences) if isinstance(experiences, list) else 0,
            "skills_count": skills_count,
        }

    async def claim_guest_profile(
        self, db: AsyncSession, profile_id: int, user_id: str, guest_token: str
    ) -> Profile:
        from datetime import datetime, timezone

        token_profile_id = verify_guest_token(guest_token)
        if token_profile_id != profile_id:
            raise ProfileNotFoundError(f"Profile {profile_id} not found")

        result = await db.execute(select(Profile).where(Profile.id == profile_id))
        profile = result.scalar_one_or_none()
        if not profile or not profile.is_active:
            raise ProfileNotFoundError(f"Profile {profile_id} not found")

        if profile.user_id == user_id:
            return profile

        if profile.user_id is not None and profile.user_id != user_id:
            raise ConflictError("This resume has already been claimed by another account.")

        if profile.guest_expires_at and profile.guest_expires_at < datetime.now(timezone.utc):
            raise ProfileNotFoundError("Guest session expired. Please upload your resume again.")

        now = datetime.now(timezone.utc)
        profile.user_id = user_id
        profile.claimed_at = now
        profile.guest_expires_at = None
        profile.guest_ip = None
        await db.commit()
        await db.refresh(profile)
        return profile

    async def cleanup_expired_guest_profiles(self, db: AsyncSession) -> int:
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(Profile).where(
                Profile.user_id.is_(None),
                Profile.guest_expires_at.isnot(None),
                Profile.guest_expires_at < now,
            )
        )
        expired = list(result.scalars().all())
        for profile in expired:
            profile.is_active = False
        if expired:
            await db.commit()
        return len(expired)

    async def extract_text_fast(
        self, file_bytes: bytes, *, source_filename: str | None = None
    ) -> str:
        """Fast PDF/DOCX text extraction in a worker thread.

        Returns empty string on failure — the background task will retry with vision fallback for PDFs.
        """
        try:
            fmt = detect_resume_format(source_filename, file_bytes)
            if fmt == "docx":
                return await asyncio.to_thread(extract_docx_text, file_bytes)
            return await asyncio.to_thread(self.extractor.extract_text, file_bytes)
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

            resume_format = detect_resume_format(profile.source_filename, pdf_bytes)
            profile.source_format = resume_format

            if resume_format == "docx":
                docx_path = DOCX_DIR / f"{profile_id}.docx"
                await asyncio.to_thread(docx_path.write_bytes, pdf_bytes)
                profile.original_docx_path = str(docx_path)
                profile.original_pdf_path = None
                profile.pdf_field_index = None
                profile.preservation_eligible = True
                profile.layout_signals = None
            else:
                profile.original_docx_path = None
                profile.docx_field_index = None
                from app.services.ocr.layout_signals import extract_pdf_layout_signals

                profile.layout_signals = await asyncio.to_thread(
                    extract_pdf_layout_signals, pdf_bytes
                )

            # Use pre-extracted text if available; capture page count for PDFs only
            t0 = time.monotonic()
            text = extracted_text if extracted_text.strip() else ""
            page_count = 1
            if resume_format == "pdf":
                page_count = await asyncio.to_thread(self.extractor.count_pages, pdf_bytes)
            if not text:
                if resume_format == "docx":
                    text = await asyncio.to_thread(extract_docx_text, pdf_bytes)
                    logger.info(
                        f"[profile:{profile_id}] DOCX text extraction: {int((time.monotonic() - t0) * 1000)}ms "
                        f"({len(text)} chars)"
                    )
                else:
                    text, page_count = await asyncio.to_thread(
                        self.extractor.extract_text_and_page_count, pdf_bytes
                    )
                    logger.info(
                        f"[profile:{profile_id}] PDF text extraction: {int((time.monotonic() - t0) * 1000)}ms "
                        f"({len(text)} chars, {page_count} pages)"
                    )
            else:
                logger.info(
                    f"[profile:{profile_id}] Using pre-extracted text ({len(text)} chars, {page_count} pages)"
                )

            needs_vision = resume_format == "pdf" and (
                len(text.strip()) < 50 or self.extractor._has_high_non_ascii_ratio(text)
            )
            if needs_vision:
                profile.layout_signals = None
                profile.original_pdf_path = None
                profile.pdf_field_index = None
                profile.preservation_eligible = False
            elif resume_format == "pdf":
                pdf_path = PDF_ORIGINALS_DIR / f"{profile_id}.pdf"
                await asyncio.to_thread(pdf_path.write_bytes, pdf_bytes)
                profile.original_pdf_path = str(pdf_path)
                profile.preservation_eligible = True

            t0 = time.monotonic()
            if needs_vision:
                logger.info(f"[profile:{profile_id}] Using vision path (text_len={len(text.strip())}, high_non_ascii={self.extractor._has_high_non_ascii_ratio(text)})")
                result = await self.extractor.extract_and_structure_via_vision(
                    pdf_bytes,
                    user_id=_inference_user_id(profile),
                    reference_id=str(profile_id),
                )
            else:
                logger.info(f"[profile:{profile_id}] Using text path → AI structuring")
                llm = LLMInference(model_name=self.flash_model)
                result = await llm.run_inference(
                    system_prompt=STRUCTURED_RESUME_SYSTEM_PROMPT,
                    inputs=[text],
                    structured_output_schema=ResumeInfo,
                    user_id=_inference_user_id(profile),
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
            profile.original_page_count = page_count

            # Build format-preservation indexes after structuring
            if resume_format == "docx" and profile.original_docx_path:
                from app.services.latex.docx_field_index import build_docx_field_index

                docx_bytes = await asyncio.to_thread(Path(profile.original_docx_path).read_bytes)
                profile.docx_field_index = await asyncio.to_thread(
                    build_docx_field_index, docx_bytes, data
                )
            elif resume_format == "pdf" and profile.preservation_eligible and profile.original_pdf_path:
                from app.services.ocr.pdf_span_index import build_pdf_field_index

                pdf_bytes_stored = await asyncio.to_thread(Path(profile.original_pdf_path).read_bytes)
                profile.pdf_field_index = await asyncio.to_thread(
                    build_pdf_field_index, pdf_bytes_stored, data
                )

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
            select(Profile).where(
                Profile.id == profile_id,
                Profile.user_id == user_id,
                Profile.is_active == True,
            )
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
        original = profile.resume_info or {}
        if hasattr(original, "model_dump"):
            original = original.model_dump(mode="json")
        result = await llm.run_inference(
            system_prompt=ENHANCED_RESUME_SYSTEM_PROMPT,
            inputs=[json.dumps(original)],
            structured_output_schema=ResumeInfo,
            user_id=profile.user_id,
            purpose="profile_enhancement",
            reference_id=str(profile_id),
        )
        enhanced = _resume_info_as_dict(result)
        quality = await _enhance_density_check(
            llm,
            original if isinstance(original, dict) else {},
            enhanced,
            user_id=profile.user_id,
            reference_id=str(profile_id),
        )
        if not quality.passed:
            logger.warning(
                "Profile enhance density check failed profile_id=%s — re-enhancing once",
                profile_id,
            )
            critique = quality.critique or json.dumps(quality.model_dump(mode="json"))
            result = await llm.run_inference(
                system_prompt=ENHANCED_RESUME_SYSTEM_PROMPT,
                inputs=[
                    json.dumps(original),
                    f"Previous enhancement failed honesty/density checks. Fix these issues "
                    f"without inventing facts:\n{critique}\n\nReturn a corrected ResumeInfo.",
                ],
                structured_output_schema=ResumeInfo,
                user_id=profile.user_id,
                purpose="profile_enhancement_repair",
                reference_id=str(profile_id),
            )
            enhanced = _resume_info_as_dict(result)

        # Store enhanced (original lives in prior versions / user can re-upload)
        profile.resume_info = enhanced
        profile.enhance_count_today = enhance_count + 1
        
        await db.commit()
        await db.refresh(profile)
        return profile

    async def deactivate_profile(self, db: AsyncSession, profile_id: int, user_id: str) -> None:
        profile = await self.get_profile(db, profile_id, user_id)
        profile.is_active = False
        await db.commit()

    async def linkedin_optimize(
        self,
        db: AsyncSession,
        profile_id: int,
        user_id: str,
        target_jd: dict | str | None = None,
    ) -> dict:
        """Generate LinkedIn headline, About summary, and skills list for a profile."""
        from app.services.auth.rate_limits import enforce_daily_llm_limit

        settings = get_settings()
        profile = await self.get_profile(db, profile_id, user_id)
        if not profile.resume_info:
            raise ValueError(f"Profile {profile_id} has no structured resume data")

        await enforce_daily_llm_limit(
            db,
            user_id,
            purpose="linkedin_optimize",
            limit=settings.LINKEDIN_OPTIMIZE_DAILY_LIMIT,
            label="LinkedIn optimization",
        )

        llm = LLMInference()
        user_info_str = json.dumps(profile.resume_info, ensure_ascii=False)
        jd_str = json.dumps(target_jd, ensure_ascii=False) if isinstance(target_jd, dict) else (target_jd or "")

        prompt = LINKEDIN_OPTIMIZE_USER_PROMPT.format(
            user_info=user_info_str,
            job_description=jd_str,
        )

        result = await llm.run_inference(
            system_prompt=LINKEDIN_OPTIMIZE_SYSTEM_PROMPT,
            inputs=[prompt],
            structured_output_schema=LinkedInOptimizeResult,
            model=settings.LLM_PRO_MODEL,
            user_id=user_id,
            purpose="linkedin_optimize",
            reference_id=str(profile_id),
        )

        if hasattr(result, "model_dump"):
            return result.model_dump(mode="json")
        return result
