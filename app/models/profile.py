import enum
from datetime import datetime
from sqlalchemy import Integer, String, Boolean, Enum, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class ProfileStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"


class UploadSource(str, enum.Enum):
    GUEST = "guest"
    AUTHENTICATED = "authenticated"


class Profile(TimestampMixin, Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True, index=True)
    resume_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    original_page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[ProfileStatus] = mapped_column(
        Enum(ProfileStatus), default=ProfileStatus.PENDING, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    source_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_format: Mapped[str | None] = mapped_column(String(8), nullable=True)  # pdf | docx
    original_docx_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_pdf_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    docx_field_index: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pdf_field_index: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    preservation_eligible: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    layout_signals: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    enhance_count_today: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    enhance_reset_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    guest_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    guest_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    upload_gcs_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    upload_source: Mapped[UploadSource | None] = mapped_column(
        Enum(UploadSource, values_callable=lambda x: [e.value for e in x], name="uploadsource"),
        nullable=True,
    )

    user = relationship("User", back_populates="profiles")
    jobs = relationship("Job", back_populates="profile")
