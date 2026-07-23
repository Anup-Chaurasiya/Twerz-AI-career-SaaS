"""Score Calibration model for tracking real outcome conversions by fit band."""

from sqlalchemy import Integer, String, Float, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class ScoreCalibration(Base):
    """Aggregated conversion rates by fit_label and ATS score bucket.
    
    Computed periodically from job.application_status outcomes to validate
    that fit_score and ats_score predictions correlate with real interview/offer rates.
    """
    __tablename__ = "score_calibrations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fit_label: Mapped[str] = mapped_column(
        String(32), nullable=False, index=True,
        comment="STRONG / GOOD / STRETCH / MISMATCH"
    )
    ats_bucket: Mapped[str] = mapped_column(
        String(32), nullable=False, index=True,
        comment="ATS score range e.g. '0-39', '40-59', '60-79', '80-100'"
    )
    sample_size: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Number of jobs in this band with sufficient status data"
    )
    application_rate: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0,
        comment="Rate of SAVED → APPLIED transitions"
    )
    interview_rate: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0,
        comment="Rate of APPLIED → INTERVIEW transitions"
    )
    offer_rate: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0,
        comment="Rate of INTERVIEW → OFFER transitions"
    )
    last_computed_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
        comment="Last time this calibration row was computed"
    )
