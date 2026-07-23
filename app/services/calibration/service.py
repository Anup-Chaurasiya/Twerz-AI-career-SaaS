"""CalibrationService — compute real conversion rates by fit band and ATS bucket."""

from datetime import datetime, timezone
from logging import getLogger
from typing import Literal

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job, ApplicationStatus
from app.models.score_calibration import ScoreCalibration

logger = getLogger(__name__)


def _ats_bucket(score: int | None) -> str:
    """Map ATS score to bucket string for aggregation."""
    if score is None:
        return "unknown"
    if score < 40:
        return "0-39"
    if score < 60:
        return "40-59"
    if score < 80:
        return "60-79"
    return "80-100"


class CalibrationService:
    """Compute and store outcome-based conversion rates for fit/ATS bands.
    
    This service aggregates real application_status outcomes (SAVED → APPLIED → INTERVIEW → OFFER)
    grouped by fit_label and ats_score_after bucket, allowing admins to validate that the
    scoring system's predictions correlate with real-world interview/offer rates.
    """

    @staticmethod
    async def compute_and_store(
        db: AsyncSession,
        *,
        min_sample_size: int = 10,
    ) -> list[dict]:
        """Compute conversion rates from jobs table and upsert into score_calibrations.
        
        Args:
            db: Database session
            min_sample_size: Minimum jobs per band to include in results (default 10)
            
        Returns:
            List of computed bands with all their stats (including those below threshold)
        """
        logger.info(f"Starting calibration computation (min_sample_size={min_sample_size})")
        
        # Fetch all jobs with fit_label, ats_score_after, and application_status
        stmt = select(Job).where(
            and_(
                Job.fit_label.isnot(None),
                Job.ats_score_after.isnot(None),
            )
        )
        result = await db.execute(stmt)
        jobs = result.scalars().all()
        
        logger.info(f"Analyzing {len(jobs)} jobs with fit_label and ATS scores")
        
        # Group by (fit_label, ats_bucket)
        bands: dict[tuple[str, str], dict] = {}
        
        for job in jobs:
            fit_label = job.fit_label
            bucket = _ats_bucket(job.ats_score_after)
            key = (fit_label, bucket)
            
            if key not in bands:
                bands[key] = {
                    "fit_label": fit_label,
                    "ats_bucket": bucket,
                    "saved": 0,
                    "applied": 0,
                    "interview": 0,
                    "offer": 0,
                }
            
            band = bands[key]
            status = job.application_status
            
            # Count transitions: each job contributes to its current status and all prior ones
            if status in (ApplicationStatus.SAVED, ApplicationStatus.APPLIED, 
                          ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER,
                          ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN):
                band["saved"] += 1
            
            if status in (ApplicationStatus.APPLIED, ApplicationStatus.INTERVIEW, 
                          ApplicationStatus.OFFER, ApplicationStatus.REJECTED):
                band["applied"] += 1
            
            if status in (ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER):
                band["interview"] += 1
            
            if status == ApplicationStatus.OFFER:
                band["offer"] += 1
        
        # Compute rates and upsert (only for bands above threshold)
        bands_computed = 0
        bands_skipped = 0
        now = datetime.now(timezone.utc)
        all_results = []
        
        for key, band_data in bands.items():
            fit_label, ats_bucket = key
            saved = band_data["saved"]
            applied = band_data["applied"]
            interview = band_data["interview"]
            offer = band_data["offer"]
            
            # Compute rates (avoid division by zero)
            application_rate = (applied / saved) if saved > 0 else 0.0
            interview_rate = (interview / applied) if applied > 0 else 0.0
            offer_rate = (offer / interview) if interview > 0 else 0.0
            
            result_dict = {
                "fit_label": fit_label,
                "ats_bucket": ats_bucket,
                "sample_size": saved,
                "application_rate": round(application_rate, 4),
                "interview_rate": round(interview_rate, 4),
                "offer_rate": round(offer_rate, 4),
            }
            all_results.append(result_dict)
            
            # Only upsert bands with sufficient sample size
            if saved < min_sample_size:
                bands_skipped += 1
                logger.debug(
                    f"Skipping storage for band ({fit_label}, {ats_bucket}) — only {saved} jobs "
                    f"(min {min_sample_size})"
                )
                continue
            
            # Upsert into score_calibrations
            stmt = select(ScoreCalibration).where(
                and_(
                    ScoreCalibration.fit_label == fit_label,
                    ScoreCalibration.ats_bucket == ats_bucket,
                )
            )
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()
            
            if existing:
                existing.sample_size = saved
                existing.application_rate = application_rate
                existing.interview_rate = interview_rate
                existing.offer_rate = offer_rate
                existing.last_computed_at = now
            else:
                new_cal = ScoreCalibration(
                    fit_label=fit_label,
                    ats_bucket=ats_bucket,
                    sample_size=saved,
                    application_rate=application_rate,
                    interview_rate=interview_rate,
                    offer_rate=offer_rate,
                    last_computed_at=now,
                )
                db.add(new_cal)
            
            bands_computed += 1
            logger.debug(
                f"Calibration ({fit_label}, {ats_bucket}): n={saved}, "
                f"app={application_rate:.2%}, interview={interview_rate:.2%}, offer={offer_rate:.2%}"
            )
        
        await db.commit()
        
        logger.info(
            f"Calibration complete: {bands_computed} bands stored, "
            f"{bands_skipped} skipped (small sample), {len(jobs)} total jobs"
        )
        
        return all_results

    @staticmethod
    async def compute_preview(db: AsyncSession) -> list[dict]:
        """Compute all bands in-memory without persisting (for admin charting)."""
        stmt = select(Job).where(
            and_(
                Job.fit_label.isnot(None),
                Job.ats_score_after.isnot(None),
            )
        )
        result = await db.execute(stmt)
        jobs = result.scalars().all()

        bands: dict[tuple[str, str], dict] = {}
        for job in jobs:
            fit_label = job.fit_label
            bucket = _ats_bucket(job.ats_score_after)
            key = (fit_label, bucket)
            if key not in bands:
                bands[key] = {
                    "fit_label": fit_label,
                    "ats_bucket": bucket,
                    "saved": 0,
                    "applied": 0,
                    "interview": 0,
                    "offer": 0,
                }
            band = bands[key]
            status = job.application_status
            if status in (ApplicationStatus.SAVED, ApplicationStatus.APPLIED,
                          ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER,
                          ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN):
                band["saved"] += 1
            if status in (ApplicationStatus.APPLIED, ApplicationStatus.INTERVIEW,
                          ApplicationStatus.OFFER, ApplicationStatus.REJECTED):
                band["applied"] += 1
            if status in (ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER):
                band["interview"] += 1
            if status == ApplicationStatus.OFFER:
                band["offer"] += 1

        all_results = []
        for band_data in bands.values():
            saved = band_data["saved"]
            applied = band_data["applied"]
            interview = band_data["interview"]
            offer = band_data["offer"]
            all_results.append({
                "fit_label": band_data["fit_label"],
                "ats_bucket": band_data["ats_bucket"],
                "sample_size": saved,
                "application_rate": round((applied / saved) if saved > 0 else 0.0, 4),
                "interview_rate": round((interview / applied) if applied > 0 else 0.0, 4),
                "offer_rate": round((offer / interview) if interview > 0 else 0.0, 4),
            })
        return all_results

    @staticmethod
    async def get_calibration(db: AsyncSession) -> list[dict]:
        """Fetch all calibration records as dicts, ordered by fit_label then ats_bucket."""
        stmt = select(ScoreCalibration).order_by(
            ScoreCalibration.fit_label,
            ScoreCalibration.ats_bucket,
        )
        result = await db.execute(stmt)
        calibrations = result.scalars().all()
        
        return [
            {
                "id": cal.id,
                "fit_label": cal.fit_label,
                "ats_bucket": cal.ats_bucket,
                "sample_size": cal.sample_size,
                "application_rate": cal.application_rate,
                "interview_rate": cal.interview_rate,
                "offer_rate": cal.offer_rate,
                "last_computed_at": cal.last_computed_at.isoformat() if cal.last_computed_at else None,
            }
            for cal in calibrations
        ]

    @staticmethod
    async def get_all(db: AsyncSession) -> list[ScoreCalibration]:
        """Fetch all calibration records, ordered by fit_label then ats_bucket."""
        stmt = select(ScoreCalibration).order_by(
            ScoreCalibration.fit_label,
            ScoreCalibration.ats_bucket,
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_for_band(
        db: AsyncSession,
        fit_label: str,
        ats_bucket: str,
    ) -> ScoreCalibration | None:
        """Get calibration for a specific fit_label + ats_bucket combination."""
        stmt = select(ScoreCalibration).where(
            and_(
                ScoreCalibration.fit_label == fit_label,
                ScoreCalibration.ats_bucket == ats_bucket,
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
