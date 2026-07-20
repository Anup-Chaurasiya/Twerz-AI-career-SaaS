import asyncio
import time
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.job import Job, JobStatus
from app.models.profile import Profile, ProfileStatus
from app.schemas.custom_resume import CustomResumeInfo
from app.schemas.job import JobDescription
from app.services.job.tailor_pipeline import TailorPipeline, _append_version
from app.services.latex.builder import build_resume
from app.services.latex.compiler import compile_latex
from app.services.latex.sanitizer import sanitize_special_chars
from app.services.storage.gcs import GCSClient
from app.config import get_settings
from app.exceptions import JobNotFoundError, ProfileNotFoundError
from logging import getLogger
logger = getLogger(__name__)

# Local temp directory for PDFs before GCS upload
PDF_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "pdfs"
PDF_DIR.mkdir(parents=True, exist_ok=True)

GCS_UPLOAD_RETRIES = 3
GCS_UPLOAD_BACKOFF = 2.0  # seconds, exponential


async def _publish_job_progress(job_id: int, status: str, message: str) -> None:
    """Push SSE progress so the job detail page can leave the spinner without a refresh."""
    try:
        from app.api.progress import publish

        await publish("job", job_id, {"status": status, "message": message})
    except Exception:
        logger.debug("progress publish failed for job %s", job_id, exc_info=True)


def _spawn_gcs_upload(pdf_bytes: bytes, user_id: str, job_id: int) -> None:
    """Fire-and-forget GCS upload without leaking unretrieved task exceptions."""
    task = asyncio.create_task(_background_gcs_upload(pdf_bytes, user_id, job_id))

    def _done(t: asyncio.Task) -> None:
        try:
            exc = t.exception()
        except asyncio.CancelledError:
            return
        if exc:
            logger.warning(f"Background GCS upload task failed for job {job_id}: {exc}")

    task.add_done_callback(_done)


async def _background_gcs_upload(pdf_bytes: bytes, user_id: str, job_id: int) -> None:
    """Upload PDF to GCS in background with retry. Updates job.pdf_gcs_path on success.
    
    If all retries fail, marks gcs_upload_failed=True in DB so the system knows
    to fall back to local storage. This is critical for Cloud Run where local
    files disappear on container restart.
    """
    from app.database.session import async_session_factory

    gcs_path = f"resumes/{user_id}/{job_id}.pdf"
    try:
        gcs = GCSClient()
    except Exception as e:
        logger.warning(f"GCS client unavailable for job {job_id}: {e} — keeping local PDF")
        async with async_session_factory() as db:
            result = await db.execute(select(Job).where(Job.id == job_id))
            job = result.scalar_one_or_none()
            if job:
                job.gcs_upload_failed = True
                await db.commit()
        return

    for attempt in range(GCS_UPLOAD_RETRIES):
        try:
            # GCS client is sync — run in thread to avoid blocking the event loop
            await asyncio.to_thread(gcs.upload_pdf, pdf_bytes, gcs_path)

            # Update DB with GCS path and clear any previous failure flag
            async with async_session_factory() as db:
                result = await db.execute(select(Job).where(Job.id == job_id))
                job = result.scalar_one_or_none()
                if job:
                    job.pdf_gcs_path = gcs_path
                    job.gcs_upload_failed = False
                    await db.commit()

            # Clean up local temp file
            local_path = PDF_DIR / f"{user_id}_{job_id}.pdf"
            await asyncio.to_thread(local_path.unlink, True)

            logger.info(f"Background GCS upload succeeded for job {job_id}")
            return
        except Exception as e:
            logger.warning(f"GCS upload attempt {attempt + 1}/{GCS_UPLOAD_RETRIES} failed for job {job_id}: {e}")
            if attempt < GCS_UPLOAD_RETRIES - 1:
                await asyncio.sleep(GCS_UPLOAD_BACKOFF * (2 ** attempt))

    # All retries failed — mark failure in DB (Sentry optional)
    logger.error(f"All GCS upload attempts failed for job {job_id}. PDF available locally only.")
    try:
        import sentry_sdk

        with sentry_sdk.push_scope() as scope:
            scope.set_context("gcs_upload", {
                "job_id": job_id,
                "user_id": user_id,
                "gcs_path": gcs_path,
                "retries": GCS_UPLOAD_RETRIES,
            })
            sentry_sdk.capture_message(
                f"GCS upload failed after {GCS_UPLOAD_RETRIES} attempts for job {job_id}",
                level="error"
            )
    except Exception:
        pass  # Don't fail if Sentry isn't installed/configured
    
    # Mark failure in DB so download endpoint knows to use signed URLs or local file
    async with async_session_factory() as db:
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if job:
            job.gcs_upload_failed = True
            await db.commit()


class JobService:
    def __init__(self):
        settings = get_settings()
        self.pro_model = settings.LLM_PRO_MODEL
        self.pipeline = TailorPipeline()

    async def create_job(
        self,
        db: AsyncSession,
        user_id: str,
        profile_id: int,
        job_description: JobDescription,
    ) -> Job:
        # Validate profile exists and is ready
        result = await db.execute(
            select(Profile).where(Profile.id == profile_id, Profile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise ProfileNotFoundError(f"Profile {profile_id} not found")
        if profile.status != ProfileStatus.READY:
            raise ValueError(f"Profile {profile_id} is not ready (status: {profile.status})")

        job = Job(
            user_id=user_id,
            profile_id=profile_id,
            job_description=job_description.model_dump(),
            status=JobStatus.PENDING,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        return job

    async def analyze_fit(self, db: AsyncSession, job_id: int, user_id: str) -> Job:
        """Run JD analysis + evidence map without spending a credit or writing a resume."""
        job = await self._get_job(db, job_id, user_id)
        profile = await db.get(Profile, job.profile_id)
        if not profile:
            raise ProfileNotFoundError(f"Profile {job.profile_id} not found for job {job_id}")
        result = await self.pipeline.analyze_fit_only(
            profile_info=profile.resume_info or {},
            job_description=job.job_description or {},
            user_id=user_id,
            reference_id=str(job_id),
        )
        job.jd_analysis = result["jd_analysis"]
        job.evidence_map = result["evidence_map"]
        job.fit_score = result["fit_score"]
        job.fit_label = result["fit_label"]
        job.fit_rationale = result["fit_rationale"]
        job.gap_list = result["gap_list"]
        job.gap_roadmap = result.get("gap_roadmap")
        await db.commit()
        await db.refresh(job)
        return job

    async def generate_custom_resume(self, db: AsyncSession, job_id: int, user_id: str) -> None:
        """Phase 1: Multi-pass tailor pipeline → CustomResumeInfo + fit/ATS fields."""
        t_start = time.monotonic()
        try:
            job = await self._get_job(db, job_id, user_id)
            profile = await db.get(Profile, job.profile_id)

            if not profile:
                raise ProfileNotFoundError(f"Profile {job.profile_id} not found for job {job_id}")

            job.status = JobStatus.GENERATING_RESUME
            await db.commit()
            await _publish_job_progress(job_id, "GENERATING_RESUME", "Analyzing JD and tailoring resume…")
            logger.info(f"[job:{job_id}] Phase 1 (multi-pass tailor) started")

            t0 = time.monotonic()
            result = await self.pipeline.run(
                profile_info=profile.resume_info or {},
                job_description=job.job_description or {},
                user_id=user_id,
                reference_id=str(job_id),
            )
            ai_ms = int((time.monotonic() - t0) * 1000)
            logger.info(f"[job:{job_id}] Tailor pipeline: {ai_ms}ms {'(SLOW >60s)' if ai_ms > 60000 else ''}")

            t0 = time.monotonic()
            job.custom_resume_data = result["custom_resume_data"]
            job.jd_analysis = result.get("jd_analysis")
            job.evidence_map = result.get("evidence_map")
            job.fit_score = result.get("fit_score")
            job.fit_label = result.get("fit_label")
            job.fit_rationale = result.get("fit_rationale")
            job.gap_list = result.get("gap_list")
            job.gap_roadmap = result.get("gap_roadmap")
            job.ats_score_before = result.get("ats_score_before")
            job.ats_score_after = result.get("ats_score_after")
            job.ats_score_detail = result.get("ats_score_detail")
            job.bullet_diff = result.get("bullet_diff")
            job.resume_versions = result.get("resume_versions")
            job.status = JobStatus.RESUME_GENERATED
            await db.commit()
            await _publish_job_progress(
                job_id,
                "RESUME_GENERATED",
                f"Resume tailored (fit {job.fit_label}, ATS {job.ats_score_after}). Compiling PDF…",
            )

            # Notify user resume is ready for review
            try:
                from app.services.notifications.service import NotificationService
                await NotificationService().notify(
                    db,
                    user_id,
                    title="Resume tailored",
                    body=f"Your tailored resume is ready (fit {job.fit_label}, ATS {job.ats_score_after}).",
                    kind="resume_ready",
                    link=f"/dashboard/jobs/{job_id}",
                )
            except Exception:
                logger.debug("Notification failed for job %s", job_id, exc_info=True)

            logger.info(f"[job:{job_id}] DB save: {int((time.monotonic() - t0) * 1000)}ms")

            total_ms = int((time.monotonic() - t_start) * 1000)
            logger.info(f"[job:{job_id}] Phase 1 COMPLETE total={total_ms}ms {'(SLOW >60s)' if total_ms > 60000 else ''}")

        except Exception as e:
            total_ms = int((time.monotonic() - t_start) * 1000)
            logger.exception(f"[job:{job_id}] Phase 1 FAILED after {total_ms}ms: {e}")
            await db.rollback()
            try:
                result = await db.execute(select(Job).where(Job.id == job_id))
                job = result.scalar_one_or_none()
                if job:
                    job.status = JobStatus.FAILED
                    await db.commit()
                    await _publish_job_progress(job_id, "FAILED", f"Resume generation failed: {e}")
            except Exception:
                logger.exception(f"Failed to mark job {job_id} as FAILED")
            raise

    async def generate_pdf(
        self, db: AsyncSession, job_id: int, user_id: str, *, recompile: bool = False,
    ) -> None:
        """Phase 2: Build LaTeX from CustomResumeInfo, compile PDF, upload to GCS.

        Saves locally first for immediate availability, then uploads to GCS in background.
        When recompile=True (chat-triggered), failures don't set status to FAILED —
        the previous PDF and READY status are preserved.
        """
        t_start = time.monotonic()
        try:
            job = await self._get_job(db, job_id, user_id)

            if not job.custom_resume_data:
                raise ValueError("No custom resume data found. Run generate_custom_resume first.")

            if not recompile:
                job.status = JobStatus.GENERATING_PDF
                await db.commit()
                await _publish_job_progress(job_id, "GENERATING_PDF", "Compiling PDF…")
            logger.info(f"[job:{job_id}] Phase 2 (PDF {'recompile' if recompile else 'generation'}) started")

            # Sanitize and build LaTeX
            t0 = time.monotonic()
            sanitized = sanitize_special_chars(job.custom_resume_data)
            resume_info = CustomResumeInfo.model_validate(sanitized)
            latex_code = build_resume(resume_info)
            logger.info(f"[job:{job_id}] LaTeX build: {int((time.monotonic() - t0) * 1000)}ms ({len(latex_code)} chars)")

            # Compile PDF
            t0 = time.monotonic()
            pdf_bytes = await compile_latex(latex_code)
            logger.info(f"[job:{job_id}] pdflatex compile: {int((time.monotonic() - t0) * 1000)}ms ({len(pdf_bytes)} bytes)")

            # Save locally first (immediate availability)
            t0 = time.monotonic()
            local_path = PDF_DIR / f"{user_id}_{job_id}.pdf"
            await asyncio.to_thread(local_path.write_bytes, pdf_bytes)
            logger.info(f"[job:{job_id}] Local save: {int((time.monotonic() - t0) * 1000)}ms → {local_path}")

            job.resume_latex_code = latex_code
            job.pdf_gcs_path = str(local_path)
            job.status = JobStatus.READY
            await db.commit()
            await _publish_job_progress(job_id, "READY", "PDF ready")

            total_ms = int((time.monotonic() - t_start) * 1000)
            logger.info(f"[job:{job_id}] Phase 2 COMPLETE total={total_ms}ms")

            # Background GCS upload (with retry) — don't block the job status
            _spawn_gcs_upload(pdf_bytes, user_id, job_id)

        except Exception as e:
            total_ms = int((time.monotonic() - t_start) * 1000)
            logger.exception(f"[job:{job_id}] Phase 2 FAILED after {total_ms}ms: {e}")
            
            # Extract error log if it's a LaTeX compilation error
            from app.exceptions import LaTeXCompilationError
            pdf_error_log = None
            if isinstance(e, LaTeXCompilationError) and hasattr(e, 'full_log') and e.full_log:
                pdf_error_log = e.full_log
                logger.error(f"[job:{job_id}] LaTeX compilation failed with error log ({len(pdf_error_log)} chars)")
            
            await db.rollback()
            if not recompile:
                # Resume JSON already exists from Phase 1 — keep RESUME_GENERATED
                # so the user can retry PDF for free instead of a dead FAILED job.
                try:
                    result = await db.execute(select(Job).where(Job.id == job_id))
                    job = result.scalar_one_or_none()
                    if job:
                        if job.custom_resume_data:
                            job.status = JobStatus.RESUME_GENERATED
                        else:
                            job.status = JobStatus.FAILED
                        if pdf_error_log:
                            job.pdf_error_log = pdf_error_log
                        elif str(e):
                            job.pdf_error_log = str(e)[:5000]
                        await db.commit()
                        await _publish_job_progress(
                            job_id,
                            job.status.value,
                            (
                                "PDF compile failed — resume JSON is ready; retry PDF for free."
                                if job.custom_resume_data
                                else f"PDF generation failed: {e}"
                            ),
                        )
                except Exception:
                    logger.exception(f"Failed to mark job {job_id} as FAILED")
            else:
                # Restore READY status if recompile trashed it
                try:
                    result = await db.execute(select(Job).where(Job.id == job_id))
                    job = result.scalar_one_or_none()
                    if job and job.status != JobStatus.READY:
                        job.status = JobStatus.READY
                        await db.commit()
                        await _publish_job_progress(job_id, "READY", "Recompile failed; previous PDF restored")
                except Exception:
                    logger.exception(f"Failed to restore READY status for job {job_id}")
            raise

    async def get_jobs(
        self, db: AsyncSession, user_id: str, *, offset: int = 0, limit: int = 10
    ) -> tuple[list[Job], int]:
        base = select(Job).where(Job.user_id == user_id)
        # Total count
        count_result = await db.execute(select(func.count()).select_from(base.subquery()))
        total = count_result.scalar() or 0
        # Paginated items
        result = await db.execute(
            base.order_by(Job.created_at.desc()).offset(offset).limit(limit)
        )
        return list(result.scalars().all()), total

    async def get_job(self, db: AsyncSession, job_id: int, user_id: str, *, for_update: bool = False) -> Job:
        return await self._get_job(db, job_id, user_id, for_update=for_update)

    async def get_pdf(self, db: AsyncSession, job_id: int, user_id: str) -> bytes:
        """Download PDF: try GCS first, fall back to local file, then regenerate from LaTeX.

        If regenerated, schedules a background GCS upload.
        """
        job = await self._get_job(db, job_id, user_id)

        if not job.pdf_gcs_path and not job.resume_latex_code:
            raise ValueError("PDF not yet generated for this job")

        # 1. Try GCS (path is relative like "resumes/user_id/job_id.pdf")
        if job.pdf_gcs_path and not job.pdf_gcs_path.startswith("/"):
            try:
                gcs = GCSClient()
                return await asyncio.to_thread(gcs.download_pdf, job.pdf_gcs_path)
            except Exception:
                logger.warning(f"GCS download failed for job {job_id}, trying local/regenerate")

        # 2. Try local temp file — either from absolute path in DB or known temp location
        local_candidates = []
        if job.pdf_gcs_path and job.pdf_gcs_path.startswith("/"):
            local_candidates.append(Path(job.pdf_gcs_path))
        # Also check the known temp path (file may still exist if GCS upload just completed)
        local_candidates.append(PDF_DIR / f"{user_id}_{job_id}.pdf")
        for local_path in local_candidates:
            if await asyncio.to_thread(local_path.exists):
                pdf_bytes = await asyncio.to_thread(local_path.read_bytes)
                _spawn_gcs_upload(pdf_bytes, user_id, job_id)
                return pdf_bytes

        # 3. Regenerate from stored LaTeX
        if job.resume_latex_code:
            logger.info(f"Regenerating PDF from LaTeX for job {job_id}")
            pdf_bytes = await compile_latex(job.resume_latex_code)
            # Schedule background GCS upload
            _spawn_gcs_upload(pdf_bytes, user_id, job_id)
            return pdf_bytes

        raise ValueError("PDF not available — no GCS path, local file, or LaTeX code found")

    async def update_custom_resume(
        self, db: AsyncSession, job_id: int, user_id: str, custom_resume_data: dict
    ) -> Job:
        job = await self._get_job(db, job_id, user_id)
        job.custom_resume_data = custom_resume_data
        job.resume_versions = _append_version(
            job.resume_versions, custom_resume_data, "manual_edit"
        )
        if job.status == JobStatus.READY:
            job.status = JobStatus.RESUME_GENERATED
        await db.commit()
        await db.refresh(job)
        return job

    async def fix_keyword_gaps(
        self, db: AsyncSession, job_id: int, user_id: str, keywords: list[str]
    ) -> Job:
        job = await self._get_job(db, job_id, user_id)
        if not job.custom_resume_data or not job.evidence_map:
            raise ValueError("Generate a tailored resume first before fixing keyword gaps")
        profile = await db.get(Profile, job.profile_id)
        profile_info = (profile.resume_info if profile else {}) or {}
        updated = await self.pipeline.fix_keyword_gaps(
            resume=job.custom_resume_data,
            job_description=job.job_description or {},
            evidence_map=job.evidence_map,
            keywords=keywords,
            profile_info=profile_info,
            user_id=user_id,
            reference_id=str(job_id),
        )
        job.custom_resume_data = updated
        job.resume_versions = _append_version(job.resume_versions, updated, "gap_fix")
        if job.status == JobStatus.READY:
            job.status = JobStatus.RESUME_GENERATED
        await db.commit()
        await db.refresh(job)
        return job

    async def restore_version(
        self, db: AsyncSession, job_id: int, user_id: str, version: int
    ) -> Job:
        job = await self._get_job(db, job_id, user_id)
        versions = job.resume_versions or []
        match = next((v for v in versions if v.get("version") == version), None)
        if not match:
            raise ValueError(f"Version {version} not found")
        data = match["data"]
        job.custom_resume_data = data
        job.resume_versions = _append_version(versions, data, f"restore_v{version}")
        if job.status == JobStatus.READY:
            job.status = JobStatus.RESUME_GENERATED
        await db.commit()
        await db.refresh(job)
        return job

    async def generate_cover_letter(self, db: AsyncSession, job_id: int, user_id: str) -> Job:
        job = await self._get_job(db, job_id, user_id)
        if not job.evidence_map:
            raise ValueError("Generate a tailored resume first (needs evidence map)")
        profile = await db.get(Profile, job.profile_id)
        profile_info = (profile.resume_info if profile else {}) or {}
        letter = await self.pipeline.generate_cover_letter(
            profile_info=profile_info,
            job_description=job.job_description or {},
            evidence_map=job.evidence_map,
            user_id=user_id,
            reference_id=str(job_id),
        )
        job.cover_letter = letter
        await db.commit()
        await db.refresh(job)
        return job

    async def generate_interview_packet(self, db: AsyncSession, job_id: int, user_id: str) -> Job:
        job = await self._get_job(db, job_id, user_id)
        if not job.evidence_map:
            raise ValueError("Generate a tailored resume first (needs evidence map)")
        profile = await db.get(Profile, job.profile_id)
        profile_info = (profile.resume_info if profile else {}) or {}
        packet = await self.pipeline.generate_interview_packet(
            profile_info=profile_info,
            job_description=job.job_description or {},
            evidence_map=job.evidence_map,
            user_id=user_id,
            reference_id=str(job_id),
        )
        job.interview_packet = packet
        await db.commit()
        await db.refresh(job)
        return job

    async def update_application_status(
        self,
        db: AsyncSession,
        job_id: int,
        user_id: str,
        *,
        application_status: str | None = None,
        notes: str | None = None,
        follow_up_at=None,
    ) -> Job:
        from datetime import datetime, timezone
        from app.models.job import ApplicationStatus

        job = await self._get_job(db, job_id, user_id)
        if application_status:
            job.application_status = ApplicationStatus(application_status)
            if application_status == "APPLIED" and not job.applied_at:
                job.applied_at = datetime.now(timezone.utc)
        if notes is not None:
            job.application_notes = notes
        if follow_up_at is not None:
            # Empty string / sentinel clears; new datetime resets reminder idempotency.
            if follow_up_at == "":
                job.follow_up_at = None
                job.follow_up_notified_at = None
            else:
                prev = job.follow_up_at
                job.follow_up_at = follow_up_at
                if prev != follow_up_at:
                    job.follow_up_notified_at = None
        await db.commit()
        await db.refresh(job)
        return job

    async def _get_job(self, db: AsyncSession, job_id: int, user_id: str, *, for_update: bool = False) -> Job:
        stmt = select(Job).where(Job.id == job_id, Job.user_id == user_id)
        if for_update:
            stmt = stmt.with_for_update()
        result = await db.execute(stmt)
        job = result.scalar_one_or_none()
        if not job:
            raise JobNotFoundError(f"Job {job_id} not found")
        return job
