from datetime import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class SubscriptionPlan(TimestampMixin, Base):
    __tablename__ = "subscription_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    monthly_credits: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    includes_tracker: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    includes_interview_packets: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    includes_extension: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    subscriptions = relationship("UserSubscription", back_populates="plan")


class UserSubscription(TimestampMixin, Base):
    __tablename__ = "user_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("subscription_plans.id"), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    razorpay_subscription_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    razorpay_order_id: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    credits_last_granted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    plan = relationship("SubscriptionPlan", back_populates="subscriptions")
