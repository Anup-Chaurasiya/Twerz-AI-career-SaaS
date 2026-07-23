from sqlalchemy import String, Boolean, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class ReferralFlag(TimestampMixin, Base):
    __tablename__ = "referral_flags"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    referrer_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    referred_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    signal: Mapped[str] = mapped_column(String(32), nullable=False)  # ip_match | velocity
    reviewed: Mapped[bool] = mapped_column(Boolean, server_default="false", default=False)

    __table_args__ = (
        Index("ix_referral_flags_pair", "referrer_id", "referred_id", "signal", unique=True),
    )
