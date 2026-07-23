import enum
from datetime import datetime

from sqlalchemy import String, Integer, ForeignKey, DateTime, Index, Enum
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class ReferralPayoutStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ReferralPayoutReview(TimestampMixin, Base):
    """Held referral bonus awaiting admin review — one row per referrer/referred pair."""

    __tablename__ = "referral_payout_reviews"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    referrer_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    referred_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    signals: Mapped[list] = mapped_column(JSON, nullable=False)
    bonus_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ReferralPayoutStatus] = mapped_column(
        Enum(ReferralPayoutStatus),
        default=ReferralPayoutStatus.PENDING,
        nullable=False,
    )
    reviewed_by_admin_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_referral_payout_reviews_pair", "referrer_id", "referred_id", unique=True),
        Index("ix_referral_payout_reviews_status", "status"),
    )
