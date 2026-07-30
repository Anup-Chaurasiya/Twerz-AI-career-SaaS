import enum
from sqlalchemy import Integer, String, Text, Enum, ForeignKey, Boolean, DateTime
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    GENERATING_RESUME = "GENERATING_RESUME"
    RESUME_GENERATED = "RESUME_GENERATED"
    GENERATING_PDF = "GENERATING_PDF"
    READY = "READY"
    FAILED = "FAILED"


class ApplicationStatus(str, enum.Enum):
    SAVED = "SAVED"
    APPLIED = "APPLIED"
    INTERVIEW = "INTERVIEW"
    OFFER = "OFFER"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"


class FitAnalysisStatus(str, enum.Enum):
    NONE = "NONE"
    ANALYZING = "ANALYZING"
    READY = "READY"
    FAILED = "FAILED"


class Job(TimestampMixin, Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)
    job_description: Mapped[dict] = mapped_column(JSON, nullable=False)
    custom_resume_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    resume_latex_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdf_gcs_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdf_error_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    gcs_upload_failed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus), default=JobStatus.PENDING, nullable=False
    )

    # Fit / ATS analysis (Phase 0)
    jd_analysis: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    evidence_map: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    fit_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fit_label: Mapped[str | None] = mapped_column(String(32), nullable=True)
    fit_rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    gap_list: Mapped[list | None] = mapped_column(JSON, nullable=True)
    gap_roadmap: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    fit_analysis_status: Mapped[FitAnalysisStatus] = mapped_column(
        Enum(FitAnalysisStatus),
        default=FitAnalysisStatus.NONE,
        server_default="NONE",
        nullable=False,
    )
    fit_analysis_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    resume_plan: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    recruiter_review: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ats_score_before: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ats_score_after: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ats_score_detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    bullet_diff: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Version history + extras (Phase 1)
    resume_versions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    interview_packet: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pdf_verified_readable: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    target_page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pdf_page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    template_id: Mapped[str] = mapped_column(String(32), default="classic", server_default="classic", nullable=False)
    preserved_docx_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    docx_source: Mapped[str | None] = mapped_column(String(16), nullable=True)  # preserved | generated | fallback
    preserved_pdf_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdf_source: Mapped[str | None] = mapped_column(String(16), nullable=True)  # preserved | house | fallback
    output_mode: Mapped[str] = mapped_column(
        String(24), default="preserve_original", server_default="preserve_original", nullable=False
    )

    # Application tracker (Phase 2)
    application_status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus), default=ApplicationStatus.SAVED, nullable=False
    )
    applied_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    follow_up_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    follow_up_notified_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    application_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Referral & networking (Phase 3)
    known_contacts: Mapped[list | None] = mapped_column(JSON, nullable=True)
    applied_via: Mapped[str | None] = mapped_column(String(32), nullable=True)  # cold | referral | recruiter_outreach

    # Extension fit gate persistence
    low_fit_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    user = relationship("User", back_populates="jobs")
    profile = relationship("Profile", back_populates="jobs")
