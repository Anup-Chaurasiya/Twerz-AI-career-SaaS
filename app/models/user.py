import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    google_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    picture_url: Mapped[str | None] = mapped_column(String, nullable=True)
    consent_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, server_default="false", default=False)
    is_super_admin: Mapped[bool] = mapped_column(Boolean, server_default="false", default=False)
    signup_source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    signup_share_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    referral_code: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True, index=True)
    referred_by_user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    referral_bonus_granted: Mapped[bool] = mapped_column(Boolean, server_default="false", default=False)
    referral_bonus_status: Mapped[str] = mapped_column(String(16), server_default="none", default="none")
    # none | paid | held | denied — held = payout blocked pending admin review
    signup_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tenant_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True
    )


    profiles = relationship("Profile", back_populates="user")
    jobs = relationship("Job", back_populates="user")
    credit = relationship("UserCredit", back_populates="user", uselist=False)
    tenant = relationship("Tenant", back_populates="users")
    roasts = relationship("Roast", back_populates="user")
